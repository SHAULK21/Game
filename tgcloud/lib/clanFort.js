// The clan fortress: buildings that take hours to build (up to level 10), hired defenders paid from the treasury,
// assaults on other clans (a 30-minute muster for both sides), and clan boss hunts led by the officers.
// No scheduler: everything (finished builds, wages, vault income, assault results, boss respawns) is settled lazily
// whenever a member of the clan touches the game.
import {clanOf, membersOf, metaOf, tellClan, addClanXp, clanCredit, raidTurn, raidView, todayStart, fortOf, fortBonus, clanHero, heroLine} from './clanPlus.js';
import {baseStats, realStats, saveStats} from './heroStats.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const HOUR = 36e5, DAY = 864e5;
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const MAX = 10;
const LEADERS = ['owner', 'officer'], SPENDERS = ['owner', 'officer', 'quartermaster'];

export const BUILD = {
  hall: {name: 'Цитадель', icon: '🏯', gold: 3000, desc: 'Сердце крепости. Открывает набеги (и делает клан их целью). Остальные здания — не выше уровня Цитадели. С 5 ур. — две стройки одновременно.'},
  walls: {name: 'Стены', icon: '🧱', gold: 2000, desc: '+300 к обороне и +10% к силе всей обороны за уровень.'},
  barracks: {name: 'Казармы', icon: '⚔️', gold: 2200, desc: '+3 места для защитников за уровень. Открывают арбалетчиков (3 ур.), рыцарей (6) и паладинов (9). +5% к силе набега.'},
  tower: {name: 'Сторожевая башня', icon: '🗼', gold: 1800, desc: '+6% к обороне за уровень. С башней видно точную оборону врага перед набегом.'},
  forge: {name: 'Кузница', icon: '⚒️', gold: 2500, desc: '+3% к атаке во всех боях с клановыми боссами и +3% к силе набега за уровень.'},
  shrine: {name: 'Святилище', icon: '⛩️', gold: 2500, desc: '−3% урона от клановых боссов за уровень. На 5 и 10 ур. — +1 зелье в каждом бою с боссом.'},
  vault: {name: 'Сокровищница', icon: '💰', gold: 3000, desc: '+25 🪙 в час в казну за уровень и прячет 6% казны за уровень от грабителей.'},
  den: {name: 'Логово охотников', icon: '🐾', gold: 2000, desc: 'Открывает клановых боссов для охоты: 1, 3, 5, 7 и 9 ур.'},
};
const F = [1, 2, 3.5, 5.5, 8, 11, 15, 20, 26, 34], HOURS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20];
export function costOf(k, lvl) { const g = Math.round(BUILD[k].gold * F[lvl - 1] / 100) * 100; return {gold: g, silver: Math.round(g * 0.4 / 10) * 10, ore: lvl >= 4 ? Math.round(6 * F[lvl - 1]) : 0}; }
export const timeOf = (k, lvl) => Math.round(HOURS[lvl - 1] * (k === 'hall' ? 1.25 : 1) * HOUR);
export const GUARDS = [
  {k: 'militia', name: 'Ополченец', icon: '🗡️', hire: 400, upkeep: 80, pw: 150, need: 0},
  {k: 'archer', name: 'Арбалетчик', icon: '🏹', hire: 1200, upkeep: 200, pw: 400, need: 3},
  {k: 'knight', name: 'Рыцарь', icon: '🛡️', hire: 3500, upkeep: 500, pw: 1000, need: 6},
  {k: 'paladin', name: 'Паладин', icon: '⚜️', hire: 9000, upkeep: 1200, pw: 2500, need: 9},
];
export const BOSSES = [
  {k: 'hydra', name: 'Болотная Гидра', icon: '🐍', den: 1, hp: 30000, img: '/assets/sprites/generated/monsters/v_ri_serpent.webp', scene: '/assets/catacombs-DeUOVUij.webp',
    text: 'Отращивает головы: каждый ход залечивает четверть полученного урона. Лучше всего — яды и кровотечения.', mod: {atk: 0.9, regen: 0.25, hitName: '🐍 Гидра кусает'}},
  {k: 'dragon', name: 'Костяной Дракон', icon: '🐉', den: 3, hp: 55000, img: '/assets/sprites/generated/monsters/m_dragon_boss.webp',
    text: 'Каждый 4-й ход — огненное дыхание ×2.6. Встаньте в защиту перед ним.', mod: {atk: 1.05, every: 4, heavy: 2.6, heavyName: '🔥 Огненное дыхание', hitName: '🐉 Дракон рвёт когтями'}},
  {k: 'titan', name: 'Ледяной Титан', icon: '🧊', den: 5, hp: 85000, img: '/assets/sprites/generated/monsters/m_stone_golem.webp',
    text: 'Ледяная броня гасит удары, а холод вытягивает ману. Нужны пробивание и сильные навыки.', mod: {atk: 1, armor: 0.33, drain: 0.05, heavyName: '❄️ Ледяная лавина', hitName: '🧊 Титан бьёт'}},
  {k: 'demon', name: 'Демон Бездны', icon: '😈', den: 7, hp: 120000, img: '/assets/sprites/generated/monsters/m_demon_lord.webp',
    text: 'Бьёт очень сильно и пьёт жизнь из каждого удара — лечится за ваш счёт.', mod: {atk: 1.3, leech: 0.3, heavyName: '🔥 Адское пламя', hitName: '😈 Демон бьёт'}},
  {k: 'lich', name: 'Король-Лич', icon: '💀', den: 9, hp: 170000, img: '/assets/sprites/generated/monsters/m_death_knight_boss.webp',
    text: 'Всё сразу: залечивает 15% урона, высасывает ману и каждый 3-й ход — волна смерти ×2.2.', mod: {atk: 1.2, regen: 0.15, drain: 0.08, heavy: 2.2, heavyName: '☠️ Волна смерти', hitName: '💀 Лич бьёт'}},
];
// Boss health grows with the clan's level and its size (a 3-man clan faces ~30% of a 10-man clan's boss).
const bossHp = (b, L, n = 10) => Math.round(b.hp * (1 + 0.12 * (Math.max(1, Math.min(15, L)) - 1)) * Math.max(0.3, Math.min(1.5, n / 10)) / 100) * 100;
const RESPAWN = 18 * HOUR, MUSTER = 30 * 60e3, SHIELD = 8 * HOUR, COOLDOWN = 12 * HOUR;

