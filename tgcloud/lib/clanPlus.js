// Clan extras on top of the engine's clans: member contribution, clan quests, a daily chest, clan bonuses,
// the weekly clan rating (top-3 rewards), clan wars, join requests, welcome message + emblem, and the raid
// as a real turn-based fight against the Gate Guardian (with combos from clanmates' skills).
import {castSkill, outMult, inMult, gemProcs, setupOf} from './skills.js';
import {blendedStats, realStats, baseStats, kitOf, saveStats} from './heroStats.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const DAY = 864e5;
const rand = (a, b) => a + Math.random() * (b - a);
export const dayKey = now => iso(now).slice(0, 10);
export const weekKey = now => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); };
const weekEnd = now => Date.parse(weekKey(now)) + 7 * DAY;
const hash = s => { let x = 2166136261; for (const c of String(s)) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; };
const seenAt = p => Date.parse(p?.last_seen_at || p?.updated_at || 0) || 0;
const OFFICERS = ['owner', 'officer'];
export const EMBLEMS = ['🛡️', '⚔️', '🐉', '🦅', '🐺', '🔥', '❄️', '🌙', '☀️', '💀', '👑', '🌿', '🏹', '⚡', '🦁', '🐍', '🔱', '🌊', '🍀', '🗡️'];

export function clanOf(world, id) {
  const m = rows(world, 'clan_members').find(x => same(x.telegram_id, id));
  const clan = m && rows(world, 'clans').find(c => same(c.id, m.clan_id));
  return clan ? {m, clan} : {};
}
export const membersOf = (world, clan) => rows(world, 'clan_members').filter(x => same(x.clan_id, clan.id));
export const metaOf = (world, clan, create) => { let r = rows(world, 'ae_clan_meta').find(x => same(x.clan, clan.id)); if (!r && create) { r = {clan: clan.id, welcome: '', emblem: '🛡️'}; rows(world, 'ae_clan_meta').push(r); } return r || {welcome: '', emblem: '🛡️'}; };
export function addClanXp(clan, xp) {
  clan.xp = Number(clan.xp || 0) + xp;
  clan.level = Math.max(Number(clan.level) || 1, Math.min(15, 1 + Math.floor(clan.xp / 1000)));
  clan.max_members = Math.max(Number(clan.max_members) || 30, Math.min(50, 30 + Math.floor(clan.xp / 1000) * 2));
}
export const tellClan = (world, clan, text, key, now, notify, icon = '🛡️') => {
  for (const m of membersOf(world, clan)) {
    notify?.(world, m.telegram_id, text, key + ':' + m.telegram_id, now);
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(m.telegram_id), icon, text, kind: 'clan', at: iso(now), acked: false});
  }
};

// ---------- clan bonuses (by clan level + last week's top-3 place) ----------
export function lastSeason(world, now) { return rows(world, 'ae_clan_season').find(s => s.week === weekKey(now - 7 * DAY)) || null; }
export function placeOf(world, clanId, now) { return lastSeason(world, now)?.places?.find(x => same(x.clan, clanId))?.place || null; }
export function bonusOf(world, clan, now) {
  const L = Math.max(1, Math.min(15, Number(clan?.level) || 1)), extra = {1: 5, 2: 3, 3: 2}[placeOf(world, clan?.id, now)] || 0;
  return {exp: Math.min(30, 2 * L) + extra, gold: Math.min(30, 2 * L) + extra, loot: Math.min(45, 3 * L) + extra * 2, champion: extra ? placeOf(world, clan.id, now) : null};
}

// ---------- contribution, clan quests, war score ----------
const PTS = {kills: 1, bosses: 5, dungeons: 8, duels: 4, ores: 0.2, potions: 1, raid: 0.01, donate: 0.01};
const DAILY_CAP = {kills: 300, bosses: 30, dungeons: 15, ores: 300, potions: 60, duels: 30};
const GOALS = {
  day: [{t: 'kills', per: 20, name: 'Убить монстров', icon: '⚔️'}, {t: 'bosses', per: 2, name: 'Победить боссов', icon: '👹'}, {t: 'duels', per: 2, name: 'Выиграть дуэлей или боёв арены', icon: '🤺'},
    {t: 'ores', per: 15, name: 'Добыть руды', icon: '⛏️'}, {t: 'potions', per: 2, name: 'Сварить зелий', icon: '🧪'}, {t: 'kills', per: 25, name: 'Истребить монстров', icon: '🗡️'}],
  week: [{t: 'kills', per: 120, name: 'Истребить монстров за неделю', icon: '⚔️'}, {t: 'bosses', per: 10, name: 'Повергнуть боссов за неделю', icon: '👹'},
    {t: 'duels', per: 10, name: 'Победы в дуэлях и на арене', icon: '🤺'}, {t: 'dungeons', per: 5, name: 'Пройти подземелий за неделю', icon: '🏰'}, {t: 'raid', per: 1500, name: 'Урон по Стражу врат', icon: '🐲'}],
};
const goalReward = (kind, L) => kind === 'day' ? {gold: 60 + L * 6, silver: 30 + L * 2, exp: 40 + L * 10} : {gold: 250 + L * 20, silver: 100 + L * 5, exp: 150 + L * 30, fragments: 1, tickets: 2};
function goalOf(world, clan, kind, now, create = true) {
  const key = (kind === 'day' ? 'd:' + dayKey(now) : 'w:' + weekKey(now));
  let g = rows(world, 'ae_clan_goals').find(x => same(x.clan, clan.id) && x.key === key);
  if (!g && create) {
    const pool = GOALS[kind], tpl = pool[hash(clan.id + key) % pool.length], n = Math.max(3, Math.min(25, membersOf(world, clan).length));
    g = {clan: clan.id, key, kind, t: tpl.t, name: tpl.name, icon: tpl.icon, target: tpl.per * n, prog: 0, done_at: null, claimed: [], at: iso(now)};
    rows(world, 'ae_clan_goals').push(g);
  }
  return g;
}
function contribRow(world, clan, me, now) {
  const week = weekKey(now); let r = rows(world, 'ae_clan_contrib').find(x => same(x.clan, clan.id) && same(x.u, me) && x.week === week);
  if (!r) { r = {clan: clan.id, u: String(me), week, pts: 0, kills: 0, bosses: 0, dungeons: 0, duels: 0, ores: 0, potions: 0, raid: 0}; rows(world, 'ae_clan_contrib').push(r); }
  return r;
}
// Credit a member's activity to the clan (contribution, quests, war). delta: {kills, bosses, dungeons, duels, ores, potions, raid}
export function clanCredit(world, me, delta, now, notify) {
  const {clan} = clanOf(world, me); if (!clan) return null;
  const r = contribRow(world, clan, me, now); let pts = 0;
  for (const [k, v] of Object.entries(delta || {})) { const n = Math.max(0, Math.round(Number(v) || 0)); if (!n || !(k in PTS)) continue; r[k] = (r[k] || 0) + n; pts += n * PTS[k]; }
  if (delta?.raid) pts += 10;
  pts = Math.round(pts); r.pts += pts;
  for (const kind of ['day', 'week']) {
    const g = goalOf(world, clan, kind, now); const n = Math.max(0, Math.round(Number(delta?.[g.t]) || 0));
    if (!n || g.done_at) continue;
    g.prog = Math.min(g.target, g.prog + n);
    if (g.prog >= g.target) { g.done_at = iso(now); addClanXp(clan, kind === 'day' ? 80 : 300); clan.treasury_gold = Number(clan.treasury_gold || 0) + (kind === 'day' ? 300 : 1500);
      tellClan(world, clan, `🎯 Клан [${clan.tag}] выполнил ${kind === 'day' ? 'задание дня' : 'задание недели'} «${g.name}»! В казну +${kind === 'day' ? 300 : 1500} 🪙. Заберите награду в Штабе клана.`, 'clan-goal:' + g.key + ':' + clan.id, now, notify, '🎯'); }
  }
  const war = warOf(world, clan, now);
  if (war && !war.settled && pts) { if (same(war.a, clan.id)) war.pa += pts; else war.pb += pts; }
  return r;
}
function progress(world, me, body, now, notify) {
  const {clan} = clanOf(world, me); if (!clan) return ok({ok: true, clan: false});
  const day = dayKey(now); let d = rows(world, 'ae_clan_daily').find(x => same(x.u, me) && x.day === day);
  if (!d) { world.tables.ae_clan_daily = rows(world, 'ae_clan_daily').filter(x => x.day >= dayKey(now - DAY)); d = {u: String(me), day}; rows(world, 'ae_clan_daily').push(d); }
  const delta = {};
  for (const k of ['kills', 'bosses', 'dungeons', 'ores', 'potions']) { const v = Math.max(0, Math.min(50, Math.round(Number(body?.[k]) || 0))), room = DAILY_CAP[k] - (d[k] || 0), n = Math.min(v, room); if (n > 0) { d[k] = (d[k] || 0) + n; delta[k] = n; } }
  if (Object.keys(delta).length) clanCredit(world, me, delta, now, notify);
  return ok({ok: true, credited: delta});
}
export function creditDuel(world, me, now) {
  const day = dayKey(now); let d = rows(world, 'ae_clan_daily').find(x => same(x.u, me) && x.day === day);
  if (!d) { d = {u: String(me), day}; rows(world, 'ae_clan_daily').push(d); }
  if ((d.duels || 0) >= DAILY_CAP.duels) return; d.duels = (d.duels || 0) + 1;
  clanCredit(world, me, {duels: 1}, now);
}

