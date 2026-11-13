// Social pulse (toasts), turn-based duels against a player's server snapshot, promo codes.
const same = (a, b) => String(a) === String(b);
const rows = (world, n) => (world.tables[n] ||= []);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const rand = (a, b) => a + Math.random() * (b - a);
import {creditDuel} from './clanPlus.js';
import {realStats, saveStats, kitOf} from './heroStats.js';
import {castSkill, outMult, inMult, gemProcs} from './skills.js';
const DAY = 864e5;
const CLASS = {warrior: {hp: 1.25, atk: 1.0, def: 1.3, name: 'Воин'}, knight: {hp: 1.3, atk: 0.9, def: 1.4, name: 'Рыцарь'}, paladin: {hp: 1.15, atk: 0.95, def: 1.2, heal: 1.4, name: 'Паладин'},
  berserker: {hp: 1.05, atk: 1.3, def: 0.85, name: 'Берсерк'}, rogue: {hp: 0.9, atk: 1.25, def: 0.8, crit: 0.2, name: 'Разбойник'}, assassin: {hp: 0.85, atk: 1.35, def: 0.75, crit: 0.22, name: 'Ассасин'},
  hunter: {hp: 0.95, atk: 1.2, def: 0.85, name: 'Лучник'}, mage: {hp: 0.8, atk: 1.4, def: 0.7, name: 'Маг'}, necromancer: {hp: 0.9, atk: 1.25, def: 0.8, name: 'Некромант'}, druid: {hp: 1.0, atk: 1.0, def: 0.95, heal: 1.4, name: 'Друид'}};
function fighter(p, world) {
  const level = Math.max(1, Math.min(120, Number(p?.level) || 1)), c = CLASS[p?.class_id] || CLASS.warrior;
  const real = world ? realStats(world, p.telegram_id, p) : null; // gear, attributes, talents — as in the main game
  const maxHp = real ? real.maxHp : Math.round((160 + level * 48) * c.hp);
  const kit = world ? kitOf(world, p.telegram_id) : {skills: [], talents: {}}, maxMp = Math.max(60, Math.min(2000, real?.maxMp || 100 + level * 8));
  return {id: String(p.telegram_id), name: nameOf(p), level, classId: p?.class_id || 'warrior', className: c.name, maxHp, hp: maxHp, maxMp, mp: maxMp, kit, potions: 2,
    atk: real ? real.atk : Math.round((18 + level * 7) * c.atk), def: real ? real.def : Math.round((6 + level * 3) * c.def), crit: real ? Math.max(0.05, real.crit) : c.crit || 0.1, real: !!real, heal: c.heal || 1, guard: false};
}
const mitig = (dmg, def) => Math.max(1, Math.round(dmg * (1 - def / (def + 75))));

// ---------- event feed: in-game popups for anything that happens to a player ----------
export function pushEvent(world, to, icon, text, kind, data, now = Date.now()) {
  const list = rows(world, 'ae_events');
  list.push({id: crypto.randomUUID(), to: String(to), icon, text: String(text).slice(0, 200), kind, data: data || null, at: new Date(now).toISOString(), acked: false});
  world.tables.ae_events = list.filter(e => Date.parse(e.at) > now - (e.acked ? 7 : 14) * DAY).slice(-800); // kept a week after the toast: the 🔔 history
}
// ---------- pulse: what is new for toasts ----------
function pulse(world, me) {
  const pending = rows(world, 'friendships').filter(f => f.status === 'pending' && (same(f.a, me) || same(f.b, me)) && !same(f.requester, me));
  const unread = rows(world, 'private_chat_messages').filter(m => same(m.recipient_id, me) && !m.read_at);
  const lastMsg = unread.slice(-1)[0];
  return ok({
    friendRequests: pending.map(f => ({id: String(f.requester), name: nameOf(player(world, f.requester)), at: f.created_at})),
    unread: unread.length, lastMessage: lastMsg ? {from: String(lastMsg.sender_id), name: nameOf(player(world, lastMsg.sender_id)), text: String(lastMsg.text).slice(0, 80), id: lastMsg.id} : null,
    events: rows(world, 'ae_events').filter(e => same(e.to, me) && !e.acked).slice(-10),
    duelsAgainstMe: rows(world, 'duels').filter(d => same(d.defender, me) && d.status !== 'active' && !d.defender_seen).slice(-3).map(d => ({id: d.id, by: nameOf(player(world, d.attacker)), won: d.status === 'lost'})),
  });
}

// ---------- «Что нового»: update posts shown in the game (same text as the channel) ----------
function handleNews(world, path, method, body, user, now) {
  const list = rows(world, 'ae_news');
  if (method === 'GET' && path === '/api/news') return ok({posts: list.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30).map(({id, title, text, at}) => ({id, title, text, at}))});
  if (path === '/api/admin/news') {
    if (!user.isAdmin) return fail('Недостаточно прав.', 403);
    if (method === 'GET') return ok({posts: list.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20).map(({id, title, text, at, channel}) => ({id, title, text, at, inChannel: !!channel}))});
    if (method === 'DELETE' || (method === 'POST' && body.delete)) {
      const removed = list.find(x => x.id === body.id); world.tables.ae_news = list.filter(x => x.id !== body.id);
      return ok({ok: true, removed: removed || null});
    }
    if (method === 'POST') {
      const title = String(body.title || '').trim().slice(0, 120), text = String(body.text || '').trim().slice(0, 6000);
      if (!title || text.length < 10) return fail('Нужны заголовок и текст поста.');
      if (body.editId) {  // edit an existing post (the channel copy is edited by the endpoint after the transaction)
        const post = list.find(x => x.id === body.editId); if (!post) return fail('Пост не найден.', 404);
        Object.assign(post, {title, text, edited_at: new Date(now).toISOString()});
        return ok({post, edited: true});
      }
      const opId = String(body.operationId || '');
      const dup = opId && list.find(x => x.op === opId); if (dup) return ok({post: dup, replayed: true});
      const post = {id: crypto.randomUUID(), op: opId || null, title, text, at: new Date(now).toISOString()};
      list.push(post); world.tables.ae_news = list.slice(-60);
      return ok({post}, 201);
    }
  }
  return fail('API не найден.', 404);
}