const lv = (f, k) => Number(f?.b?.[k]?.lvl) || 0;
function fortRow(world, clan, now) {
  let f = fortOf(world, clan.id);
  if (!f) { f = {clan: clan.id, b: {}, g: {}, upk_at: iso(now), inc_at: iso(now), hunt: 'hydra', bosses: {}, shield: null, atk_at: null, log: []}; rows(world, 'ae_clan_fort').push(f); }
  return f;
}
const flog = (f, now, icon, text) => { f.log.push({at: iso(now), icon, text}); if (f.log.length > 25) f.log = f.log.slice(-25); };
const slots = f => lv(f, 'hall') >= 5 ? 2 : 1;
const building = f => Object.entries(f.b).filter(([, v]) => v.until);
const capOf = f => 3 + lv(f, 'barracks') * 3;
const guardCount = f => GUARDS.reduce((s, g) => s + (f.g[g.k] || 0), 0);
const upkeepOf = f => GUARDS.reduce((s, g) => s + (f.g[g.k] || 0) * g.upkeep, 0);
const gold = c => Number(c.treasury_gold) || 0;
const heroPw = (world, id) => { const p = player(world, id); if (!p) return 0; const s = realStats(world, id, p) || baseStats(p); return Math.round((s.atk || 0) + (s.def || 0) + (s.maxHp || 0) / 10); };
const activeMembers = (world, clan, now) => membersOf(world, clan).filter(m => { const p = player(world, m.telegram_id); return p && (Date.parse(p.last_seen_at || p.updated_at || 0) || 0) > now - 3 * DAY; });
export function defenseOf(world, clan, f, now, extra = 0) {
  const guards = GUARDS.reduce((s, g) => s + (f.g[g.k] || 0) * g.pw, 0), garrison = Math.round(0.15 * activeMembers(world, clan, now).reduce((s, m) => s + heroPw(world, m.telegram_id), 0));
  return Math.round((200 + guards + lv(f, 'walls') * 300) * (1 + lv(f, 'walls') * 0.1 + lv(f, 'tower') * 0.06) + garrison + extra);
}
const attackMul = f => 1 + lv(f, 'forge') * 0.03 + lv(f, 'barracks') * 0.05;