// ---------- weekly rating, clan wars ----------
const weekPts = (world, clanId, week) => rows(world, 'ae_clan_contrib').filter(x => same(x.clan, clanId) && x.week === week).reduce((s, x) => s + (x.pts || 0), 0);
function warOf(world, clan, now) { const wk = weekKey(now); return rows(world, 'ae_clan_wars').find(w => w.week === wk && (same(w.a, clan.id) || same(w.b, clan.id))) || null; }
function ensureWar(world, clan, now, notify) {
  let war = warOf(world, clan, now); if (war) return war;
  if (now > weekEnd(now) - DAY) return null; // no new wars on the last day of the week
  const wk = weekKey(now), busy = new Set(rows(world, 'ae_clan_wars').filter(w => w.week === wk).flatMap(w => [String(w.a), String(w.b)]));
  const foe = rows(world, 'clans').filter(c => !same(c.id, clan.id) && !busy.has(String(c.id)) && membersOf(world, c).length > 0)
    .sort((x, y) => Math.abs((Number(x.level) || 1) - (Number(clan.level) || 1)) - Math.abs((Number(y.level) || 1) - (Number(clan.level) || 1)) || membersOf(world, y).length - membersOf(world, x).length)[0];
  if (!foe) return null;
  war = {id: crypto.randomUUID(), week: wk, a: clan.id, b: foe.id, pa: 0, pb: 0, settled: false, winner: null, at: iso(now)};
  rows(world, 'ae_clan_wars').push(war);
  tellClan(world, foe, `⚔️ Клан [${clan.tag}] «${clan.name}» объявил вам войну! Очки вклада до конца недели решат победителя.`, 'clan-war:' + war.id, now, notify, '⚔️');
  tellClan(world, clan, `⚔️ Война с кланом [${foe.tag}] «${foe.name}» началась! Очки вклада до конца недели решат победителя.`, 'clan-war:' + war.id, now, notify, '⚔️');
  return war;
}
const PRIZE = [3000, 2000, 1000], PRIZE_XP = [500, 300, 150];
export function settleWeek(world, now, notify) {
  const prev = weekKey(now - 7 * DAY);
  if (!rows(world, 'ae_clan_season').some(s => s.week === prev)) {
    const ranked = rows(world, 'clans').map(c => ({clan: c.id, tag: c.tag, name: c.name, pts: weekPts(world, c.id, prev)})).filter(x => x.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 3);
    ranked.forEach((x, i) => { x.place = i + 1; const c = rows(world, 'clans').find(k => same(k.id, x.clan)); if (!c) return;
      c.treasury_gold = Number(c.treasury_gold || 0) + PRIZE[i]; addClanXp(c, PRIZE_XP[i]);
      tellClan(world, c, `${['🥇', '🥈', '🥉'][i]} Клан [${c.tag}] занял ${i + 1}-е место в рейтинге недели! В казну +${PRIZE[i]} золота, +${PRIZE_XP[i]} опыта клана, а всем участникам — бонус чемпиона на неделю.`, 'clan-season:' + prev + ':' + c.id, now, notify, '🏆'); });
    rows(world, 'ae_clan_season').push({week: prev, places: ranked, at: iso(now)});
    world.tables.ae_clan_season = rows(world, 'ae_clan_season').slice(-12);
    world.tables.ae_clan_contrib = rows(world, 'ae_clan_contrib').filter(x => x.week >= weekKey(now - 28 * DAY));
    world.tables.ae_clan_goals = rows(world, 'ae_clan_goals').filter(g => Date.parse(g.at) > now - 15 * DAY);
  }
  for (const w of rows(world, 'ae_clan_wars').filter(w => !w.settled && w.week < weekKey(now))) {
    w.settled = true; const a = rows(world, 'clans').find(c => same(c.id, w.a)), b = rows(world, 'clans').find(c => same(c.id, w.b));
    w.winner = w.pa === w.pb ? null : w.pa > w.pb ? w.a : w.b;
    for (const [c, mine, theirs, foe] of [[a, w.pa, w.pb, b], [b, w.pb, w.pa, a]]) { if (!c) continue;
      const won = mine > theirs, draw = mine === theirs, gold = won ? 2000 : draw ? 1000 : 500;
      c.treasury_gold = Number(c.treasury_gold || 0) + gold; addClanXp(c, won ? 300 : 100);
      tellClan(world, c, `${won ? '🏆 Победа' : draw ? '🤝 Ничья' : '🏳️ Поражение'} в войне с [${foe?.tag || '?'}]: ${mine} : ${theirs}. В казну +${gold} золота.`, 'clan-war-end:' + w.id + ':' + c.id, now, notify, '⚔️'); }
  }
  world.tables.ae_clan_wars = rows(world, 'ae_clan_wars').filter(w => w.week >= weekKey(now - 28 * DAY));
}
function top(world, now) {
  const wk = weekKey(now), season = lastSeason(world, now);
  const list = rows(world, 'clans').map(c => { const ms = membersOf(world, c);
    return {id: c.id, tag: c.tag, name: c.name, emblem: metaOf(world, c).emblem, level: Number(c.level) || 1, xp: Number(c.xp) || 0, members: ms.length, max: Number(c.max_members) || 30,
      week: Math.round(weekPts(world, c.id, wk)), raid: ms.reduce((s, m) => s + (Number(m.raid_damage) || 0), 0), place: placeOf(world, c.id, now)}; });
  return {week: [...list].sort((a, b) => b.week - a.week || b.level - a.level).slice(0, 50), level: [...list].sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 50),
    season: season?.places || [], prizes: PRIZE, endsAt: iso(weekEnd(now))};
}