// ---------- special quests: co-op and PvP (daily + weekly) ----------
// Lifetime counters (titles are earned from these; the quest log above is pruned after 8 days).
export function bumpStat(world, userId, kind, n = 1) {
  const list = rows(world, 'ae_stats'); let r = list.find(x => same(x.u, userId));
  if (!r) { r = {u: String(userId), c: {}}; list.push(r); }
  r.c[kind] = (r.c[kind] || 0) + n;
}
// One row per player + kind + day with a counter (a row per kill used to fill the world document).
const dayIso = t => new Date(t).toISOString().slice(0, 10) + 'T00:00:00.000Z';
const questCount = (log, kind, from) => log.reduce((n, r) => n + (r.k === kind && Date.parse(r.at) >= from ? r.n || 1 : 0), 0);
export function compactQuestLog(world, now) {
  const m = new Map();
  for (const r of rows(world, 'ae_quest_log')) { if (!(Date.parse(r.at) > now - 9 * DAY)) continue; const at = dayIso(Date.parse(r.at)), k = r.u + '|' + r.k + '|' + at, o = m.get(k); if (o) o.n += r.n || 1; else m.set(k, {u: String(r.u), k: r.k, at, n: r.n || 1}); }
  world.tables.ae_quest_log = [...m.values()];
}
export function logQuest(world, userId, kind, now, n = 1) {
  bumpStat(world, userId, kind, n);
  let list = rows(world, 'ae_quest_log');
  if (list.length > 1500 || (list.length && list[0].n == null)) { compactQuestLog(world, now); list = rows(world, 'ae_quest_log'); }
  const at = dayIso(now), row = list.find(r => same(r.u, userId) && r.k === kind && r.at === at);
  if (row) row.n = (row.n || 1) + n; else list.push({u: String(userId), k: kind, at, n});
}
const SPECIAL_QUESTS = [
  {id: 'd_coop_win', period: 'day', kind: 'coop_win', need: 1, icon: '🏰', title: 'Пройти кооп-подземелье', reward: L => ({gold: 300 + L * 25, exp: 200 + L * 30, tickets: 1})},
  {id: 'd_coop_kill', period: 'day', kind: 'coop_kill', need: 8, icon: '👹', title: 'Победить 8 врагов в кооп-подземельях', reward: L => ({silver: 300 + L * 15, exp: 150 + L * 20})},
  {id: 'd_coop_combo', period: 'day', kind: 'coop_combo', need: 3, icon: '⚡', title: 'Сделать 3 связки способностей в коопе', reward: () => ({fragments: 1})},
  {id: 'd_duel_fight', period: 'day', kind: 'duel_fight', need: 3, icon: '⚔️', title: 'Провести 3 дуэли', reward: L => ({gold: 150 + L * 15, silver: 200, tickets: 1})},
  {id: 'd_duel_win', period: 'day', kind: 'duel_win', need: 2, icon: '🏆', title: 'Победить в 2 дуэлях', reward: L => ({gold: 250 + L * 20, exp: 150 + L * 25})},
  {id: 'd_horde_20', period: 'day', kind: 'horde_kill', need: 20, icon: '🗡️', title: 'Орда: победить 20 монстров', reward: L => ({gold: 200 + L * 10, exp: 150 + L * 15})},
  {id: 'd_horde_40', period: 'day', kind: 'horde_kill', need: 40, icon: '⚔️', title: 'Орда: победить 40 монстров', reward: L => ({gold: 350 + L * 18, silver: 300, tickets: 1})},
  {id: 'd_horde_60', period: 'day', kind: 'horde_kill', need: 60, icon: '🔥', title: 'Орда: победить 60 монстров', reward: () => ({fragments: 1, silver: 600})},
  {id: 'w_horde_blood', period: 'week', kind: 'horde_blood_kill', need: 30, icon: '🌕', title: 'Кровавая луна: 30 монстров за неделю', reward: L => ({gold: 1000 + L * 40, fragments: 1})},
  {id: 'w_coop_win', period: 'week', kind: 'coop_win', need: 5, icon: '🛡️', title: 'Пройти 5 кооп-подземелий за неделю', reward: L => ({gold: 1500 + L * 60, fragments: 2, tickets: 3})},
  {id: 'w_duel_win', period: 'week', kind: 'duel_win', need: 10, icon: '👑', title: '10 побед в дуэлях за неделю', reward: L => ({gold: 1200 + L * 50, fragments: 1, tickets: 3})},
  {id: 'd_arena_fight', period: 'day', kind: 'arena_fight', need: 3, icon: '🏟️', title: 'Провести 3 боя на арене', reward: L => ({gold: 150 + L * 12, tickets: 2})},
  {id: 'd_arena_win', period: 'day', kind: 'arena_win', need: 2, icon: '🥇', title: 'Победить 2 раза на арене', reward: L => ({silver: 300 + L * 10, tickets: 1})},
  {id: 'w_arena_win', period: 'week', kind: 'arena_win', need: 12, icon: '🏆', title: '12 побед на арене за неделю', reward: L => ({gold: 1000 + L * 40, fragments: 1, tickets: 5})}];
function periodStart(period, now) {
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0);
  if (period === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}
function questView(world, userId, now) {
  const L = Math.max(1, Number(player(world, userId)?.level) || 1), log = rows(world, 'ae_quest_log').filter(r => same(r.u, userId)), claims = rows(world, 'ae_quest_claims');
  return SPECIAL_QUESTS.map(q => {
    const from = periodStart(q.period, now), key = `${q.id}:${from}`;
    const progress = Math.min(q.need, questCount(log, q.kind, from));
    return {id: q.id, period: q.period, icon: q.icon, title: q.title, need: q.need, progress, reward: q.reward(L), claimed: claims.some(c => same(c.u, userId) && c.key === key), resetsAt: from + (q.period === 'week' ? 7 : 1) * DAY};
  });
}
function handleQuests(world, path, method, body, userId, now) {
  if (method === 'GET' && path === '/api/quests/special') return ok({quests: questView(world, userId, now)});
  if (method === 'POST' && path === '/api/quests/special/claim') {
    const q = SPECIAL_QUESTS.find(x => x.id === body.id); if (!q) return fail('Задание не найдено.', 404);
    const v = questView(world, userId, now).find(x => x.id === q.id);
    if (v.claimed) return fail('Награда уже получена.');
    if (v.progress < q.need) return fail('Задание ещё не выполнено.');
    rows(world, 'ae_quest_claims').push({u: String(userId), key: `${q.id}:${periodStart(q.period, now)}`, at: new Date(now).toISOString()});
    world.tables.ae_quest_claims = rows(world, 'ae_quest_claims').filter(c => Date.parse(c.at) > now - 9 * DAY);
    return ok({reward: v.reward, title: q.title});
  }
  return fail('API не найден.', 404);
}