// ---------- lazy settlement ----------
export function fortTick(world, clan, now, notify) {
  const f = fortOf(world, clan.id); if (!f) return null;
  for (const [k, v] of building(f)) if (Date.parse(v.until) <= now) {
    v.lvl = v.to; delete v.until; delete v.to; delete v.since; delete v.helps;
    flog(f, now, BUILD[k].icon, `${BUILD[k].name}: построено ${v.lvl} ур.`);
    tellClan(world, clan, `🏗️ [${clan.tag}] ${BUILD[k].icon} ${BUILD[k].name} достроена до ${v.lvl} уровня!`, `fort-built:${clan.id}:${k}:${v.lvl}`, now, notify, '🏗️');
  }
  // vault income and wages, hour by hour (at most 14 days at once)
  const hrs = t => Math.min(14 * 24, Math.floor((now - (Date.parse(t) || now)) / HOUR));
  const inc = hrs(f.inc_at);
  if (inc > 0) { f.inc_at = iso(Date.parse(f.inc_at) + inc * HOUR); const v = inc * 25 * lv(f, 'vault'); if (v) { clan.treasury_gold = gold(clan) + v; f.income = (f.income || 0) + v; } }
  const wh = hrs(f.upk_at);
  if (wh > 0) {
    f.upk_at = iso(Date.parse(f.upk_at) + wh * HOUR);
    let due = Math.ceil(upkeepOf(f) * wh / 24);
    if (due > 0) {
      const paid = Math.min(due, gold(clan)); clan.treasury_gold = gold(clan) - paid; f.wages = (f.wages || 0) + paid; due -= paid;
      const gone = [];
      while (due > 0 && guardCount(f)) { const g = [...GUARDS].reverse().find(x => f.g[x.k] > 0); f.g[g.k]--; due -= g.upkeep; gone.push(g.name); }
      if (gone.length) {
        const text = `Казна пуста — ${gone.length} защитн. ушли без жалования (${[...new Set(gone)].join(', ')}). Пополните казну!`;
        flog(f, now, '💸', text); tellClan(world, clan, `💸 [${clan.tag}] ${text}`, `fort-wages:${clan.id}:${f.upk_at}`, now, notify, '💸');
      }
    }
  }
  for (const b of BOSSES) { const s = f.bosses[b.k]; if (s && s.hp <= 0 && Date.parse(s.respawn) <= now) { s.hp = s.max = bossHp(b, Number(clan.level) || 1, membersOf(world, clan).length); delete s.respawn; s.dmg = {}; } }
  for (const a of rows(world, 'ae_clan_assaults').filter(a => !a.done && Date.parse(a.ends) <= now && (same(a.from, clan.id) || same(a.to, clan.id)))) resolveAssault(world, a, now, notify);
  return f;
}