// ---------- the raid as a real fight ----------
// Fort buildings that help in every clan boss fight: the Forge (+3% attack per level), the Shrine (−3% damage taken per level, +1 potion at 5 and 10).
export const fortOf = (world, clanId) => rows(world, 'ae_clan_fort').find(x => same(x.clan, clanId)) || null;
export function fortBonus(world, clanId) { const b = fortOf(world, clanId)?.b || {}, lv = k => Number(b[k]?.lvl) || 0; return {atk: 1 + lv('forge') * 0.03, guard: 1 - lv('shrine') * 0.03, potions: (lv('shrine') >= 5 ? 1 : 0) + (lv('shrine') >= 10 ? 1 : 0), forge: lv('forge'), shrine: lv('shrine')}; }
const raidHpOf = L => 1e4 + (Math.min(15, Math.max(1, L)) - 1) * 2e3;
const raidWin = (L, research = 0, supplies = 0) => ({xp: Math.round((500 + (L - 1) * 100) * (1 + Math.min(10, research) * 0.05)), gold: Math.round((250 + (L - 1) * 75) * (1 + Math.min(10, research) * 0.05)),
  silver: Math.round((100 + (L - 1) * 40) * (1 + Math.min(10, supplies) * 0.1)), ore: Math.round((10 + (L - 1) * 3) * (1 + Math.min(10, supplies) * 0.1))});
const ARMOR = 0.45, TURNS = 12;
export const todayStart = now => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };
function raidReset(world, clan, now) {
  if (Date.parse(clan.raid_reset_at || 0) > now) return;
  clan.raid_hp = raidHpOf(Number(clan.level) || 1); clan.raid_max_hp = clan.raid_hp; clan.raid_reset_at = iso(now + 7 * DAY);
  for (const m of membersOf(world, clan)) m.raid_damage = 0;
}
export const phaseOf = (hp, max) => hp > max * 0.66 ? {n: 1, name: 'Каменный щит', text: 'Страж закрыт щитом: урон по нему ниже.', taken: 0.85, atk: 1} : hp > max * 0.33 ? {n: 2, name: 'Ярость врат', text: 'Страж в ярости: бьёт сильнее.', taken: 1, atk: 1.3}
  : {n: 3, name: 'Последний рубеж', text: 'Страж трещит по швам: урон по нему выше, но он бьёт отчаянно.', taken: 1.25, atk: 1.5};