// ---------- duels ----------
// Duels use the heroes' own skills and talents (kit), for mana; the opponent's shadow plays its kit too.
const BASIC = {id: '__power', name: 'Мощный удар', icon: '💥', mana: 20, mult: 1.8, heal: 0, inf: null};
const kitSkills = f => (f.kit?.skills?.length ? f.kit.skills : [BASIC]);
const skillView = sk => ({id: sk.id, name: sk.name, icon: sk.icon, mana: sk.mana, desc: sk.desc || '', dmg: sk.mult, heal: sk.heal, fx: sk.inf?.type || null});
function duelView(d) {
  const strip = f => ({...f, kit: undefined, skills: kitSkills(f).map(skillView)});
  return {id: d.id, status: d.status, turn: d.turn, me: strip(d.a), foe: {...strip(d.b), skills: undefined}, log: d.log.slice(-14), logSize: d.log.length, reward: d.reward || null, ratingChange: d.ratingChange ?? null,
    intent: d.status === 'active' ? (d.b.stunned ? '💫 оглушён — пропустит ход' : intentOf(d)) : null, intentKind: d.intent?.kind || 'attack'};
}
function aiPick(d) {
  const foe = d.b, me = d.a;
  if (foe.hp < foe.maxHp * 0.3 && foe.potions > 0 && Math.random() < 0.7) return {kind: 'potion'};
  const can = kitSkills(foe).filter(s => s.mana <= foe.mp);
  if (can.length && Math.random() < 0.6) { const sk = can.sort((a, b) => (b.mult + b.heal) - (a.mult + a.heal))[Math.floor(Math.random() * Math.min(2, can.length))]; return {kind: 'skill', id: sk.id}; }
  if (foe.mp < foe.maxMp * 0.25 && Math.random() < 0.5) return {kind: 'guard'};
  if (me.fury > 0 && Math.random() < 0.4) return {kind: 'guard'};
  return {kind: 'attack'};
}
function intentOf(d) {
  const i = d.intent || {kind: 'attack'};
  if (i.kind === 'skill') { const sk = kitSkills(d.b).find(s => s.id === i.id); return sk ? `${sk.icon} «${sk.name}»${sk.mult >= 2 ? ' — мощный навык!' : ''}` : 'навык'; }
  return {attack: 'обычный удар', guard: 'защитная стойка', potion: 'выпить зелье'}[i.kind] || 'обычный удар';
}
function aiMove(d, now) {
  const foe = d.b, me = d.a;
  if (foe.hp <= 0 || me.hp <= 0) return;
  if (foe.stunned > 0) { foe.stunned--; d.log.push({who: foe.id, text: `💫 ${foe.name} оглушён(а) и пропускает ход`}); }
  else {
    let i = d.intent || aiPick(d);
    if (i.kind === 'skill') { const sk = kitSkills(foe).find(s => s.id === i.id); if (!sk || sk.mana > foe.mp) i = {kind: 'attack'}; }
    if (i.kind === 'potion' && foe.potions <= 0) i = {kind: 'attack'};
    resolve(d, foe, me, i.kind, now, i.id);
  }
  d.intent = aiPick(d);
}
function strike(d, actor, target, mult, {crit = null, ignoreDef = 0, label} = {}) {
  const isCrit = crit ?? Math.random() < actor.crit, dodge = crit ? false : Math.random() < 0.06;
  const raw = actor.atk * rand(0.9, 1.1) * mult * (isCrit ? 1.6 : 1) * outMult(actor) * inMult(target);
  let dmg = dodge ? 0 : Math.round(mitig(raw, target.def * (1 - ignoreDef)) * (target.guard ? 0.45 : 1) * (target.kit?.talents?.defensiveStance ? 0.85 : 1));
  if (target.barrier > 0 && dmg) { const ab = Math.min(target.barrier, dmg); target.barrier -= ab; dmg -= ab; }
  target.hp = Math.max(0, target.hp - dmg);
  d.log.push({who: actor.id, text: dodge ? `${target.name} уклоняется от удара ${actor.name}!` : `${label || actor.name + ' атакует'}: ${dmg}${isCrit ? ' (крит!)' : ''}${target.guard ? ' (блок)' : ''}`, dmg, crit: isCrit, to: target.id});
  return dmg;
}
function resolve(d, actor, target, action, now, skillId) {
  actor.guard = false;
  if (action === 'attack') { const dm = strike(d, actor, target, 1); if (dm > 0) { const gp = gemProcs(actor, {dots: target.dots ||= []}, actor.kit); if (gp.length) d.log.push({who: actor.id, text: `${actor.name}: ${gp.join(', ')}`}); } }
  else if (action === 'potion') {
    actor.potions--; const amount = Math.round(actor.maxHp * 0.35);
    actor.hp = Math.min(actor.maxHp, actor.hp + amount); d.log.push({who: actor.id, text: `🧪 ${actor.name} пьёт зелье: +${amount} HP`, heal: amount, to: actor.id});
  } else if (action === 'guard') {
    actor.guard = true; const g = Math.round(actor.maxMp * (0.25 + (actor.kit?.talents?.blockMana || 0) / 100)); actor.mp = Math.min(actor.maxMp, actor.mp + g);
    d.log.push({who: actor.id, text: `🛡️ ${actor.name} встаёт в защиту (+${g} MP)`});
  } else if (action === 'skill') {
    const sk = kitSkills(actor).find(s => s.id === skillId); if (!sk) return strike(d, actor, target, 1);
    actor.mp -= sk.mana; let dealt = 0;
    const r = castSkill({self: actor, foe: target, kit: actor.kit, sk, ownLast: actor.lastSkill, hit: (mult, ignoreDef) => { const before = target.hp; strike(d, actor, target, mult, {ignoreDef, crit: false, label: `${sk.icon} ${actor.name} — «${sk.name}»`}); d.log.pop(); dealt = before - target.hp; return dealt; }});
    actor.lastSkill = {id: sk.id};
    d.log.push({who: actor.id, text: `${sk.icon} ${actor.name} — «${sk.name}»${r.parts.length ? ': ' + r.parts.join(', ') : ''}`, dmg: dealt || undefined, to: dealt ? target.id : undefined});
  }
  if (target.hp <= 0) d.log.push({text: `${target.name} повержен(а) в дуэли!`});
}
// End of a full round: tick down effects and apply damage over time.
function endRound(d) {
  for (const f of [d.a, d.b]) {
    if (f.hp <= 0) continue;
    for (const dot of f.dots || []) { f.hp = Math.max(0, f.hp - dot.per); dot.left--; d.log.push({text: `${dot.icon} ${dot.name}: ${f.name} −${dot.per}`, dmg: dot.per, to: f.id}); }
    f.dots = (f.dots || []).filter(x => x.left > 0);
    if (f.fury > 0) f.fury--; if (f.vuln > 0) f.vuln--;
    f.mp = Math.min(f.maxMp, f.mp + Math.round(f.maxMp * 0.05));
    if (f.hp <= 0) d.log.push({text: `${f.name} повержен(а) в дуэли!`});
  }
}
function finishDuel(world, d, now) {
  const won = d.b.hp <= 0, attacker = player(world, d.attacker), defender = player(world, d.defender);
  d.status = won ? 'won' : 'lost';
  const prof = id => { const list = rows(world, 'duel_ratings'); let r = list.find(x => same(x.id, id)); if (!r) { r = {id: String(id), rating: 1000, wins: 0, losses: 0}; list.push(r); } return r; };
  const ra = prof(d.attacker), rb = prof(d.defender);
  const expected = 1 / (1 + 10 ** ((rb.rating - ra.rating) / 400)), delta = Math.round(32 * ((won ? 1 : 0) - expected));
  ra.rating = Math.max(0, ra.rating + delta); rb.rating = Math.max(0, rb.rating - Math.round(delta / 2));
  if (won) { ra.wins++; rb.losses++; } else { ra.losses++; rb.wins++; }
  d.ratingChange = delta;
  const today = new Date(now).toISOString().slice(0, 10), stats = prof(d.attacker);
  if (stats.rewardDay !== today) { stats.rewardDay = today; stats.rewardsToday = 0; }
  if (won && stats.rewardsToday < 10) {
    stats.rewardsToday++;
    const lvl = d.b.level; d.reward = {gold: 40 + lvl * 12, exp: 30 + lvl * 15, claimed: false};
  }
  d.updated_at = new Date(now).toISOString();
  return {attacker, defender};
}
export async function handleDuel(world, path, method, body, me, now, notify) {
  const self = player(world, me); if (!self) return fail('Сначала создайте персонажа.', 404);
  const duels = rows(world, 'duels');
  world.tables.duels = duels.filter(d => Date.parse(d.updated_at) > now - 3 * DAY);
  let mine = rows(world, 'duels').find(d => same(d.attacker, me) && d.status === 'active');
  if (mine && Date.parse(mine.updated_at) < now - 15 * 60e3) { mine.status = 'lost'; mine.log.push({text: 'Дуэль прервана: время вышло.'}); mine = null; }
  if (method === 'GET' && path === '/api/duel') {
    const r = rows(world, 'duel_ratings').find(x => same(x.id, me)) || {rating: 1000, wins: 0, losses: 0};
    const top = rows(world, 'duel_ratings').slice().sort((a, b) => b.rating - a.rating).slice(0, 10).map(x => ({id: x.id, name: nameOf(player(world, x.id)), rating: x.rating, wins: x.wins}));
    return ok({active: mine ? duelView(mine) : null, rating: r.rating, wins: r.wins, losses: r.losses, top});
  }
  if (method !== 'POST') return fail('Метод не поддерживается.', 405);
  if (path === '/api/duel/start') {
    if (mine) return ok({duel: duelView(mine)});
    if (body.stats) saveStats(world, me, body.stats, now);
    let target = body.targetId ? player(world, body.targetId) : null;
    if (!target && typeof body.name === 'string') {
      const q = body.name.trim().replace(/^@/, '').toLocaleLowerCase();
      target = rows(world, 'players').find(p => !same(p.telegram_id, me) && (nameOf(p).toLocaleLowerCase() === q || String(p.username || '').toLocaleLowerCase() === q))
        || rows(world, 'players').find(p => !same(p.telegram_id, me) && q.length >= 3 && nameOf(p).toLocaleLowerCase().includes(q));
    }
    if (!target || same(target.telegram_id, me)) return fail('Игрок не найден. Проверьте ник.', 404);
    if (!target.character_name && !(Number(target.level) > 1)) return fail('У этого игрока ещё нет героя.');
    const d = {id: crypto.randomUUID(), attacker: String(me), defender: String(target.telegram_id), status: 'active', turn: 1, a: fighter(self, world), b: fighter(target, world), log: [], created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString()};
    d.log.push({text: `${d.a.name} вызывает ${d.b.name} на дуэль! Соперником управляет его тень.`}); d.intent = aiPick(d);
    rows(world, 'duels').push(d);
    return ok({duel: duelView(d)}, 201);
  }
  if (path === '/api/duel/act') {
    if (!mine) return fail('Активной дуэли нет.', 404);
    let action = String(body.action || ''); if (action === 'heal') action = 'potion';
    if (!['attack', 'skill', 'guard', 'potion', 'flee'].includes(action)) return fail('Неизвестное действие.');
    for (const f of [mine.a, mine.b]) { f.kit ||= {skills: [], talents: {}}; f.potions ??= 2; }
    if (action === 'flee') { mine.a.hp = 0; mine.log.push({text: `${mine.a.name} сдаётся.`}); }
    else {
      if (action === 'potion' && mine.a.potions <= 0) return fail('Зелья закончились.');
      if (action === 'skill') { const sk = kitSkills(mine.a).find(s => s.id === body.skillId); if (!sk) return fail('Навык не найден.'); if (mine.a.mp < sk.mana) return fail(`Нужно ${sk.mana} маны.`); }
      if (mine.a.stunned > 0) { mine.a.stunned--; mine.log.push({who: mine.a.id, text: `💫 ${mine.a.name} оглушён(а) и пропускает ход`}); }
      else resolve(mine, mine.a, mine.b, action, now, body.skillId);
      if (mine.b.hp > 0) aiMove(mine, now);
      if (mine.a.hp > 0 && mine.b.hp > 0) endRound(mine);
    }
    mine.turn++; mine.updated_at = new Date(now).toISOString();
    if (mine.a.hp <= 0 || mine.b.hp <= 0 || mine.turn > 40) {
      if (mine.turn > 40 && mine.a.hp > 0 && mine.b.hp > 0) { if (mine.a.hp / mine.a.maxHp >= mine.b.hp / mine.b.maxHp) mine.b.hp = 0; else mine.a.hp = 0; mine.log.push({text: 'Время вышло — победа по очкам здоровья.'}); }
      const {defender} = finishDuel(world, mine, now);
      logQuest(world, me, 'duel_fight', now); if (mine.status === 'won') { logQuest(world, me, 'duel_win', now); creditDuel(world, me, now); }
      notify?.(world, mine.defender, mine.status === 'won' ? `⚔️ ${mine.a.name} победил(а) вашу тень в дуэли. Ответьте вызовом!` : `🛡️ Ваша тень отразила вызов ${mine.a.name} в дуэли!`, 'duel:' + me, now);
    }
    return ok({duel: duelView(mine)});
  }
  if (path === '/api/duel/claim') {
    const d = rows(world, 'duels').filter(x => same(x.attacker, me) && x.reward && !x.reward.claimed).pop();
    if (!d) return fail('Награды нет.', 404);
    d.reward.claimed = true; return ok({reward: d.reward});
  }
  return fail('API не найден.', 404);
}