// ---------- assaults ----------
function resolveAssault(world, a, now, notify) {
  a.done = true;
  const A = rows(world, 'clans').find(c => same(c.id, a.from)), D = rows(world, 'clans').find(c => same(c.id, a.to));
  if (!A || !D) { a.res = {cancelled: true}; return; }
  const fa = fortRow(world, A, now), fd = fortRow(world, D, now);
  const att = Math.round(a.att.reduce((s, x) => s + x.pw, 0) * attackMul(fa)), def = defenseOf(world, D, fd, now, a.def.reduce((s, x) => s + x.pw, 0));
  const ra = att * rand(0.9, 1.1), rd = def * rand(0.9, 1.1), win = a.att.length > 0 && ra > rd, ratio = ra / Math.max(1, rd);
  const res = {att, def, win, ratio: Math.round(ratio * 100) / 100, gold: 0, silver: 0, ore: 0, lostD: 0, lostA: 0};
  const lose = (f, pct) => { let n = 0; for (const g of GUARDS) { const k = Math.floor((f.g[g.k] || 0) * pct); f.g[g.k] = (f.g[g.k] || 0) - k; n += k; } return n; };
  if (win) {
    const pct = Math.min(0.25, 0.1 + 0.05 * (ratio - 1)), open = 1 - Math.min(0.6, lv(fd, 'vault') * 0.06);
    res.gold = Math.floor(gold(D) * open * pct); res.silver = Math.floor((Number(D.treasury_silver) || 0) * open * pct); res.ore = Math.floor((Number(D.treasury_ore) || 0) * open * pct * 0.8);
    D.treasury_gold = gold(D) - res.gold; D.treasury_silver = (Number(D.treasury_silver) || 0) - res.silver; D.treasury_ore = (Number(D.treasury_ore) || 0) - res.ore;
    A.treasury_gold = gold(A) + res.gold; A.treasury_silver = (Number(A.treasury_silver) || 0) + res.silver; A.treasury_ore = (Number(A.treasury_ore) || 0) + res.ore;
    res.lostD = lose(fd, 0.25); addClanXp(A, 150 + Math.min(150, a.att.length * 15));
  } else { res.lostD = lose(fd, 0.05); addClanXp(D, 100 + Math.min(100, a.def.length * 15)); }
  fd.shield = iso(now + SHIELD); a.res = res;
  const loot = [res.gold && fmt(res.gold) + ' 🪙', res.silver && fmt(res.silver) + ' 🥈', res.ore && fmt(res.ore) + ' руды'].filter(Boolean).join(', ') || 'казна пуста';
  const ta = win ? `🏆 Набег на [${D.tag}] удался! Сила ${fmt(att)} против обороны ${fmt(def)}. Добыча в казну: ${loot}.` : `🏳️ Набег на [${D.tag}] отбит: сила ${fmt(att)} против обороны ${fmt(def)}.`;
  const td = win ? `🔥 [${A.tag}] прорвал нашу оборону (${fmt(def)} против ${fmt(att)}) и унёс ${loot}.${res.lostD ? ` Погибло защитников: ${res.lostD}.` : ''} Щит на 8 ч.` : `🛡️ Мы отбили набег [${A.tag}]: оборона ${fmt(def)} против ${fmt(att)}!${res.lostD ? ` Пало защитников: ${res.lostD}.` : ''} Щит на 8 ч.`;
  flog(fa, now, win ? '🏆' : '🏳️', ta); flog(fd, now, win ? '🔥' : '🛡️', td);
  tellClan(world, A, ta, 'assault-res:' + a.id, now, notify, '⚔️'); tellClan(world, D, td, 'assault-res:' + a.id, now, notify, '🛡️');
  for (const x of [...a.att, ...a.def]) clanCredit(world, x.u, {donate: 500}, now);
}
const assaultView = (world, a, clan, me) => {
  const mine = same(a.from, clan.id), other = rows(world, 'clans').find(c => same(c.id, mine ? a.to : a.from));
  return {id: a.id, side: mine ? 'att' : 'def', foe: other ? {id: other.id, tag: other.tag, name: other.name, emblem: metaOf(world, other).emblem} : null, ends: a.ends, done: !!a.done, res: a.res || null,
    att: a.att.length, def: a.def.length, joined: (mine ? a.att : a.def).some(x => same(x.u, me)), names: (mine ? a.att : a.def).map(x => x.name).slice(0, 20), pw: (mine ? a.att : a.def).reduce((s, x) => s + x.pw, 0)};
};
function targets(world, clan, f, now) {
  const busy = new Set(rows(world, 'ae_clan_assaults').filter(a => !a.done).map(a => String(a.to)));
  return rows(world, 'clans').filter(c => !same(c.id, clan.id) && membersOf(world, c).length).map(c => {
    const g = fortOf(world, c.id), hall = lv(g, 'hall'), shield = g?.shield && Date.parse(g.shield) > now ? g.shield : null;
    const def = g ? defenseOf(world, c, g, now) : 0, exact = lv(f, 'tower') >= 1;
    return {id: c.id, tag: c.tag, name: c.name, emblem: metaOf(world, c).emblem, level: Number(c.level) || 1, members: membersOf(world, c).length, hall, shield, busy: busy.has(String(c.id)),
      def: exact ? def : null, defRange: exact ? null : [Math.round(def * 0.7 / 100) * 100, Math.round(def * 1.3 / 100) * 100], walls: lv(g, 'walls'), guards: g ? guardCount(g) : 0,
      treasury: exact ? gold(c) : null};
  }).filter(c => c.hall >= 1).sort((a, b) => Math.abs(a.level - (Number(clan.level) || 1)) - Math.abs(b.level - (Number(clan.level) || 1))).slice(0, 30);
}