export function raidView(run) {
  if (!run) return null;
  const foeHp = Math.max(0, run.bossHp0 - run.dealt), ph = phaseOf(foeHp, run.bossMax);
  return {id: run.id, status: run.status, hp: run.hp, maxHp: run.maxHp, mp: run.mp, maxMp: run.maxMp, potions: run.potions, turn: run.turn, turns: TURNS, dealt: run.dealt, barrier: run.barrier || 0,
    foe: {hp: foeHp, maxHp: run.bossMax, atk: Math.round(run.maxHp * 0.06 * ph.atk * (run.mod?.atk || 1) * (run.hero?.guardMul || 1))}, phase: ph, heavyNext: (run.turn + 1) % (run.mod?.every || 3) === 0, boss: run.boss || null, ally: run.allyLast ? {name: run.allyName, setup: setupOf(run.allyLast)} : null,
    log: run.log.slice(-14), result: run.result || null};
}
export function raidTurn(world, me, run, action, skillId) {
  const h = run.hero, kit = kitOf(world, me), foe = run.foe, before = run.dealt, BN = run.bossName || 'Страж', md = run.mod || {}, AR = md.armor ?? ARMOR;
  const foeHp = () => Math.max(0, run.bossHp0 - run.dealt), ph = phaseOf(foeHp(), run.bossMax);
  const hitFoe = mult => { const dmg = Math.max(1, Math.round(h.atk * rand(0.9, 1.1) * mult * AR * (1 + (h.pen || 0)) * ph.taken * outMult(run) * inMult(foe))); run.dealt = Math.min(run.bossHp0, run.dealt + dmg);
    if (h.vamp) { const v = Math.round(dmg * h.vamp); if (v) { run.hp = Math.min(h.maxHp, run.hp + v); run.vampTurn = (run.vampTurn || 0) + v; } } return dmg; };
  let guard = false;
  run.vampTurn = 0;
  if (action === 'potion') { if (run.potions > 0) { run.potions--; const v = Math.round(h.maxHp * 0.4); run.hp = Math.min(h.maxHp, run.hp + v); run.log.push(`🧪 Зелье: +${v} HP`); } else action = 'attack'; }
  if (action === 'defend') { guard = true; run.mp = Math.min(run.maxMp, run.mp + Math.round(run.maxMp * 0.12)); run.log.push('🛡️ Вы в защитной стойке (−50% урона, +12% маны)'); }
  if (action === 'skill') {
    const sk = (kit.skills || []).find(x => x.id === skillId);
    if (!sk || sk.mana > run.mp) action = 'attack';
    else {
      run.mp -= sk.mana;
      const self = {hp: run.hp, maxHp: h.maxHp, mp: run.mp, maxMp: run.maxMp, atk: h.atk, crit: h.crit, barrier: run.barrier || 0, fury: run.fury || 0, name: 'Вы'};
      const shadow = {hp: foeHp(), maxHp: run.bossMax, dots: foe.dots, vuln: foe.vuln, stunned: foe.stunned};
      const s0 = shadow.hp, r = castSkill({self, foe: shadow, kit, sk, ownLast: run.lastSkill, allyLast: run.allyLast, allyName: run.allyName, hit: mult => hitFoe(mult)});
      const dotHit = Math.max(0, s0 - shadow.hp); if (dotHit) run.dealt = Math.min(run.bossHp0, run.dealt + Math.round(dotHit * AR));
      Object.assign(foe, {dots: shadow.dots || foe.dots, vuln: shadow.vuln || 0, stunned: shadow.stunned || 0});
      Object.assign(run, {hp: Math.min(h.maxHp, self.hp + (run.vampTurn || 0)), mp: self.mp, barrier: self.barrier, fury: self.fury}); run.lastSkill = {id: sk.id};
      if (r.combo) { run.log.push(`${r.combo.icon} Связка с ${run.allyName}: «${r.combo.name}» ×${r.combo.mult}!`); run.allyLast = null; run.combos = (run.combos || 0) + 1; }
      run.log.push(`${sk.icon} «${sk.name}»${r.parts.length ? ': ' + r.parts.join(', ') : ''}`);
      if (sk.inf || (sk.heal > 0 && !sk.mult)) run.setup = {inf: sk.inf ? {type: sk.inf.type} : null, heal: sk.heal, mult: sk.mult, name: sk.name};
      action = 'done';
    }
  }
  if (action === 'attack') {
    const crit = Math.random() < (h.crit || 0.12), dmg = hitFoe(crit ? (h.critDmg || 1.6) : 1);
    run.log.push(`⚔️ Удар: −${dmg}${crit ? ' (крит!)' : ''}`);
    for (const g of gemProcs({atk: h.atk}, foe, kit)) run.log.push(g);
    run.mp = Math.min(run.maxMp, run.mp + Math.round(run.maxMp * 0.06));
  }
  if (run.vampTurn) run.log.push(`🩸 Вампиризм: +${run.vampTurn} HP`);
  if (foe.dots?.length) { let t = 0; for (const d of foe.dots) { t += Math.round(d.per * AR); d.left--; } foe.dots = foe.dots.filter(d => d.left > 0); if (t) { run.dealt = Math.min(run.bossHp0, run.dealt + t); run.log.push(`🩸 Эффекты: −${t}`); } }
  run.turn++;
  if (foeHp() <= 0) { run.status = 'ended'; run.killed = true; run.log.push(`🏆 ${run.bossFull || 'Страж клановых врат'} повержен!`); return run.dealt - before; }
  // the Guardian strikes back
  if (run.fury > 0) run.fury--; if (foe.vuln > 0) foe.vuln--;
  if (foe.stunned > 0) { foe.stunned--; run.log.push(`💫 ${BN} оглушён и пропускает ход`); }
  else if (h.evasion && Math.random() < h.evasion) run.log.push(`💨 Вы уклонились от ${run.turn % (md.every || 3) === 0 ? 'сокрушающего удара' : 'удара: ' + BN}!`);
  else {
    const heavy = run.turn % (md.every || 3) === 0, raw = h.maxHp * 0.06 * ph.atk * (md.atk || 1) * (heavy ? (md.heavy || 2) : 1) * rand(0.9, 1.1) * (h.guardMul || 1) * (guard ? 0.5 : 1);
    let left = Math.max(1, Math.round(raw)); if (run.barrier > 0) { const ab = Math.min(run.barrier, left); run.barrier -= ab; left -= ab; }
    run.hp = Math.max(0, run.hp - left); run.log.push(`${heavy ? (md.heavyName || '💢 Сокрушающий удар') : (md.hitName || '🗿 ' + BN + ' бьёт')}: −${left}${guard ? ' (защита)' : ''}`);
    if (md.leech) { const v = Math.round(left * md.leech); if (v) { run.dealt = Math.max(0, run.dealt - v); run.log.push(`🩸 ${BN} пьёт жизнь: +${v} HP себе`); } }
  }
  if (md.regen && foeHp() > 0) { const v = Math.min(run.dealt, Math.round(Math.max(0, run.dealt - before) * md.regen)); if (v) { run.dealt -= v; run.log.push(`🌿 ${BN} регенерирует: +${v} HP`); } }
  if (md.drain && run.mp > 0) { const v = Math.min(run.mp, Math.round(run.maxMp * md.drain)); run.mp -= v; run.log.push(`🌀 ${BN} вытягивает ману: −${v} MP`); }
  if (run.hp > 0 && (h.hpRegen || h.mpRegen)) { run.hp = Math.min(h.maxHp, run.hp + Math.round(h.hpRegen || 0)); run.mp = Math.min(run.maxMp, run.mp + Math.round(h.mpRegen || 0)); }
  if (run.hp <= 0) { run.status = 'ended'; run.log.push('💀 Вы без сил — бой окончен, урон засчитан.'); }
  else if (run.turn >= TURNS) { run.status = 'ended'; run.log.push(`⏳ ${run.bossFull ? 'Время вышло' : 'Страж отбросил вас за врата'} — бой окончен, урон засчитан.`); }
  return run.dealt - before;
}
// The hero for a clan boss fight: real stats (gear, attributes, talents, pet) as the game computes them, or the level formula; plus the fort's Forge and Shrine.
export function clanHero(world, me, p, clanId) {
  const base = baseStats(p), b = blendedStats(world, me, p), rs = realStats(world, me, p), src = rs || b, fb = fortBonus(world, clanId);
  return {level: base.level, maxHp: src.maxHp, atk: Math.round(src.atk * fb.atk), def: src.def ?? base.def, crit: src.crit ?? 0.14, critDmg: Math.max(1.2, Math.min(4, rs?.critDmg || 1.6)),
    evasion: Math.min(0.35, (rs?.evasion || 0) / ((rs?.evasion || 0) + 100)), vamp: Math.min(0.5, (rs?.vamp || 0) / 100), pen: Math.min(0.6, (rs?.pen || 0) / 100),
    hpRegen: Math.min(src.maxHp * 0.05, rs?.hpRegen || 0), mpRegen: rs?.mpRegen || 0,
    maxMp: Math.max(60, Math.min(4000, src.maxMp || 100 + base.level * 8)), guardMul: Math.max(0.3, Math.min(1.5, (base.def + 150) / ((src.def || base.def) + 150)) * fb.guard), real: !!rs};
}
export const heroLine = hero => `${hero.real ? '📋 Ваши характеристики' : '📋 Характеристики по уровню (зайдите в игру, чтобы учесть экипировку)'}: ❤️ ${hero.maxHp} · ⚔️ ${hero.atk} · 🛡️ ${hero.def} · 💥 крит ${Math.round(hero.crit * 100)}% ×${hero.critDmg.toFixed(2)}${hero.evasion ? ` · 💨 уклонение ${Math.round(hero.evasion * 100)}%` : ''}${hero.vamp ? ` · 🩸 вампиризм ${Math.round(hero.vamp * 100)}%` : ''}${hero.pen ? ` · 🗡️ пробивание ${Math.round(hero.pen * 100)}%` : ''}${hero.hpRegen ? ` · реген ${Math.round(hero.hpRegen)} HP/ход` : ''}`;
async function raidFinish(world, me, run, now, native, notify) {
  let {clan, m} = clanOf(world, me), p = player(world, me);
  if (!clan || !same(clan.id, run.clan)) { run.result = {total: 0, lost: true}; return run; }
  const L = Number(p?.level) || 1;
  let nativeDmg = 0, item = null, defeated = false;
  if (run.dealt > 0 && Number(clan.raid_hp) > 0) {
    const before = Number(clan.raid_hp);
    try { const r = native ? await native({path: '/api/clan/raid/attack', method: 'POST', body: {}, headers: {'x-game-reset-version': String(Number(p?.reset_version) || 0)}}) : null;
      // The engine may roll the whole world back to a snapshot (new objects) when its own strike is refused:
      // look everything up again so the fight's result is written into the live document.
      const runId = run.id; ({clan, m} = clanOf(world, me)); p = player(world, me);
      run = rows(world, 'ae_clan_raid_runs').find(x => x.id === runId) || run;
      if (!clan || !m) { run.result = {total: 0, lost: true}; return run; }
      if (r && r.status < 300) { nativeDmg = Math.max(0, before - Number(clan.raid_hp)); item = r.body?.reward || null; defeated = !!r.body?.defeated; }
      else console.warn('raid native strike refused', r?.status, JSON.stringify(r?.body || {}).slice(0, 160)); } catch (e) { console.warn('raid native strike failed', e?.message); }
    if (!m.last_raid_attack || Date.parse(m.last_raid_attack) < todayStart(now)) m.last_raid_attack = iso(now);
    const extra = Math.max(0, Math.min(Number(clan.raid_hp), run.dealt - nativeDmg));
    if (extra > 0) {
      clan.raid_hp = Number(clan.raid_hp) - extra; m.raid_damage = Number(m.raid_damage || 0) + extra; clan.updated_at = iso(now);
      if (clan.raid_hp <= 0 && !defeated) {
        defeated = true; const w = raidWin(Number(clan.level) || 1, Number(clan.projects?.research || 0), Number(clan.projects?.supplies || 0));
        addClanXp(clan, w.xp); clan.treasury_gold = Number(clan.treasury_gold || 0) + w.gold; clan.treasury_silver = Number(clan.treasury_silver || 0) + w.silver; clan.treasury_ore = Number(clan.treasury_ore || 0) + w.ore;
        tellClan(world, clan, `🏆 Клан победил рейдового босса: +${w.xp} опыта клана, +${w.gold} золота, +${w.silver} серебра и +${w.ore} руды в казну.`, 'raid_' + clan.id + '_' + clan.raid_reset_at, now, notify, '🏆');
      }
    }
  } else if (!m.last_raid_attack || Date.parse(m.last_raid_attack) < todayStart(now)) m.last_raid_attack = iso(now);
  const total = Math.max(run.dealt, nativeDmg);
  if (run.setup) { world.tables.ae_clan_raid_setups = rows(world, 'ae_clan_raid_setups').filter(x => !same(x.u, me) && Date.parse(x.at) > now - DAY); rows(world, 'ae_clan_raid_setups').push({clan: clan.id, u: String(me), name: nameOf(p), sk: run.setup, at: iso(now)}); }
  const reward = {gold: 15 + L * 2 + Math.round(total / 60), exp: 25 + L * 5};
  run.result = {total, nativeDmg, defeated, item, reward, combos: run.combos || 0, raidHp: Math.max(0, Number(clan.raid_hp) || 0)};
  if (total > 0) clanCredit(world, me, {raid: total}, now, notify);
  return run;
}
async function handleRaid(world, path, body, me, now, native, notify) {
  const {clan, m} = clanOf(world, me), p = player(world, me); if (!clan) return fail('Вы не в клане.');
  const list = rows(world, 'ae_clan_raid_runs');
  world.tables.ae_clan_raid_runs = list.filter(r => r.status === 'active' || Date.parse(r.at) > now - DAY);
  let run = rows(world, 'ae_clan_raid_runs').filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (path === '/api/ae-clanx/raid/start') {
    if (run && run.status === 'active') return ok({run: raidView(run)});
    raidReset(world, clan, now);
    if (Number(clan.raid_hp) <= 0) return fail('Страж уже повержен на этой неделе. Новый — после сброса рейда.');
    if (m.last_raid_attack && Date.parse(m.last_raid_attack) >= todayStart(now)) return fail('Сегодня вы уже бились со Стражем. Новый бой — в 00:00 UTC.');
    if (body.stats) saveStats(world, me, body.stats, now);
    const hero = clanHero(world, me, p, clan.id), fb = fortBonus(world, clan.id);
    const ally = rows(world, 'ae_clan_raid_setups').filter(x => same(x.clan, clan.id) && !same(x.u, me) && Date.parse(x.at) > now - DAY).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    run = {id: crypto.randomUUID(), u: String(me), clan: clan.id, status: 'active', hero, hp: hero.maxHp, maxHp: hero.maxHp, mp: hero.maxMp, maxMp: hero.maxMp, potions: 2 + fb.potions, turn: 0, dealt: 0,
      bossHp0: Number(clan.raid_hp), bossMax: Number(clan.raid_max_hp) || raidHpOf(Number(clan.level) || 1), foe: {dots: [], vuln: 0, stunned: 0}, barrier: 0, fury: 0, lastSkill: null,
      allyLast: ally?.sk || null, allyName: ally?.name || null, log: ['🐲 Страж клановых врат пробуждается!',
        heroLine(hero), ...(ally ? [`🤝 ${ally.name} подготовил(а) связку «${ally.sk.name}» — ваш следующий навык станет сильнее!`] : [])], at: iso(now)};
    rows(world, 'ae_clan_raid_runs').push(run);
    return ok({run: raidView(run)}, 201);
  }
  if (!run) return fail('Боя нет.', 404);
  if (path === '/api/ae-clanx/raid/act') {
    if (run.status !== 'active') return ok({run: raidView(run)});
    const action = ['attack', 'skill', 'defend', 'potion'].includes(body.action) ? body.action : 'attack';
    raidTurn(world, me, run, action, body.skillId); run.at = iso(now);
    if (run.status === 'ended') run = await raidFinish(world, me, run, now, native, notify);
    return ok({run: raidView(run)});
  }
  if (path === '/api/ae-clanx/raid/leave') {
    if (run.status === 'active') { run.status = 'ended'; run.log.push('🏃 Вы отступили — нанесённый урон засчитан.'); run = await raidFinish(world, me, run, now, native, notify); }
    return ok({run: raidView(run)});
  }
  if (path === '/api/ae-clanx/raid/claim') {
    if (run.status === 'ended' && !run.result) { run.claimed = true; return fail('Этот бой не засчитался из-за сбоя сервера — начните бой со Стражем заново.'); }
    if (run.status !== 'ended') return fail('Сначала завершите бой.');
    if (run.claimed) return ok({reward: run.result.reward, alreadyClaimed: true});
    run.claimed = true; return ok({reward: run.result.reward});
  }
  return fail('API не найден.', 404);
}