// ---------- promo codes ----------
export const PROMO_PACKS = {
  premium1: {title: 'Premium на 1 день', minLevel: 10, premiumDays: 1, gold: 0, silver: 500},
  starter: {title: 'Стартовый набор', minLevel: 1, gold: 3000, silver: 1500},
  ascension: {title: 'Набор вознесения', minLevel: 5, fragments: 2, silver: 1000},
  energy: {title: 'Энергия и арена', minLevel: 1, energy: 60, arenaTickets: 3, gold: 500},
};
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(existing) {
  for (;;) { let c = 'AE-'; for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]; if (!existing.has(c)) return c; }
}
export function handlePromo(world, path, method, body, user, now) {
  const codes = rows(world, 'promo_codes');
  if (path === '/api/admin/promo') {
    if (!user.isAdmin) return fail('Недостаточно прав.', 403);
    if (method === 'GET') return ok({packs: Object.entries(PROMO_PACKS).map(([id, p]) => ({id, title: p.title, minLevel: p.minLevel})), codes: codes.slice(-30).reverse()});
    const pack = PROMO_PACKS[body.pack];
    if (!pack) return fail('Выберите набор наград.');
    const existing = new Set(codes.map(c => c.code)), made = [];
    for (let i = 0; i < 5; i++) { const c = {code: newCode(existing), pack: body.pack, title: pack.title, usesLeft: 3, usedBy: [], created_at: new Date(now).toISOString()}; existing.add(c.code); codes.push(c); made.push(c); }
    return ok({codes: made}, 201);
  }
  if (path === '/api/promo/redeem' && method === 'POST') {
    const code = String(body.code || '').trim().toUpperCase();
    const c = codes.find(x => x.code === code);
    if (!c) return fail('Промокод не найден.', 404);
    if (c.usedBy.some(id => same(id, user.id))) return fail('Вы уже использовали этот промокод.');
    if (c.usesLeft <= 0) return fail('Промокод больше не действует: все активации использованы.');
    const p = player(world, user.id), pack = PROMO_PACKS[c.pack];
    if (!p) return fail('Сначала создайте персонажа.');
    const level = Math.max(Number(p.level) || 1, Math.min(Number(body.level) || 0, (Number(p.level) || 1) + 10));
    if (level < pack.minLevel) return fail(`Этот промокод доступен с ${pack.minLevel} уровня.`);
    c.usesLeft--; c.usedBy.push(String(user.id)); bumpStat(world, user.id, 'promo');
    if (pack.premiumDays) p.premium_until = new Date(Math.max(now, Date.parse(p.premium_until || 0) || 0) + pack.premiumDays * DAY).toISOString();
    return ok({title: pack.title, reward: {gold: pack.gold || 0, silver: pack.silver || 0, fragments: pack.fragments || 0, energy: pack.energy || 0, arenaTickets: pack.arenaTickets || 0, premiumDays: pack.premiumDays || 0}, usesLeft: c.usesLeft});
  }
  return null;
}