// ---------- boss hunts (one fight a day per member, at the boss the officers picked) ----------
function bossState(f, b, L, n) { let s = f.bosses[b.k]; if (!s) s = f.bosses[b.k] = {hp: bossHp(b, L, n), max: bossHp(b, L, n), kills: 0}; return s; }
const huntRuns = world => rows(world, 'ae_clan_hunt_runs');
const huntView = run => { if (!run) return null; const v = raidView(run); v.phase = {...v.phase, text: v.phase.text.replace(/Страж/g, run.bossName || 'Босс')}; return {...v, boss: run.boss, bossName: run.bossFull, img: BOSSES.find(b => b.k === run.boss)?.img, text: BOSSES.find(b => b.k === run.boss)?.text}; };
function huntFinish(world, me, run, now, notify) {
  const {clan} = clanOf(world, me), p = player(world, me), L = Number(p?.level) || 1;
  if (!clan || !same(clan.id, run.clan)) { run.result = {total: 0, lost: true, reward: {}}; return run; }
  const f = fortRow(world, clan, now), b = BOSSES.find(x => x.k === run.boss), s = bossState(f, b, Number(clan.level) || 1, membersOf(world, clan).length), tier = BOSSES.indexOf(b) + 1;
  const dealt = Math.max(0, Math.min(s.hp, run.dealt)); s.hp -= dealt; s.dmg = s.dmg || {}; s.dmg[String(me)] = (s.dmg[String(me)] || 0) + dealt;
  const reward = {gold: 20 + L * 2 + Math.round(dealt / 60 * (1 + tier * 0.1)), exp: 30 + L * 6 + tier * 10};
  let killed = false;
  if (s.hp <= 0 && !s.respawn) {
    killed = true; s.hp = 0; s.respawn = iso(now + RESPAWN); s.kills = (s.kills || 0) + 1;
    const w = {gold: 1000 * tier, silver: 500 * tier, ore: 30 * tier, xp: 200 * tier};
    clan.treasury_gold = gold(clan) + w.gold; clan.treasury_silver = (Number(clan.treasury_silver) || 0) + w.silver; clan.treasury_ore = (Number(clan.treasury_ore) || 0) + w.ore; addClanXp(clan, w.xp);
    reward.fragments = 1; reward.tickets = tier >= 3 ? 1 : 0; reward.gold += 150 * tier;
    const topHit = Object.entries(s.dmg).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([u, d]) => `${nameOf(player(world, u))} ${fmt(d)}`).join(', ');
    const text = `${b.icon} [${clan.tag}] ${b.name} повержен(а)! Добил(а): ${nameOf(p)}. В казну +${fmt(w.gold)} 🪙, +${fmt(w.silver)} 🥈, +${w.ore} руды, +${w.xp} опыта клана. Лучшие: ${topHit}. Новый ${b.name} — через 18 ч.`;
    flog(f, now, b.icon, text); tellClan(world, clan, text, `hunt-kill:${clan.id}:${b.k}:${s.kills}`, now, notify, b.icon); s.dmg = {};
  }
  run.result = {total: dealt, defeated: killed, reward, combos: run.combos || 0, raidHp: Math.max(0, s.hp)};
  if (dealt > 0) clanCredit(world, me, {raid: dealt}, now, notify);
  return run;
}
function handleHunt(world, path, body, me, clan, m, f, now, notify) {
  world.tables.ae_clan_hunt_runs = huntRuns(world).filter(r => r.status === 'active' || Date.parse(r.at) > now - DAY);
  let run = huntRuns(world).filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (path === '/api/ae-clanx/fort/hunt/start') {
    if (run && run.status === 'active') return ok({run: huntView(run)});
    const b = BOSSES.find(x => x.k === f.hunt); if (!b || lv(f, 'den') < b.den) return fail('Офицеры ещё не выбрали цель охоты (нужно Логово охотников).');
    const s = bossState(f, b, Number(clan.level) || 1, membersOf(world, clan).length); if (s.hp <= 0) return fail(`${b.name} повержен(а). Новый — через ${Math.ceil((Date.parse(s.respawn) - now) / HOUR)} ч. Офицеры могут повести клан на другого босса.`);
    if (m.last_hunt && Date.parse(m.last_hunt) >= todayStart(now)) return fail('Сегодня вы уже охотились. Новый бой — в 00:00 UTC.');
    const p = player(world, me); if (body.stats) saveStats(world, me, body.stats, now);
    const hero = clanHero(world, me, p, clan.id), fb = fortBonus(world, clan.id);
    m.last_hunt = iso(now);
    run = {id: crypto.randomUUID(), u: String(me), clan: clan.id, boss: b.k, bossName: b.name.split(' ').pop(), bossFull: b.name, mod: b.mod, status: 'active', hero, hp: hero.maxHp, maxHp: hero.maxHp, mp: hero.maxMp, maxMp: hero.maxMp,
      potions: 2 + fb.potions, turn: 0, dealt: 0, bossHp0: s.hp, bossMax: s.max, foe: {dots: [], vuln: 0, stunned: 0}, barrier: 0, fury: 0, lastSkill: null, allyLast: null, allyName: null,
      log: [`${b.icon} ${b.name} выходит на бой! ${b.text}`, heroLine(hero)], at: iso(now)};
    huntRuns(world).push(run);
    return ok({run: huntView(run)}, 201);
  }
  if (!run) return fail('Боя нет.', 404);
  if (path === '/api/ae-clanx/fort/hunt/act') {
    if (run.status !== 'active') return ok({run: huntView(run)});
    raidTurn(world, me, run, ['attack', 'skill', 'defend', 'potion'].includes(body.action) ? body.action : 'attack', body.skillId); run.at = iso(now);
    if (run.status === 'ended') huntFinish(world, me, run, now, notify);
    return ok({run: huntView(run)});
  }
  if (path === '/api/ae-clanx/fort/hunt/leave') {
    if (run.status === 'active') { run.status = 'ended'; run.log.push('🏃 Вы отступили — нанесённый урон засчитан.'); huntFinish(world, me, run, now, notify); }
    return ok({run: huntView(run)});
  }
  if (path === '/api/ae-clanx/fort/hunt/claim') {
    if (run.status !== 'ended' || !run.result) return fail('Сначала завершите бой.');
    if (run.claimed) return ok({reward: run.result.reward, alreadyClaimed: true});
    run.claimed = true; return ok({reward: run.result.reward});
  }
  return fail('API не найден.', 404);
}