// ---------- join requests ----------
function joinClan(world, clan, id, now) {
  rows(world, 'clan_members').push({clan_id: clan.id, telegram_id: Number(id), role: 'recruit', joined_at: iso(now), raid_damage: 0, last_raid_attack: null});
  const p = player(world, id); if (p) { p.clan_id = clan.id; p.updated_at = iso(now); }
}
function handleRequests(world, path, method, body, me, now, notify) {
  const reqs = rows(world, 'ae_clan_requests');
  world.tables.ae_clan_requests = reqs.filter(r => r.status === 'pending' ? Date.parse(r.at) > now - 7 * DAY : Date.parse(r.at) > now - 2 * DAY);
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  if (path === '/api/ae-clanx/request' && method === 'POST') {
    if (clanOf(world, me).clan) return fail('Вы уже состоите в клане.');
    const clan = rows(world, 'clans').find(c => same(c.id, body.clanId)); if (!clan) return fail('Клан не найден.', 404);
    if ((Number(p.level) || 1) < (Number(clan.min_join_level) || 1)) return fail(`Нужен ${clan.min_join_level} уровень.`);
    if (membersOf(world, clan).length >= (Number(clan.max_members) || 30)) return fail('Клан заполнен.');
    const mine = rows(world, 'ae_clan_requests').filter(r => same(r.u, me) && r.status === 'pending');
    if (mine.some(r => same(r.clan, clan.id))) return fail('Заявка уже отправлена — ждите ответа.');
    if (mine.length >= 3) return fail('Можно ждать ответа не больше чем от 3 кланов сразу.');
    const r = {id: crypto.randomUUID(), clan: clan.id, u: String(me), msg: String(body.msg || '').trim().slice(0, 140), status: 'pending', at: iso(now)};
    rows(world, 'ae_clan_requests').push(r);
    for (const o of membersOf(world, clan).filter(x => OFFICERS.includes(x.role))) {
      rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(o.telegram_id), icon: '📨', text: `${nameOf(p)} (ур. ${p.level}) просится в клан [${clan.tag}]`, kind: 'clan-request', at: iso(now), acked: false});
      notify?.(world, o.telegram_id, `📨 ${nameOf(p)} (ур. ${p.level}) подал(а) заявку в клан [${clan.tag}] «${clan.name}». Откройте Штаб клана, чтобы принять или отклонить.`, 'clan-req:' + r.id + ':' + o.telegram_id, now);
    }
    return ok({request: r});
  }
  if (path === '/api/ae-clanx/request/cancel' && method === 'POST') {
    for (const r of rows(world, 'ae_clan_requests')) if (same(r.u, me) && same(r.clan, body.clanId) && r.status === 'pending') r.status = 'cancelled';
    return ok({ok: true});
  }
  const {clan, m} = clanOf(world, me);
  if (!clan || !OFFICERS.includes(m.role)) return fail('Заявки видят только глава и офицеры.', 403);
  if (path === '/api/ae-clanx/requests' && method === 'GET') {
    return ok({requests: rows(world, 'ae_clan_requests').filter(r => same(r.clan, clan.id) && r.status === 'pending').map(r => { const q = player(world, r.u);
      return {id: r.id, u: r.u, msg: r.msg, at: r.at, name: nameOf(q), level: Number(q?.level) || 1, classId: q?.class_id || 'warrior'}; })});
  }
  if (path === '/api/ae-clanx/request/decide' && method === 'POST') {
    const r = rows(world, 'ae_clan_requests').find(x => x.id === body.id && same(x.clan, clan.id) && x.status === 'pending'); if (!r) return fail('Заявка не найдена.', 404);
    const q = player(world, r.u);
    if (!body.accept) { r.status = 'declined'; notify?.(world, r.u, `Клан [${clan.tag}] «${clan.name}» отклонил вашу заявку.`, 'clan-req-no:' + r.id, now); return ok({ok: true}); }
    if (!q || clanOf(world, r.u).clan) { r.status = 'cancelled'; return fail('Игрок уже вступил в другой клан.'); }
    if (membersOf(world, clan).length >= (Number(clan.max_members) || 30)) return fail('Клан заполнен.');
    r.status = 'accepted'; joinClan(world, clan, r.u, now);
    for (const x of rows(world, 'ae_clan_requests')) if (same(x.u, r.u) && x.status === 'pending') x.status = 'cancelled';
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(r.u), icon: '🛡️', text: `Вас приняли в клан [${clan.tag}] «${clan.name}»!`, kind: 'clan', at: iso(now), acked: false});
    notify?.(world, r.u, `🛡️ Вас приняли в клан [${clan.tag}] «${clan.name}»! Загляните в Дом клана.`, 'clan-req-yes:' + r.id, now);
    return ok({ok: true});
  }
  return fail('API не найден.', 404);
}