// ---------- direct trade between friends (escrow on the server) ----------
const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient']);
function cleanItem(it) {
  if (!it || typeof it !== 'object' || typeof it.name !== 'string' || !it.name.trim() || it.name.length > 80) return null;
  const stats = {}; for (const [k, v] of Object.entries(it.stats || {})) if (/^[a-zA-Z]{1,24}$/.test(k) && Number.isFinite(v) && Math.abs(v) < 1e6) stats[k] = v;
  const out = {...it, name: it.name.trim(), rarity: RARITIES.has(it.rarity) ? it.rarity : 'common', level: Math.max(1, Math.min(150, Math.floor(Number(it.level) || 1))),
    upgradeLevel: Math.max(0, Math.min(30, Math.floor(Number(it.upgradeLevel) || 0))), stackCount: Math.max(1, Math.min(999, Math.floor(Number(it.stackCount) || 1))), stats,
    isEquipped: false, isLocked: false, serverOwned: false, slot: undefined, boundToClan: undefined};
  return JSON.stringify(out).length > 4000 ? null : out;
}
// ---------- bag → market: a local gear item becomes a server-held item that the market accepts ----------
const GEAR_TYPES = new Set(['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact']);
const RARITY_POWER = {common: 1, uncommon: 1.4, rare: 1.9, epic: 2.6, legendary: 3.4, mythic: 4.4, ancient: 5.5, divine: 7};
// One check for every way an item can be sold (market, auction, chat lots, buy requests, bag → server):
// stats must fit the item's level and rarity (any hero may sell gear of any level).
export function saleCheck(world, userId, item_json) {
  const p = player(world, userId); if (!p) return 'Сначала создайте персонажа.';
  const it = {...item_json, level: Math.max(1, Number(item_json?.level) || 1), upgradeLevel: Math.max(0, Number(item_json?.upgradeLevel) || 0), stats: item_json?.stats || {}};
  return GEAR_TYPES.has(it.type) ? plausibleGear(it) : plausibleStack(it);
}
// Any hero may sell gear of any level; the stats only have to fit the item's own level and rarity.
function plausibleGear(it) {
  if (!GEAR_TYPES.has(it.type)) return 'Продать на рынке можно только экипировку.';
  const cap = (40 + it.level * 14) * (RARITY_POWER[it.rarity] || 1) * (1 + it.upgradeLevel * 0.1) * (1 + (Number(it.ascension) || 0) * 0.12) * (it.twoHanded === true && it.type === 'weapon' ? 1.6 : 1);
  // Percent stats: chances stay under 75%, bonus multipliers (crit damage, vampirism…) may go higher on top-tier gear.
  const pctCap = k => /critDamage|critMultiplier/i.test(k) ? 400 : /vampir|lifesteal|armorPen|penetration/i.test(k) ? 100 : 75;
  for (const [k, v] of Object.entries(it.stats)) {
    const pct = /chance|crit|evasion|dodge|rate|percent|lifesteal|vampir|resist|speed|penetration/i.test(k);
    if (v < 0 || v > (pct ? pctCap(k) : cap)) return `Характеристика «${k}» слишком велика для вещи ${it.level} уровня.`;
  }
  return null;
}
// The client equips some server items without telling the server (Premium auto-equip used to); then the
// server refuses to sell or disassemble the old gear it still believes is worn. Make the server match the hero.
const WEAR = new Set(['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact']);
function syncEquipped(world, body, userId, now) {
  const want = new Map(Object.entries(body?.equipped || {}).filter(([slot, id]) => WEAR.has(slot) && typeof id === 'string').map(([slot, id]) => [id, slot]));
  let changed = 0;
  for (const it of rows(world, 'owned_items')) {
    if (!same(it.owner_telegram_id, userId) || !WEAR.has(it.item_json?.type)) continue;
    const slot = want.get(it.id) === it.item_json.type ? it.item_json.type : null;
    if ((it.equipped_slot || null) !== slot) { it.equipped_slot = slot; it.updated_at = new Date(now).toISOString(); changed++; }
  }
  return ok({ok: true, changed});
}
// ---------- server-held items used up by add-on features (crystals, crafting materials) ----------
// Removing them only on the device let the next bag refresh bring them back, so they are used up here.
const GEM_STAT = {vamp: ['vampirism', 3], life: ['hpRegen', 5], mana: ['mpRegen', 3], fury: ['critChance', 4], ruin: ['critDamage', 15], pierce: ['armorPenetration', 5],
  shadow: ['evasion', 3], aim: ['accuracy', 6], bleed: ['bleedChance', 10], venom: ['poisonChance', 10], flame: ['burnChance', 10]};