// ---------- the fort overview ----------
function view(world, me, clan, m, f, now) {
  const L = Number(clan.level) || 1, used = building(f).length, n = membersOf(world, clan).length;
  const blds = Object.entries(BUILD).map(([k, d]) => { const cur = f.b[k] || {}, l = cur.lvl || 0, next = Math.min(MAX, (cur.to || l) + (cur.until ? 0 : 1));
    const block = l >= MAX ? 'Максимальный уровень' : cur.until ? null : k !== 'hall' && next > lv(f, 'hall') ? `Нужна Цитадель ${next} ур.` : k === 'hall' && L < next - 2 ? `Нужен ${next - 2} уровень клана` : null;
    return {k, ...d, lvl: l, building: cur.until ? {to: cur.to, until: cur.until, since: cur.since, helps: (cur.helps || []).length, helped: (cur.helps || []).includes(String(me))} : null,
      next: l >= MAX ? null : {lvl: next, cost: costOf(k, next), time: timeOf(k, next)}, block}; });
  const act = rows(world, 'ae_clan_assaults').filter(a => !a.done && (same(a.from, clan.id) || same(a.to, clan.id))).map(a => assaultView(world, a, clan, me));
  const past = rows(world, 'ae_clan_assaults').filter(a => a.done && a.res && !a.res.cancelled && (same(a.from, clan.id) || same(a.to, clan.id))).slice(-8).reverse().map(a => assaultView(world, a, clan, me));
  const hunt = BOSSES.map(b => { const s = f.bosses[b.k]; return {k: b.k, name: b.name, icon: b.icon, img: b.img, text: b.text, den: b.den, open: lv(f, 'den') >= b.den, hp: s ? s.hp : bossHp(b, L, n), max: s ? s.max : bossHp(b, L, n), respawn: s?.hp <= 0 ? s.respawn : null, kills: s?.kills || 0,
    reward: {gold: 1000 * (BOSSES.indexOf(b) + 1), silver: 500 * (BOSSES.indexOf(b) + 1), ore: 30 * (BOSSES.indexOf(b) + 1), xp: 200 * (BOSSES.indexOf(b) + 1)}}; });
  const run = huntRuns(world).filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  return {role: m.role, lead: LEADERS.includes(m.role), spend: SPENDERS.includes(m.role), clanLevel: L,
    treasury: {gold: gold(clan), silver: Number(clan.treasury_silver) || 0, ore: Number(clan.treasury_ore) || 0},
    buildings: blds, slots: slots(f), busy: used,
    guards: GUARDS.map(g => ({...g, n: f.g[g.k] || 0, open: lv(f, 'barracks') >= g.need})), cap: capOf(f), count: guardCount(f), upkeep: upkeepOf(f), income: lv(f, 'vault') * 25 * 24,
    defense: defenseOf(world, clan, f, now), attackMul: Math.round(attackMul(f) * 100), myPw: heroPw(world, me),
    shield: f.shield && Date.parse(f.shield) > now ? f.shield : null, cooldown: f.atk_at && Date.parse(f.atk_at) + COOLDOWN > now ? iso(Date.parse(f.atk_at) + COOLDOWN) : null,
    assaults: act, history: past, hunt: {target: f.hunt, bosses: hunt, doneToday: !!(m.last_hunt && Date.parse(m.last_hunt) >= todayStart(now)),
      run: run && (run.status === 'active' || (run.result && !run.claimed)) ? huntView(run) : null},
    bonus: fortBonus(world, clan.id), log: f.log.slice(-15).reverse()};
}