// ---------- prelude: season/war settlement, welcome message, a hint to join a clan ----------
export function clanTick(world, me, now, notify) {
  settleWeek(world, now, notify);
  const p = player(world, me); if (!p) return;
  const {clan, m} = clanOf(world, me);
  if (clan) {
    const meta = metaOf(world, clan); if (!meta.welcome || Date.parse(m.joined_at || 0) < now - 3 * DAY) return;
    const seen = rows(world, 'ae_clan_welcomed'); if (seen.some(x => same(x.u, me) && same(x.clan, clan.id))) return;
    seen.push({u: String(me), clan: clan.id, at: iso(now)});
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(me), icon: meta.emblem || '🛡️', text: `[${clan.tag}] «${clan.name}»: ${meta.welcome}`, kind: 'clan-welcome', at: iso(now), acked: false});
  } else if ((Number(p.level) || 1) >= 5 && rows(world, 'clans').length) {
    const hints = rows(world, 'ae_clan_hints'); if (hints.some(x => same(x.u, me))) return;
    hints.push({u: String(me), at: iso(now)});
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(me), icon: '🛡️', text: 'Вступите в клан: ежедневный сундук, бонус к опыту и золоту, клановые задания и рейд на Стража врат!', kind: 'clan-hint', at: iso(now), acked: false});
  }
}