const GEM_SOCKETS = {common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3, ancient: 3, divine: 3};
function takeServerItem(world, userId, id, count, now) {
  const it = rows(world, 'owned_items').find(i => i.id === id && same(i.owner_telegram_id, userId));
  if (!it || it.locked || it.equipped_slot || it.bound_clan_id || Number(it.quantity) < count) return null;
  if (Number(it.quantity) > count) { it.quantity = Number(it.quantity) - count; it.updated_at = new Date(now).toISOString(); }
  else world.tables.owned_items = rows(world, 'owned_items').filter(i => i !== it);
  return it;
}
function consumeItems(world, body, userId, now) {
  const list = (Array.isArray(body.items) ? body.items : []).slice(0, 10).map(x => ({id: String(x?.id || ''), count: Math.max(1, Math.min(999, Math.floor(Number(x?.count) || 1)))}));
  for (const x of list) { const it = rows(world, 'owned_items').find(i => i.id === x.id && same(i.owner_telegram_id, userId));
    if (!it || it.locked || it.equipped_slot || it.bound_clan_id || Number(it.quantity) < x.count) return fail('Предмета уже нет в сумке.'); }
  for (const x of list) takeServerItem(world, userId, x.id, x.count, now);
  return ok({ok: true});
}
function socketGem(world, body, userId, now) {
  const g = GEM_STAT[body.gem]; if (!g) return fail('Неизвестный кристалл.');
  const gear = body.gearId ? rows(world, 'owned_items').find(i => i.id === body.gearId && same(i.owner_telegram_id, userId)) : null;
  if (body.gearId && (!gear || !GEAR_TYPES.has(gear.item_json?.type))) return fail('Вещь не найдена.');
  if (gear && (gear.item_json.gems || []).length >= (GEM_SOCKETS[gear.item_json.rarity] || 1)) return fail('В вещи нет свободных гнёзд.');
  if (body.gemItemId) { const gem = rows(world, 'owned_items').find(i => i.id === body.gemItemId && same(i.owner_telegram_id, userId));
    if (!gem || gem.item_json?.templateId !== 'ae_gem_' + body.gem || gem.locked || Number(gem.quantity) < 1) return fail('Кристалла нет в сумке.');
    takeServerItem(world, userId, gem.id, 1, now); }
  else { const w = gemWallet(world, userId); if (!w || !(w.g[body.gem] > 0)) return fail('Кристалла нет в сумке.'); w.g[body.gem]--; }
  if (gear) { const j = gear.item_json; j.stats = {...(j.stats || {}), [g[0]]: (Number(j.stats?.[g[0]]) || 0) + g[1]}; j.gems = [...(j.gems || []), body.gem]; gear.updated_at = new Date(now).toISOString(); }
  return ok({ok: true, item: gear ? gear.item_json : null});
}
// ---------- crystals are counted on the server: the device bag only shows what the ledger allows ----------
// Before this, any crystal that appeared on a device (an old bug, an edited save) could be socketed for free.
const GEM_CAP_INIT = 3, GEM_ADD_DAY = 40;
const gemWallet = (world, u) => rows(world, 'ae_gem_wallet').find(r => same(r.u, u));
const gemIdOf = tpl => { const m = /^ae_gem_([a-z]+)$/.exec(String(tpl || '')); return m && GEM_STAT[m[1]] ? m[1] : null; };
function gemAdd(world, u, gem, n, now) { let w = gemWallet(world, u); if (!w) { w = {u: String(u), g: {}, at: new Date(now).toISOString()}; rows(world, 'ae_gem_wallet').push(w); } w.g[gem] = Math.max(0, (w.g[gem] || 0) + n); return w; }
function handleGems(world, path, body, userId, now) {
  const counts = src => Object.fromEntries(Object.keys(GEM_STAT).map(k => [k, Math.max(0, Math.min(999, Math.floor(Number(src?.[k]) || 0)))]));
  if (path === '/api/items/gems/sync') { // the device reports its bag: a first sync adopts it (capped), later ones can only lower the count
    let w = gemWallet(world, userId), local = counts(body.gems);
    if (!w) { w = {u: String(userId), g: Object.fromEntries(Object.entries(local).map(([k, v]) => [k, Math.min(v, GEM_CAP_INIT)])), at: new Date(now).toISOString()}; rows(world, 'ae_gem_wallet').push(w); }
    else if (body.lower) for (const k of Object.keys(GEM_STAT)) w.g[k] = Math.min(w.g[k] || 0, local[k]);
    return ok({gems: counts(w.g)});
  }
  if (path === '/api/items/gems/add') { // crafted in the Workshop or bought in the shop
    const gem = GEM_STAT[body.gem] ? body.gem : null; if (!gem) return fail('Неизвестный кристалл.');
    const op = String(body.operationId || ''); if (!/^[0-9a-f-]{36}$/i.test(op)) return fail('Нет идентификатора операции.');
    const log = rows(world, 'ae_gem_ops'), dup = log.find(o => o.op === op); if (dup) return ok({gems: counts(gemWallet(world, userId)?.g), replayed: true});
    if (!gemWallet(world, userId)) return fail('Обновите сумку и попробуйте снова.');
    const today = log.filter(o => same(o.u, userId) && Date.parse(o.at) > now - DAY).length;
    if (today >= GEM_ADD_DAY) return fail(`За сутки можно создать или купить до ${GEM_ADD_DAY} кристаллов.`);
    log.push({op, u: String(userId), gem, how: body.how === 'craft' ? 'craft' : 'buy', at: new Date(now).toISOString()});
    world.tables.ae_gem_ops = log.filter(o => Date.parse(o.at) > now - 3 * DAY);
    return ok({gems: counts(gemAdd(world, userId, gem, 1, now).g)});
  }
  return null;
}
// Materials, potions and other stackables may go to the server too (clan storage, sales): sane numbers only.
const STACK_TYPES = new Set(['material', 'ore', 'potion', 'consumable', 'fish', 'food', 'scroll', 'gem', 'resource']);
function plausibleStack(it) {
  if (!STACK_TYPES.has(it.type)) return 'Эту вещь нельзя передать.';
  for (const v of Object.values(it.stats || {})) if (v < 0 || v > 5000) return 'Характеристики предмета не прошли проверку.';
  return null;
}
// ---------- the hero's bag lives on the device: server-held items that reached the hero are taken into the bag ----------
// The server only holds items while they are in a deal (market, auction, chat lots, clan storage) or on their way to a player.
function claimItems(world, body, userId, now) {
  const op = String(body.operationId || ''); if (!/^[0-9a-f-]{36}$/i.test(op)) return fail('Нет идентификатора операции.');
  const done = rows(world, 'ae_claims').find(c => c.op === op);
  if (done) return same(done.u, userId) ? ok({items: done.items, replayed: true}) : fail('Операция занята.', 409);
  const fresh = r => r.origin === 'bag_deposit' && Date.parse(r.created_at) > now - 30 * 60e3; // just put up for a deal — leave it there
  const mine = rows(world, 'owned_items').filter(r => same(r.owner_telegram_id, userId) && !r.clan_id && !fresh(r)).slice(0, 100);
  const items = mine.map(r => ({id: r.id, item_json: r.item_json, quantity: Number(r.quantity) || 1, locked: !!r.locked, equipped_slot: r.equipped_slot || null, bound_clan_id: r.bound_clan_id || null}));
  const ids = new Set(mine.map(r => r.id));
  if (ids.size) world.tables.owned_items = rows(world, 'owned_items').filter(r => !ids.has(r.id));
  for (const r of mine) { const gem = gemIdOf(r.item_json?.templateId); if (gem) gemAdd(world, userId, gem, Number(r.quantity) || 1, now); }
  rows(world, 'ae_claims').push({op, u: String(userId), items, at: new Date(now).toISOString()});
  world.tables.ae_claims = rows(world, 'ae_claims').filter(c => Date.parse(c.at) > now - 3 * DAY);
  return ok({items});
}
function handleDeposit(world, body, userId, now) {
  const p = player(world, userId); if (!p) return fail('Сначала создайте персонажа.', 404);
  const op = String(body.operationId || '');
  if (!/^[0-9a-f-]{36}$/i.test(op)) return fail('Нет идентификатора операции.');
  const done = rows(world, 'ae_deposits').find(d => d.op === op);
  if (done) { if (!same(done.user, userId)) return fail('Операция занята.', 409); const row = rows(world, 'owned_items').find(r => r.id === done.itemId); return ok({itemId: done.itemId, item: row?.item_json || null, replayed: true}); }
  const today = rows(world, 'ae_deposits').filter(d => same(d.user, userId) && Date.parse(d.at) > now - DAY).length;
  if (today >= 40) return fail('Сегодня уже перенесено 40 вещей. Попробуйте завтра.');
  const it = cleanItem(body.item); if (!it) return fail('Предмет повреждён.');
  const gear = GEAR_TYPES.has(it.type), qty = gear ? 1 : Math.max(1, Math.min(999, Math.floor(Number(body.quantity) || 1)));
  it.stackCount = qty;
  const bad = gear ? plausibleGear(it) : plausibleStack(it); if (bad) return fail(bad);
  const gemDep = gemIdOf(it.templateId); if (gemDep) { const w = gemWallet(world, userId); if (!w || (w.g[gemDep] || 0) < qty) return fail('Столько кристаллов нет в сумке.'); w.g[gemDep] -= qty; }
  const item_json = {...it}; for (const k of ['id', 'serverOwned', 'stackCount', 'isEquipped', 'isLocked', 'boundToClan', 'slot', 'marketTradable', 'aeOver', 'aePetBase']) delete item_json[k];
  if (it.aeOver?.base) item_json.stats = it.aeOver.base; // over-level gear travels with its real stats
  const stamp = new Date(now).toISOString(), id = crypto.randomUUID();
  rows(world, 'owned_items').push({id, owner_telegram_id: Number(userId), item_json, quantity: qty, equipped_slot: null, locked: false, bound_clan_id: null, character_id: null, origin: 'bag_deposit', created_at: stamp, updated_at: stamp});
  rows(world, 'ae_deposits').push({op, user: String(userId), itemId: id, at: stamp});
  world.tables.ae_deposits = rows(world, 'ae_deposits').filter(d => Date.parse(d.at) > now - 3 * DAY);
  return ok({itemId: id, item: item_json}, 201);
}
const isFriend = (world, a, b) => rows(world, 'friendships').some(f => f.status === 'accepted' && (same(f.a, a) && same(f.b, b) || same(f.a, b) && same(f.b, a)));
const tradeView = (world, t) => ({id: t.id, seller: {id: t.seller, name: nameOf(player(world, t.seller))}, buyer: {id: t.buyer, name: nameOf(player(world, t.buyer))}, item: t.item, price: t.price, status: t.status, at: t.created_at});
function expireTrades(world, now) {
  for (const t of rows(world, 'trade_offers')) if (t.status === 'pending' && Date.parse(t.created_at) < now - 2 * DAY) {
    t.status = 'expired'; pushEvent(world, t.seller, '↩️', `Сделка с ${nameOf(player(world, t.buyer))} истекла — «${t.item.name}» возвращён в сумку`, 'trade_return', {item: t.item, offerId: t.id}, now);
  }
  world.tables.trade_offers = rows(world, 'trade_offers').filter(t => t.status === 'pending' || Date.parse(t.updated_at || t.created_at) > now - 7 * DAY);
}
export function handleTrade(world, path, method, body, me, now, notify) {
  expireTrades(world, now);
  const offers = rows(world, 'trade_offers');
  if (method === 'GET' && path === '/api/trade') return ok({incoming: offers.filter(t => t.status === 'pending' && same(t.buyer, me)).map(t => tradeView(world, t)), outgoing: offers.filter(t => t.status === 'pending' && same(t.seller, me)).map(t => tradeView(world, t))});
  if (method !== 'POST') return fail('Метод не поддерживается.', 405);
  if (path === '/api/trade/offer') {
    const buyer = String(body.buyerId || ''), price = Math.floor(Number(body.price));
    if (!isFriend(world, me, buyer)) return fail('Продавать напрямую можно только друзьям.');
    if (!Number.isInteger(price) || price < 1 || price > 10000000) return fail('Цена: от 1 до 10 000 000 золота.');
    const item = cleanItem(body.item); if (!item) return fail('Этот предмет нельзя продать.');
    if (offers.filter(t => t.status === 'pending' && same(t.seller, me)).length >= 10) return fail('Не больше 10 открытых сделок.');
    if (typeof body.offerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.offerId)) return fail('Неверный ID сделки.');
    const dup = offers.find(t => t.id === body.offerId); if (dup) return ok({offer: tradeView(world, dup), replayed: true});
    const t = {id: body.offerId, seller: String(me), buyer, item, price, status: 'pending', created_at: new Date(now).toISOString()};
    offers.push(t);
    const sn = nameOf(player(world, me));
    pushEvent(world, buyer, '🤝', `${sn} предлагает купить «${item.name}» за ${price} золота`, 'trade_offer', {offerId: t.id}, now);
    notify?.(world, buyer, `🤝 ${sn} предлагает вам купить «${item.name}» за ${price} 🪙. Откройте игру → Ещё → Друзья → Сделки.`, 'trade:' + me, now);
    return ok({offer: tradeView(world, t)}, 201);
  }
  const t = offers.find(x => x.id === body.offerId);
  if (!t) return fail('Сделка не найдена.', 404);
  if (path === '/api/trade/accept') {
    if (!same(t.buyer, me)) return fail('Это предложение не для вас.', 403);
    if (t.status === 'accepted') return ok({item: t.item, price: t.price, replayed: true});
    if (t.status !== 'pending') return fail('Сделка уже закрыта.');
    if (Math.floor(Number(body.gold) || 0) < t.price) return fail('Недостаточно золота.');
    t.status = 'accepted'; t.updated_at = new Date(now).toISOString();
    bumpStat(world, t.seller, 'trade_sold'); bumpStat(world, me, 'trade_bought');
    pushEvent(world, t.seller, '💰', `${nameOf(player(world, me))} купил(а) «${t.item.name}». +${t.price} золота`, 'trade_paid', {gold: t.price, offerId: t.id}, now);
    notify?.(world, t.seller, `💰 ${nameOf(player(world, me))} купил(а) у вас «${t.item.name}» за ${t.price} 🪙.`, 'trade-paid:' + t.id, now);
    return ok({item: t.item, price: t.price});
  }
  if (path === '/api/trade/decline' || path === '/api/trade/cancel') {
    const decline = path === '/api/trade/decline';
    if (decline ? !same(t.buyer, me) : !same(t.seller, me)) return fail('Нет доступа к сделке.', 403);
    if (t.status !== 'pending') return ok({status: t.status});
    t.status = decline ? 'declined' : 'cancelled'; t.updated_at = new Date(now).toISOString();
    pushEvent(world, t.seller, '↩️', decline ? `${nameOf(player(world, me))} отказался(ась) от «${t.item.name}» — предмет вернулся в сумку` : `Сделка отменена — «${t.item.name}» вернулся в сумку`, 'trade_return', {item: t.item, offerId: t.id}, now);
    return ok({status: t.status});
  }
  return fail('API не найден.', 404);
}