export function handleFort(world, path, method, body, me, now, notify) {
  const {clan, m} = clanOf(world, me); if (!clan) return fail('Вы не в клане.');
  const f = fortRow(world, clan, now); fortTick(world, clan, now, notify);
  if (path.startsWith('/api/ae-clanx/fort/hunt/')) return handleHunt(world, path, body || {}, me, clan, m, f, now, notify);
  if (path === '/api/ae-clanx/fort' && method === 'GET') return ok(view(world, me, clan, m, f, now));
  if (path === '/api/ae-clanx/fort/targets') return ok({targets: targets(world, clan, f, now)});
  if (method !== 'POST') return fail('API не найден.', 404);
  const done = () => ok(view(world, me, clan, m, f, now)), p = player(world, me);
  if (path === '/api/ae-clanx/fort/build') {
    if (!SPENDERS.includes(m.role)) return fail('Строить могут глава, офицеры и казначей.', 403);
    const k = String(body.key || ''), d = BUILD[k]; if (!d) return fail('Нет такого здания.');
    const cur = f.b[k] ||= {lvl: 0};
    if (cur.until) return fail('Это здание уже строится.');
    if (building(f).length >= slots(f)) return fail(slots(f) > 1 ? 'Уже идут две стройки.' : 'Уже идёт стройка. С Цитаделью 5 ур. можно строить два здания сразу.');
    const next = (cur.lvl || 0) + 1; if (next > MAX) return fail('Максимальный уровень.');
    if (k !== 'hall' && next > lv(f, 'hall')) return fail(`Сначала поднимите Цитадель до ${next} ур.`);
    if (k === 'hall' && (Number(clan.level) || 1) < next - 2) return fail(`Нужен ${next - 2} уровень клана.`);
    const c = costOf(k, next);
    if (gold(clan) < c.gold || (Number(clan.treasury_silver) || 0) < c.silver || (Number(clan.treasury_ore) || 0) < c.ore) return fail(`В казне не хватает: нужно ${fmt(c.gold)} 🪙, ${fmt(c.silver)} 🥈${c.ore ? `, ${c.ore} руды` : ''}.`);
    clan.treasury_gold = gold(clan) - c.gold; clan.treasury_silver = Number(clan.treasury_silver) - c.silver; clan.treasury_ore = (Number(clan.treasury_ore) || 0) - c.ore;
    Object.assign(cur, {to: next, since: iso(now), until: iso(now + timeOf(k, next)), helps: []});
    flog(f, now, '🏗️', `${nameOf(p)} начал(а) стройку: ${d.name} ${next} ур. (${fmt(c.gold)} 🪙)`);
    tellClan(world, clan, `🏗️ [${clan.tag}] Началась стройка: ${d.icon} ${d.name} ${next} ур. Помогите в Крепости клана — каждая помощь ускоряет на 3%!`, `fort-start:${clan.id}:${k}:${next}`, now, null, '🏗️');
    return done();
  }
  if (path === '/api/ae-clanx/fort/help') {
    const cur = f.b[String(body.key || '')]; if (!cur?.until) return fail('Здесь ничего не строится.');
    cur.helps ||= []; if (cur.helps.includes(String(me))) return fail('Вы уже помогли этой стройке.');
    if (cur.helps.length >= 15) return fail('Стройке уже помогли 15 соклановцев — больше рабочих рук не нужно.');
    const total = Date.parse(cur.until) - Date.parse(cur.since), cut = Math.max(2 * 60e3, Math.round(total * 0.03));
    cur.helps.push(String(me)); cur.until = iso(Math.max(now, Date.parse(cur.until) - cut));
    clanCredit(world, me, {donate: 100}, now);
    fortTick(world, clan, now, notify);
    return ok({...view(world, me, clan, m, f, now), cut});
  }
  if (path === '/api/ae-clanx/fort/cancel') {
    if (!LEADERS.includes(m.role)) return fail('Отменить стройку могут глава и офицеры.', 403);
    const k = String(body.key || ''), cur = f.b[k]; if (!cur?.until) return fail('Здесь ничего не строится.');
    const c = costOf(k, cur.to); clan.treasury_gold = gold(clan) + Math.round(c.gold / 2); clan.treasury_silver = (Number(clan.treasury_silver) || 0) + Math.round(c.silver / 2); clan.treasury_ore = (Number(clan.treasury_ore) || 0) + Math.round(c.ore / 2);
    delete cur.until; delete cur.to; delete cur.since; delete cur.helps;
    flog(f, now, '✖️', `${nameOf(p)} отменил(а) стройку: ${BUILD[k].name} (вернулась половина стоимости)`);
    return done();
  }
  if (path === '/api/ae-clanx/fort/hire') {
    if (!SPENDERS.includes(m.role)) return fail('Нанимать защитников могут глава, офицеры и казначей.', 403);
    const g = GUARDS.find(x => x.k === body.kind); if (!g) return fail('Нет такого защитника.');
    if (lv(f, 'barracks') < g.need) return fail(`Нужны Казармы ${g.need} ур.`);
    const n = Math.max(1, Math.min(50, Math.floor(Number(body.n) || 1)));
    if (guardCount(f) + n > capOf(f)) return fail(`Мест в казармах: ${capOf(f) - guardCount(f)} из ${capOf(f)}. Улучшайте Казармы (+3 места за уровень).`);
    const cost = g.hire * n; if (gold(clan) < cost + g.upkeep * n) return fail(`Нужно ${fmt(cost)} 🪙 на найм и запас на первый день жалования (${fmt(g.upkeep * n)} 🪙).`);
    clan.treasury_gold = gold(clan) - cost; f.g[g.k] = (f.g[g.k] || 0) + n;
    flog(f, now, g.icon, `${nameOf(p)} нанял(а): ${g.name} ×${n} (${fmt(cost)} 🪙, жалование ${fmt(g.upkeep * n)} 🪙/сутки)`);
    return done();
  }
  if (path === '/api/ae-clanx/fort/dismiss') {
    if (!SPENDERS.includes(m.role)) return fail('Распускать защитников могут глава, офицеры и казначей.', 403);
    const g = GUARDS.find(x => x.k === body.kind); if (!g || !f.g[g.k]) return fail('Таких защитников нет.');
    const n = Math.max(1, Math.min(f.g[g.k], Math.floor(Number(body.n) || 1))); f.g[g.k] -= n;
    flog(f, now, '👋', `${nameOf(p)} распустил(а): ${g.name} ×${n}`);
    return done();
  }
  if (path === '/api/ae-clanx/fort/target') {
    if (!LEADERS.includes(m.role)) return fail('Вести клан на босса могут глава и офицеры.', 403);
    const b = BOSSES.find(x => x.k === body.boss); if (!b) return fail('Нет такого босса.');
    if (lv(f, 'den') < b.den) return fail(`Нужно Логово охотников ${b.den} ур.`);
    if (f.hunt === b.k) return done();
    f.hunt = b.k; flog(f, now, b.icon, `${nameOf(p)} ведёт клан на охоту: ${b.name}`);
    tellClan(world, clan, `${b.icon} [${clan.tag}] ${nameOf(p)} ведёт клан на охоту: ${b.name}! ${b.text} Бой — в Крепости клана, раз в сутки.`, `hunt-target:${clan.id}:${b.k}:${now}`, now, notify, b.icon);
    return done();
  }
  if (path === '/api/ae-clanx/fort/assault') {
    if (!LEADERS.includes(m.role)) return fail('Объявить набег могут глава и офицеры.', 403);
    if (lv(f, 'hall') < 1) return fail('Сначала постройте Цитадель.');
    if (f.atk_at && Date.parse(f.atk_at) + COOLDOWN > now) return fail(`Войска отдыхают после набега: ещё ${Math.ceil((Date.parse(f.atk_at) + COOLDOWN - now) / HOUR)} ч.`);
    if (rows(world, 'ae_clan_assaults').some(a => !a.done && same(a.from, clan.id))) return fail('Набег уже собирается.');
    const D = rows(world, 'clans').find(c => same(c.id, body.clanId)); if (!D || same(D.id, clan.id)) return fail('Клан не найден.', 404);
    const fd = fortOf(world, D.id); if (lv(fd, 'hall') < 1) return fail('У этого клана нет Цитадели — он под защитой короны.');
    if (fd.shield && Date.parse(fd.shield) > now) return fail('Клан под щитом после недавнего набега.');
    if (rows(world, 'ae_clan_assaults').some(a => !a.done && same(a.to, D.id))) return fail('На этот клан уже идёт набег.');
    const a = {id: crypto.randomUUID(), from: clan.id, to: D.id, at: iso(now), ends: iso(now + MUSTER), att: [{u: String(me), name: nameOf(p), pw: heroPw(world, me)}], def: [], done: false};
    rows(world, 'ae_clan_assaults').push(a); f.atk_at = iso(now);
    flog(f, now, '⚔️', `${nameOf(p)} объявил(а) набег на [${D.tag}] «${D.name}»`); flog(fd, now, '🚨', `[${clan.tag}] «${clan.name}» собирает набег на нас!`);
    tellClan(world, clan, `⚔️ [${clan.tag}] ${nameOf(p)} собирает набег на [${D.tag}] «${D.name}»! 30 минут на сбор — вступайте в Крепости клана.`, 'assault-a:' + a.id, now, notify, '⚔️');
    tellClan(world, D, `🚨 [${clan.tag}] «${clan.name}» идёт на нас набегом! Через 30 минут — штурм. Встаньте на стены в Крепости клана!`, 'assault-d:' + a.id, now, notify, '🚨');
    return done();
  }
  if (path === '/api/ae-clanx/fort/join') {
    const a = rows(world, 'ae_clan_assaults').find(x => x.id === body.id && !x.done); if (!a) return fail('Сбор уже закончился.');
    const side = same(a.from, clan.id) ? a.att : same(a.to, clan.id) ? a.def : null; if (!side) return fail('Это не ваш бой.');
    if (side.some(x => same(x.u, me))) return fail('Вы уже в строю.');
    side.push({u: String(me), name: nameOf(p), pw: heroPw(world, me)});
    return done();
  }
  return fail('API не найден.', 404);
}

// Maintenance: keep the assault log short.
export function pruneFort(world, now) {
  if (world.tables.ae_clan_assaults) world.tables.ae_clan_assaults = world.tables.ae_clan_assaults.filter(a => !a.done || Date.parse(a.ends) > now - 7 * DAY);
  if (world.tables.ae_clan_fort) { const ids = new Set(rows(world, 'clans').map(c => String(c.id))); world.tables.ae_clan_fort = world.tables.ae_clan_fort.filter(f => ids.has(String(f.clan))); }
}