// ---------- the Clan HQ ----------
function overview(world, me, now, notify) {
  const {clan, m} = clanOf(world, me), p = player(world, me);
  if (!clan) return ok({clan: null, requests: rows(world, 'ae_clan_requests').filter(r => same(r.u, me) && r.status === 'pending').map(r => r.clan)});
  raidReset(world, clan, now);
  const L = Number(p?.level) || 1, meta = metaOf(world, clan), war = ensureWar(world, clan, now, notify);
  const goals = ['day', 'week'].map(kind => { const g = goalOf(world, clan, kind, now);
    return {key: g.key, kind, name: g.name, icon: g.icon, target: g.target, prog: g.prog, done: !!g.done_at, claimed: g.claimed.includes(String(me)), canClaim: !!g.done_at && !g.claimed.includes(String(me)) && Date.parse(m.joined_at || 0) < Date.parse(g.done_at), reward: goalReward(kind, L), endsAt: iso(kind === 'day' ? todayStart(now) + DAY : weekEnd(now))}; });
  // last period's finished goals that are still unclaimed
  for (const kind of ['day', 'week']) { const g = goalOf(world, clan, kind, now - (kind === 'day' ? DAY : 7 * DAY), false);
    if (g?.done_at && !g.claimed.includes(String(me)) && Date.parse(m.joined_at || 0) < Date.parse(g.done_at)) goals.push({key: g.key, kind, name: g.name, icon: g.icon, target: g.target, prog: g.prog, done: true, claimed: false, canClaim: true, reward: goalReward(kind, L), past: true}); }
  const chest = rows(world, 'ae_clan_chest').find(x => same(x.u, me) && x.day === dayKey(now));
  const foe = war && rows(world, 'clans').find(c => same(c.id, same(war.a, clan.id) ? war.b : war.a));
  const myPts = Math.round(contribRow(world, clan, me, now).pts);
  const run = rows(world, 'ae_clan_raid_runs').filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  return ok({clan: {id: clan.id, tag: clan.tag, name: clan.name, level: Number(clan.level) || 1, xp: Number(clan.xp) || 0, members: membersOf(world, clan).length, max: Number(clan.max_members) || 30,
      emblem: meta.emblem, welcome: meta.welcome, treasury: Number(clan.treasury_gold) || 0, treasurySilver: Number(clan.treasury_silver) || 0, treasuryOre: Number(clan.treasury_ore) || 0, open: !!clan.recruitment_open},
    role: m.role, bonus: bonusOf(world, clan, now), goals, myPts, weekPts: Math.round(weekPts(world, clan.id, weekKey(now))),
    chest: {ready: !chest, next: iso(todayStart(now) + DAY), preview: chestReward(clan, L, true)},
    war: war ? {mine: same(war.a, clan.id) ? war.pa : war.pb, theirs: same(war.a, clan.id) ? war.pb : war.pa, foe: foe ? {tag: foe.tag, name: foe.name, emblem: metaOf(world, foe).emblem, level: Number(foe.level) || 1} : null, endsAt: iso(weekEnd(now))} : null,
    raid: {hp: Number(clan.raid_hp), max: Number(clan.raid_max_hp) || raidHpOf(Number(clan.level) || 1), doneToday: !!(m.last_raid_attack && Date.parse(m.last_raid_attack) >= todayStart(now)), resetAt: clan.raid_reset_at,
      run: run && (run.status === 'active' || (run.result && !run.claimed)) ? raidView(run) : null},
    requests: OFFICERS.includes(m.role) ? rows(world, 'ae_clan_requests').filter(r => same(r.clan, clan.id) && r.status === 'pending').length : 0,
    season: lastSeason(world, now)?.places || [], emblems: EMBLEMS});
}
function chestReward(clan, L, preview) {
  const C = Number(clan.level) || 1;
  const r = {gold: 30 + C * 25 + L * 3, silver: 20 + C * 8, exp: 20 + L * 4};
  if (preview) return {...r, fragChance: Math.round((0.08 + C * 0.02) * 100), ticketChance: C >= 3 ? 25 : 0};
  if (Math.random() < 0.08 + C * 0.02) r.fragments = 1;
  if (C >= 3 && Math.random() < 0.25) r.tickets = 1;
  return r;
}
function members(world, me, now) {
  const {clan} = clanOf(world, me); if (!clan) return fail('Вы не в клане.');
  const wk = weekKey(now), prev = weekKey(now - 7 * DAY);
  const list = membersOf(world, clan).map(m => { const q = player(world, m.telegram_id), c = rows(world, 'ae_clan_contrib').filter(x => same(x.clan, clan.id) && same(x.u, m.telegram_id));
    const cur = c.find(x => x.week === wk) || {};
    return {id: String(m.telegram_id), name: nameOf(q), level: Number(q?.level) || 1, classId: q?.class_id || 'warrior', role: m.role, joined: m.joined_at, away: Math.floor((now - seenAt(q)) / DAY),
      week: Math.round(cur.pts || 0), last: Math.round(c.find(x => x.week === prev)?.pts || 0), total: Math.round(c.reduce((s, x) => s + (x.pts || 0), 0)), raid: Number(m.raid_damage) || 0,
      detail: {kills: cur.kills || 0, bosses: cur.bosses || 0, duels: cur.duels || 0, dungeons: cur.dungeons || 0, raid: cur.raid || 0}}; })
    .sort((a, b) => b.week - a.week || b.level - a.level);
  const mvp = [...list].sort((a, b) => b.last - a.last)[0];
  return ok({members: list, mvp: mvp?.last ? {name: mvp.name, pts: mvp.last} : null});
}
function search(world, me, now) {
  const p = player(world, me), mine = rows(world, 'ae_clan_requests').filter(r => same(r.u, me) && r.status === 'pending').map(r => String(r.clan));
  const wk = weekKey(now);
  return ok({clans: rows(world, 'clans').map(c => { const ms = membersOf(world, c), meta = metaOf(world, c);
    return {id: c.id, tag: c.tag, name: c.name, emblem: meta.emblem, desc: String(c.description || '').slice(0, 140), level: Number(c.level) || 1, members: ms.length, max: Number(c.max_members) || 30,
      minLevel: Number(c.min_join_level) || 1, open: !!c.recruitment_open, week: Math.round(weekPts(world, c.id, wk)), active: ms.filter(m => seenAt(player(world, m.telegram_id)) > now - 3 * DAY).length,
      requested: mine.includes(String(c.id)), place: placeOf(world, c.id, now)}; }).sort((a, b) => b.active - a.active || b.week - a.week || b.level - a.level).slice(0, 60),
    myLevel: Number(p?.level) || 1, inClan: !!clanOf(world, me).clan});
}