// The arena fight itself runs in the game client; it reports each finished fight here (capped per day).
function reportArena(world, userId, body, now) {
  const from = periodStart('day', now), n = questCount(rows(world, 'ae_quest_log').filter(r => same(r.u, userId)), 'arena_fight', from);
  if (n >= 30) return ok({ok: true, capped: true});
  logQuest(world, userId, 'arena_fight', now); if (body.won === true) { logQuest(world, userId, 'arena_win', now); creditDuel(world, userId, now); }
  return ok({ok: true});
}
// «Сообщить об ошибке» in the settings: kept for 30 days and forwarded to the admin by the endpoint.
function bugReport(world, body, user, now) {
  const text = String(body?.text || '').replace(/\s+$/g, '').trim();
  if (text.length < 5) return fail('Опишите ошибку подробнее (от 5 символов).');
  if (text.length > 2000) return fail('Сообщение длиннее 2000 символов.');
  const mine = rows(world, 'ae_bug_reports').filter(r => same(r.u, user.id) && Date.parse(r.at) > now - DAY);
  if (mine.length >= 5) return fail('Сегодня уже отправлено 5 сообщений. Попробуйте завтра.', 429);
  if (mine.some(r => r.text === text)) return ok({ok: true, replayed: true}, 201);
  const p = player(world, user.id), report = {id: crypto.randomUUID(), u: String(user.id), name: nameOf(p), username: user.username || null, level: Number(p?.level) || null, text, at: new Date(now).toISOString()};
  rows(world, 'ae_bug_reports').push(report);
  return ok({ok: true, report}, 201);
}
export function handleExtras(world, input, user, now, notify) {
  const path = String(input?.path || '').split('?')[0], method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {};
  if (path === '/api/social/pulse' && method === 'GET') return pulse(world, user.id);
  if (path === '/api/social/pulse/seen' && method === 'POST') { for (const d of rows(world, 'duels')) if (same(d.defender, user.id)) d.defender_seen = true; return ok({ok: true}); }
  if (path === '/api/social/events/ack' && method === 'POST') {
    const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
    for (const e of rows(world, 'ae_events')) if (same(e.to, user.id) && ids.has(e.id)) e.acked = true;
    return ok({ok: true});
  }
  if (path === '/api/admin/players/level' && method === 'POST') {
    if (!user.isAdmin) return fail('Недостаточно прав.', 403);
    const target = player(world, body.targetId), level = Math.floor(Number(body.level));
    if (!target) return fail('Игрок не найден.', 404);
    if (!Number.isInteger(level) || level < 1 || level > 120) return fail('Уровень: 1–120.');
    // Progress lives in the player's own save: the game applies this on the player's next pulse.
    for (const e of rows(world, 'ae_events')) if (same(e.to, target.telegram_id) && e.kind === 'admin_level' && !e.acked) e.acked = true;
    pushEvent(world, target.telegram_id, '🎖️', `Администратор установил вашему герою ${level} уровень.`, 'admin_level', {level}, now);
    if (level > (Number(target.level) || 1)) target.level = level;
    notify?.(world, target.telegram_id, `🎖️ Администратор повысил вашего героя до ${level} уровня. Откройте игру!`, 'admin-level', now);
    return ok({ok: true, name: nameOf(target), level});
  }
  if (path === '/api/support/bug-report' && method === 'POST') return bugReport(world, body, user, now);
  if (path === '/api/news' || path === '/api/admin/news') return handleNews(world, path, method, body, user, now);
  if (path === '/api/quests/arena' && method === 'POST') return reportArena(world, user.id, body, now);
  if (path.startsWith('/api/quests/special')) return handleQuests(world, path, method, body, user.id, now);
  if (path === '/api/items/deposit' && method === 'POST') return handleDeposit(world, body, user.id, now);
  if (path === '/api/items/equipped-sync' && method === 'POST') return syncEquipped(world, body, user.id, now);
  if (path === '/api/items/consume' && method === 'POST') return consumeItems(world, body, user.id, now);
  if (path === '/api/items/claim' && method === 'POST') return claimItems(world, body, user.id, now);
  if (path === '/api/market/list' && method === 'POST') { // the game's own market: same check before it lists a server item
    const it = rows(world, 'owned_items').find(i => i.id === body.itemId && same(i.owner_telegram_id, user.id));
    const bad = it && saleCheck(world, user.id, it.item_json); if (bad) return fail(bad);
  }
  if (path === '/api/items/socket-gem' && method === 'POST') return socketGem(world, body, user.id, now);
  if (path.startsWith('/api/items/gems/') && method === 'POST') { const r = handleGems(world, path, body, user.id, now); if (r) return r; }
  if (path === '/api/trade' || path.startsWith('/api/trade/')) return handleTrade(world, path, method, body, user.id, now, notify);
  if (path.startsWith('/api/duel')) return handleDuel(world, path, method, body, user.id, now, notify);
  if (path === '/api/admin/promo' || path === '/api/promo/redeem') return handlePromo(world, path, method, body, user, now);
  return null;
}