export async function handleClanPlus(world, path, method, body, me, now, native, notify) {
  if (path === '/api/ae-clanx/search') return search(world, me, now);
  if (path === '/api/ae-clanx/top') return ok(top(world, now));
  if (path.startsWith('/api/ae-clanx/request')) return handleRequests(world, path, method, body, me, now, notify);
  if (path.startsWith('/api/ae-clanx/raid')) return handleRaid(world, path, body, me, now, native, notify);
  if (path === '/api/ae-clanx/progress' && method === 'POST') return progress(world, me, body, now, notify);
  if (path === '/api/ae-clanx' && method === 'GET') return overview(world, me, now, notify);
  if (path === '/api/ae-clanx/members') return members(world, me, now);
  const {clan, m} = clanOf(world, me); if (!clan) return fail('Вы не в клане.');
  const p = player(world, me), L = Number(p?.level) || 1;
  if (path === '/api/ae-clanx/chest' && method === 'POST') {
    const day = dayKey(now), list = rows(world, 'ae_clan_chest');
    if (list.some(x => same(x.u, me) && x.day === day)) return fail('Сундук уже открыт сегодня. Новый — в 00:00 UTC.');
    world.tables.ae_clan_chest = list.filter(x => x.day >= dayKey(now - 2 * DAY));
    const reward = chestReward(clan, L, false); rows(world, 'ae_clan_chest').push({u: String(me), day, clan: clan.id});
    return ok({reward});
  }
  if (path === '/api/ae-clanx/goal/claim' && method === 'POST') {
    const g = rows(world, 'ae_clan_goals').find(x => same(x.clan, clan.id) && x.key === body.key);
    if (!g || !g.done_at) return fail('Задание ещё не выполнено.');
    const cur = [goalOf(world, clan, g.kind, now, false), goalOf(world, clan, g.kind, now - (g.kind === 'day' ? DAY : 7 * DAY), false)];
    if (!cur.includes(g)) return fail('Срок получения награды истёк.');
    if (g.claimed.includes(String(me))) return fail('Награда уже получена.');
    if (Date.parse(m.joined_at || 0) >= Date.parse(g.done_at)) return fail('Вы вступили в клан после выполнения задания.');
    g.claimed.push(String(me)); return ok({reward: goalReward(g.kind, L)});
  }
  if (path === '/api/ae-clanx/donate' && method === 'POST') {
    const gold = Math.floor(Number(body.gold) || 0), silver = Math.floor(Number(body.silver) || 0);
    if (gold < 0 || silver < 0 || gold + silver <= 0) return fail('Укажите сумму.');
    const day = dayKey(now); let d = rows(world, 'ae_clan_daily').find(x => same(x.u, me) && x.day === day);
    if (!d) { d = {u: String(me), day}; rows(world, 'ae_clan_daily').push(d); }
    const capG = 50000 + L * 2000, capS = 100000 + L * 4000;
    if ((d.donG || 0) + gold > capG) return fail(`За сутки можно внести до ${capG} золота (осталось ${Math.max(0, capG - (d.donG || 0))}).`);
    if ((d.donS || 0) + silver > capS) return fail(`За сутки можно внести до ${capS} серебра (осталось ${Math.max(0, capS - (d.donS || 0))}).`);
    d.donG = (d.donG || 0) + gold; d.donS = (d.donS || 0) + silver;
    clan.treasury_gold = Number(clan.treasury_gold || 0) + gold; clan.treasury_silver = Number(clan.treasury_silver || 0) + silver; clan.updated_at = iso(now);
    const ev = rows(world, 'clan_storage_events');
    ev.push({id: ev.reduce((x, e) => Math.max(x, Number(e.id) || 0), 0) + 1, clan_id: clan.id, actor_telegram_id: Number(me), action: 'donate', item_name: 'Пожертвование в казну', quantity: 1, gold_delta: gold, silver_delta: silver, ore_delta: 0, created_at: iso(now)});
    clanCredit(world, me, {donate: gold + Math.floor(silver / 2)}, now);
    return ok({treasury: {gold: Number(clan.treasury_gold), silver: Number(clan.treasury_silver), ore: Number(clan.treasury_ore) || 0}});
  }
  if (path === '/api/ae-clanx/settings' && method === 'POST') {
    if (!OFFICERS.includes(m.role)) return fail('Настройки доступны главе и офицерам.', 403);
    const meta = metaOf(world, clan, true);
    if (body.welcome != null) meta.welcome = String(body.welcome).replace(/\s+/g, ' ').trim().slice(0, 200);
    if (body.emblem != null) { if (!EMBLEMS.includes(body.emblem)) return fail('Нет такой эмблемы.'); meta.emblem = body.emblem; }
    return ok({welcome: meta.welcome, emblem: meta.emblem});
  }
  return fail('API не найден.', 404);
}
