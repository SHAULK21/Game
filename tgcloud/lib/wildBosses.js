// Wandering bosses: six giants (levels 20–120) roam the kingdom's lands and move every 3 hours.
// A clan sends scout squads to a land; scouts that catch a boss there open a 6-hour summons for the whole clan:
// shared health, 3 fights a day per member (alone or with a companion), rewards per fight and a share of the kill by damage.
// Everything is settled lazily (no scheduler), like the fortress and the lands.
import {clanOf, membersOf, tellClan, addClanXp, clanCredit, raidTurn, raidView, todayStart, fortOf, clanHero, heroLine} from './clanPlus.js';
import {saveStats} from './heroStats.js';
import {compStats, compImg} from './companions.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const HOUR = 36e5, DAY = 864e5;
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const LEADERS = ['owner', 'officer'], SPENDERS = ['owner', 'officer', 'quartermaster'];

export const REGIONS = [['reg_plains', 'Зелёные равнины'], ['reg_whisper_woods', 'Шепчущий лес'], ['reg_forest', 'Тёмный лес'], ['reg_forgotten_crypt', 'Забытый склеп'], ['reg_swamp', 'Топкие болота'],
  ['reg_desert', 'Пустыня'], ['reg_cursed', 'Проклятые земли'], ['reg_rift', 'Демонический разлом'], ['reg_dragon', 'Драконий сандор']];
export const WILD = [
  {k: 'grokh', lvl: 20, scout: 1, name: 'Каменный Великан Грох', icon: '🗿', img: '/assets/sprites/generated/monsters/m_stone_golem.webp', text: 'Медленный, но бьёт как обвал. Каждый 3-й ход — удар ×2.',
    mod: {atk: 1, heavyName: '🪨 Обвал', hitName: '🗿 Грох бьёт'}},
  {k: 'shaar', lvl: 40, scout: 2, name: 'Песчаный Змей Шаар', icon: '🐍', img: '/assets/sprites/generated/monsters/v_ri_serpent.webp', text: 'Зарывается в песок и залечивает 15% полученного урона.',
    mod: {atk: 1, regen: 0.15, hitName: '🐍 Шаар кусает'}},
  {k: 'colossus', lvl: 60, scout: 4, name: 'Костяной Колосс', icon: '💀', img: '/assets/sprites/generated/monsters/v_cr_colossus.webp', text: 'Броня из костей гасит удары: нужны пробивание и навыки.',
    mod: {atk: 1.05, armor: 0.33, heavyName: '☠️ Костяная лавина', hitName: '💀 Колосс бьёт'}},
  {k: 'azgaroth', lvl: 80, scout: 6, name: 'Владыка Бездны Аз’гарот', icon: '😈', img: '/assets/sprites/generated/monsters/m_demon_lord.webp', text: 'Пьёт жизнь из каждого удара и вытягивает ману.',
    mod: {atk: 1.2, leech: 0.25, drain: 0.05, heavyName: '🔥 Адское пламя', hitName: '😈 Аз’гарот бьёт'}},
  {k: 'irrash', lvl: 100, scout: 8, name: 'Пепельный Змей Ирраш', icon: '🐉', img: '/assets/sprites/generated/monsters/m_rift_drake.webp', text: 'Каждый 4-й ход — пепельное дыхание ×2.6. Встаньте в защиту.',
    mod: {atk: 1.15, every: 4, heavy: 2.6, heavyName: '🌋 Пепельное дыхание', hitName: '🐉 Ирраш рвёт когтями'}},
  {k: 'pradrakon', lvl: 120, scout: 10, name: 'Прадракон Аэтельгор', icon: '👑', img: '/assets/sprites/generated/monsters/m_dragon_boss.webp', text: 'Всё сразу: регенерация, броня, вытягивание маны и дыхание ×2.4 каждый 3-й ход.',
    mod: {atk: 1.25, regen: 0.1, armor: 0.38, drain: 0.06, heavy: 2.4, heavyName: '☀️ Первородное пламя', hitName: '👑 Прадракон бьёт'}}];
const MAX_SCOUT = 10, SUMMONS = 6 * HOUR, COOLDOWN = 12 * HOUR, FIGHTS = 3, MOVE = 3 * HOUR;

// where a boss is at a time (moves every 3 hours, deterministic)
const hashK = k => [...k].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const regionAt = (b, t) => REGIONS[(hashK(b.k) + Math.floor(t / MOVE) * (3 + (hashK(b.k) % 5))) % REGIONS.length][0];
const regionName = id => REGIONS.find(r => r[0] === id)?.[1] || id;
// scouting by level: squads, time, chance
export const scoutOf = lvl => ({lvl, squads: Math.min(4, 1 + Math.floor(lvl / 3)), minutes: Math.max(20, 60 - 4 * lvl), chance: Math.min(0.95, 0.45 + 0.05 * lvl)});
export const scoutCost = lvl => Math.round(3000 * Math.pow(1.7, lvl - 1) / 100) * 100;
// a hero of level L hits a boss for about this much in one 12-turn fight → health for ~15 fights, scaled by clan size
const atkRef = L => (18 + 7 * L) * (1 + L / 25);
const bossHp = (b, n) => Math.round(15 * 12 * 0.6 * atkRef(b.lvl) * Math.max(0.5, Math.min(2, n / 6)) / 100) * 100;
// a hero above the boss gets much less, below — more
export const levelMul = (heroL, bossL) => { const d = heroL - bossL; return d > 0 ? Math.max(0.2, 1 - 0.03 * d) : Math.min(1.5, 1 + 0.02 * -d); };
const killPool = b => { const t = WILD.indexOf(b) + 1; return {gold: 2500 * t, exp: 1500 * t * t, fragments: t, silver: 800 * t}; };

function wildRow(world, clan) {
  let w = rows(world, 'ae_wild').find(x => same(x.clan, clan.id));
  if (!w) { w = {clan: clan.id, scout: 1, squads: [], found: {}, cool: {}, log: []}; rows(world, 'ae_wild').push(w); }
  return w;
}
const wlog = (w, now, icon, text) => { w.log.push({at: iso(now), icon, text}); if (w.log.length > 15) w.log = w.log.slice(-15); };

export function wildTick(world, clan, now, notify) {
  const w = rows(world, 'ae_wild').find(x => same(x.clan, clan.id)); if (!w) return null;
  const sc = scoutOf(w.scout);
  for (const s of w.squads) {
    if (s.done || Date.parse(s.ends) > now) continue;
    s.done = true; const at = Date.parse(s.ends);
    const here = WILD.filter(b => regionAt(b, at) === s.region && w.scout >= b.scout && !(w.found[b.k] && Date.parse(w.found[b.k].until) > at) && !(w.cool[b.k] && Date.parse(w.cool[b.k]) > at));
    const b = here.find(() => Math.random() < sc.chance);
    if (b) {
      const n = membersOf(world, clan).length, max = bossHp(b, n);
      w.found[b.k] = {hp: max, max, region: s.region, at: iso(at), until: iso(at + SUMMONS), finder: s.by, finderName: s.byName, dmg: {}, names: {}};
      s.result = {found: b.k};
      const text = `${b.icon} [${clan.tag}] Разведка нашла ${b.name} (${b.lvl} ур.) — ${regionName(s.region)}! Созыв клана на 6 часов: бейте всем кланом в «Бродячих боссах».`;
      wlog(w, now, b.icon, text); tellClan(world, clan, text, `wild-found:${clan.id}:${b.k}:${at}`, now, notify, b.icon);
    } else {
      // no catch: a trace of a boss the scouts can track, with where it is heading
      const open = WILD.filter(x => w.scout >= x.scout), t = open[Math.floor(Math.random() * open.length)];
      const hint = t ? `следы ${t.name} ведут в «${regionName(regionAt(t, at + MOVE))}» (через ${Math.max(1, Math.round((MOVE - at % MOVE) / HOUR))} ч)` : '';
      s.result = {found: null, hint};
      wlog(w, now, '🔭', `Разведка в «${regionName(s.region)}» вернулась ни с чем${hint ? ': ' + hint : ''}.`);
    }
  }
  w.squads = w.squads.filter(s => !s.done || Date.parse(s.ends) > now - DAY).slice(-12);
  for (const b of WILD) { const f = w.found[b.k]; if (f && f.hp > 0 && Date.parse(f.until) <= now) { wlog(w, now, '💨', `${b.name} ушёл бродить дальше (осталось ${fmt(f.hp)} HP).`); delete w.found[b.k]; } }
  return w;
}

const runs = world => rows(world, 'ae_wild_runs');
const runView = run => { if (!run) return null; const v = raidView(run); const b = WILD.find(x => x.k === run.boss); v.phase = {...v.phase, name: String(v.phase.name || '').replace(/\s*врат/i, '').replace('Каменный щит', 'Свежие силы'), text: v.phase.text.replace(/Страж/g, b?.name.split(' ').pop() || 'Босс')};
  return {...v, boss: run.boss, bossName: b?.name, img: b?.img, text: b?.text, scene: `/assets/regions/region-${run.region}.webp`, comp: run.comp ? {name: run.comp.name, img: run.comp.img} : null}; };

function finish(world, me, run, now, notify) {
  const {clan} = clanOf(world, me), p = player(world, me), L = Number(p?.level) || 1, b = WILD.find(x => x.k === run.boss);
  if (!clan || !b) { run.result = {total: 0, reward: {}}; return; }
  const w = wildRow(world, clan), f = w.found[b.k], mul = levelMul(L, b.lvl);
  const dealt = f ? Math.max(0, Math.min(f.hp, run.dealt)) : 0;
  if (f) { f.hp -= dealt; f.dmg[String(me)] = (f.dmg[String(me)] || 0) + dealt; f.names[String(me)] = nameOf(p); }
  const reward = {gold: Math.round((20 + b.lvl * 3 + dealt / 50) * mul), exp: Math.round((40 + b.lvl * 8) * mul)};
  let killed = false;
  if (f && f.hp <= 0) {
    killed = true; const total = Object.values(f.dmg).reduce((s, x) => s + x, 0) || 1, pool = killPool(b), t = WILD.indexOf(b) + 1;
    for (const [u, d] of Object.entries(f.dmg)) {
      const share = d / total, pl = player(world, u), m = levelMul(Number(pl?.level) || 1, b.lvl), finder = same(u, f.finder) ? 1.2 : 1;
      const r = {gold: Math.round(pool.gold * share * m * finder), silver: Math.round(pool.silver * share * m * finder), exp: Math.round(pool.exp * share * m * finder), fragments: Math.max(share >= 0.1 ? 1 : 0, Math.round(pool.fragments * share * 2))};
      rows(world, 'ae_wild_rewards').push({u: String(u), boss: b.k, name: b.name, share: Math.round(share * 1000) / 10, reward: r, unique: Math.random() < Math.min(0.9, 0.2 + share), at: iso(now)});
    }
    clan.treasury_gold = (Number(clan.treasury_gold) || 0) + 1000 * t; addClanXp(clan, 150 * t);
    const top = Object.entries(f.dmg).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([u, d]) => `${f.names[u] || 'Игрок'} ${fmt(d)}`).join(', ');
    const text = `${b.icon} [${clan.tag}] ${b.name} повержен! Добил(а): ${nameOf(p)}. Лучший урон: ${top}. Награды по доле урона ждут в «Бродячих боссах».`;
    wlog(w, now, '🏆', text); tellClan(world, clan, text, `wild-kill:${clan.id}:${b.k}:${now}`, now, notify, '🏆');
    delete w.found[b.k]; w.cool[b.k] = iso(now + COOLDOWN);
  }
  run.result = {total: dealt, defeated: killed, reward, raidHp: Math.max(0, f ? f.hp : 0), mul: Math.round(mul * 100)};
  if (dealt > 0) clanCredit(world, me, {raid: dealt}, now, notify);
}

function view(world, me, clan, m, w, now) {
  const p = player(world, me), L = Number(p?.level) || 1, sc = scoutOf(w.scout), day = todayStart(now), used = m.wild_day === day ? m.wild_n || 0 : 0;
  const run = runs(world).filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const bosses = WILD.map(b => { const f = w.found[b.k], cool = w.cool[b.k] && Date.parse(w.cool[b.k]) > now ? w.cool[b.k] : null;
    let inst = null;
    if (f) { const total = Object.values(f.dmg).reduce((s, x) => s + x, 0), mine = f.dmg[String(me)] || 0, list = Object.entries(f.dmg).sort((x, y) => y[1] - x[1]);
      const share = total ? mine / Math.max(total, f.max - f.hp) : 0, pool = killPool(b), mul = levelMul(L, b.lvl);
      inst = {hp: f.hp, max: f.max, until: f.until, region: regionName(f.region), regionId: f.region, finder: f.finderName, fighters: list.length, mine, place: mine ? list.findIndex(([u]) => same(u, me)) + 1 : null,
        top: list.slice(0, 5).map(([u, d]) => ({name: f.names[u] || 'Игрок', dmg: d, me: same(u, me)})), expected: {gold: Math.round(pool.gold * share * mul), exp: Math.round(pool.exp * share * mul), share: Math.round(share * 1000) / 10}}; }
    return {k: b.k, name: b.name, icon: b.icon, img: b.img, text: b.text, lvl: b.lvl, scoutNeed: b.scout, open: w.scout >= b.scout, canFight: L >= b.lvl - 10, mul: Math.round(levelMul(L, b.lvl) * 100), cool, inst}; });
  const comps = rows(world, 'ae_companions').filter(c => same(c.u, me)).map(c => { const s = compStats(c); return {id: c.id, name: c.name, img: compImg(c), lvl: c.lvl || 1, atk: s.atk}; });
  return {role: m.role, spend: SPENDERS.includes(m.role), hasCitadel: (Number(fortOf(world, clan.id)?.b?.hall?.lvl) || 0) >= 1, treasury: Number(clan.treasury_gold) || 0, myLevel: L,
    scout: {...sc, next: w.scout >= MAX_SCOUT ? null : {lvl: w.scout + 1, cost: scoutCost(w.scout + 1), effect: scoutOf(w.scout + 1)}, busy: w.squads.filter(s => !s.done).length,
      trips: w.squads.slice().reverse().slice(0, 8).map(s => ({region: regionName(s.region), regionId: s.region, ends: s.ends, by: s.byName, done: !!s.done, result: s.result || null}))},
    regions: REGIONS.map(([id, name]) => ({id, name})), bosses, fights: {left: Math.max(0, FIGHTS - used), max: FIGHTS}, comps,
    run: run && (run.status === 'active' || (run.result && !run.claimed)) ? runView(run) : null,
    rewards: rows(world, 'ae_wild_rewards').filter(r => same(r.u, me)).map(r => ({boss: r.boss, name: r.name, share: r.share, reward: r.reward, unique: r.unique})), log: w.log.slice(-10).reverse()};
}

export function handleWild(world, path, method, body, me, now, notify) {
  const {clan, m} = clanOf(world, me); if (!clan) return fail('Вы не в клане. Бродячих боссов выслеживают кланы.');
  const w = wildRow(world, clan); wildTick(world, clan, now, notify);
  world.tables.ae_wild_runs = runs(world).filter(r => r.status === 'active' || Date.parse(r.at) > now - DAY);
  if (path === '/api/ae-clanx/wild' && method === 'GET') return ok(view(world, me, clan, m, w, now));
  if (method !== 'POST') return fail('API не найден.', 404);
  const p = player(world, me), done = extra => ok({...view(world, me, clan, m, w, now), ...extra});
  if (path === '/api/ae-clanx/wild/scout') {
    if (!((Number(fortOf(world, clan.id)?.b?.hall?.lvl) || 0) >= 1)) return fail('Сначала постройте Цитадель в Крепости клана.');
    const region = REGIONS.find(r => r[0] === body.region); if (!region) return fail('Выберите землю.');
    const sc = scoutOf(w.scout); if (w.squads.filter(s => !s.done).length >= sc.squads) return fail(`Все отряды разведки в пути (${sc.squads}). Улучшайте разведку — будет больше отрядов.`);
    if (w.squads.some(s => !s.done && s.region === region[0])) return fail('В эту землю уже ушла разведка.');
    w.squads.push({region: region[0], by: String(me), byName: nameOf(p), at: iso(now), ends: iso(now + sc.minutes * 60e3)});
    wlog(w, now, '🔭', `${nameOf(p)} отправил(а) разведку в «${region[1]}» (${sc.minutes} мин).`);
    return done();
  }
  if (path === '/api/ae-clanx/wild/upgrade') {
    if (!SPENDERS.includes(m.role)) return fail('Улучшать разведку могут глава, офицеры и казначей.', 403);
    if (w.scout >= MAX_SCOUT) return fail('Разведка на максимальном уровне.');
    const cost = scoutCost(w.scout + 1); if ((Number(clan.treasury_gold) || 0) < cost) return fail(`В казне не хватает: нужно ${fmt(cost)} 🪙.`);
    clan.treasury_gold = Number(clan.treasury_gold) - cost; w.scout++;
    wlog(w, now, '⬆️', `${nameOf(p)} улучшил(а) разведку до ${w.scout} ур. (${fmt(cost)} 🪙).`);
    return done();
  }
  if (path === '/api/ae-clanx/wild/collect') {  // kill rewards waiting for this player
    const mine = rows(world, 'ae_wild_rewards').filter(r => same(r.u, me)); if (!mine.length) return fail('Наград пока нет.');
    world.tables.ae_wild_rewards = rows(world, 'ae_wild_rewards').filter(r => !same(r.u, me));
    const sum = {gold: 0, silver: 0, exp: 0, fragments: 0}; for (const r of mine) for (const k of Object.keys(sum)) sum[k] += r.reward[k] || 0;
    return ok({reward: sum, unique: mine.filter(r => r.unique).length, bosses: mine.map(r => r.name)});
  }
  let run = runs(world).filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (path === '/api/ae-clanx/wild/start') {
    if (run && run.status === 'active') return ok({run: runView(run)});
    const b = WILD.find(x => x.k === body.boss), f = b && w.found[b.k]; if (!f) return fail('Этого босса сейчас нет — отправьте разведку.');
    const L = Number(p?.level) || 1; if (L < b.lvl - 10) return fail(`${b.name} слишком силён: нужен ${b.lvl - 10} уровень.`);
    const day = todayStart(now); if (m.wild_day !== day) { m.wild_day = day; m.wild_n = 0; }
    if (m.wild_n >= FIGHTS) return fail(`Сегодня вы уже ${FIGHTS} раза бились с бродячими боссами. Новые бои — в 00:00 UTC.`);
    if (body.stats) saveStats(world, me, body.stats, now);
    let comp = null; if (body.comp) { const c = rows(world, 'ae_companions').find(x => same(x.u, me) && same(x.id, body.comp)); if (c) comp = {name: c.name, img: compImg(c), atk: compStats(c).atk}; }
    m.wild_n++;
    const hero = clanHero(world, me, p, clan.id);
    run = {id: crypto.randomUUID(), u: String(me), clan: clan.id, boss: b.k, region: f.region, bossName: b.name.split(' ').pop(), bossFull: b.name, mod: b.mod, status: 'active', hero, hp: hero.maxHp, maxHp: hero.maxHp, mp: hero.maxMp, maxMp: hero.maxMp,
      potions: 2, turn: 0, dealt: 0, bossHp0: f.hp, bossMax: f.max, foe: {dots: [], vuln: 0, stunned: 0}, barrier: 0, fury: 0, lastSkill: null, allyLast: null, allyName: null, comp,
      log: [`${b.icon} ${b.name} (${b.lvl} ур.) — ${regionName(f.region)}. ${b.text}`, heroLine(hero), ...(comp ? [`🛡️ С вами соратник ${comp.name} — он бьёт каждый ход.`] : [])], at: iso(now)};
    runs(world).push(run);
    return ok({run: runView(run)}, 201);
  }
  if (!run) return fail('Боя нет.', 404);
  if (path === '/api/ae-clanx/wild/act') {
    if (run.status !== 'active') return ok({run: runView(run)});
    const tr = raidTurn(world, me, run, ['attack', 'skill', 'defend', 'potion', 'item'].includes(body.action) ? body.action : 'attack', body.skillId, body.item); if (tr?.error) return fail(tr.error); run.at = iso(now);
    if (run.status === 'ended') finish(world, me, run, now, notify);
    return ok({run: runView(run)});
  }
  if (path === '/api/ae-clanx/wild/leave') {
    if (run.status === 'active') { run.status = 'ended'; run.log.push('🏃 Вы отступили — нанесённый урон засчитан.'); finish(world, me, run, now, notify); }
    return ok({run: runView(run)});
  }
  if (path === '/api/ae-clanx/wild/claim') {
    if (run.status !== 'ended' || !run.result) return fail('Сначала завершите бой.');
    if (run.claimed) return ok({reward: run.result.reward, alreadyClaimed: true});
    run.claimed = true; return ok({reward: run.result.reward});
  }
  return fail('API не найден.', 404);
}

// «Сегодня в клане»: found wandering bosses this player may fight, waiting rewards, idle scouts. Read-only.
export function wildToday(world, clan, m, me, now) {
  const out = [], mineR = (world.tables.ae_wild_rewards || []).filter(r => same(r.u, me));
  if (mineR.length) out.push({k: 'wild-reward', icon: '🎁', title: 'Награда за бродячего босса', sub: mineR.map(r => r.name).join(', '), go: 'wild', pri: 0});
  const run = (world.tables.ae_wild_runs || []).filter(r => same(r.u, me)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (run?.status === 'active') out.push({k: 'wild-run', icon: '⚔️', title: 'Бой с бродячим боссом идёт', sub: run.bossFull || '', go: 'wild', pri: 1});
  else if (run?.result && !run.claimed) out.push({k: 'wild-run', icon: '🎁', title: 'Итог боя с боссом', sub: run.bossFull || '', go: 'wild', pri: 0});
  const w = (world.tables.ae_wild || []).find(x => same(x.clan, clan.id)); if (!w) return out;
  const L = Number(player(world, me)?.level) || 1, left = FIGHTS - (m.wild_day === todayStart(now) ? m.wild_n || 0 : 0);
  let alive = 0;
  for (const b of WILD) {
    const f = w.found?.[b.k]; if (!f || f.hp <= 0 || (f.until && Date.parse(f.until) <= now)) continue; alive++;
    if (left > 0 && L >= b.lvl - 10 && run?.status !== 'active') out.push({k: 'wild-' + b.k, icon: b.icon || '🐉', title: `${b.name} найден!`, sub: `${regionName(f.region)} · здоровье ${Math.max(1, Math.round(f.hp / f.max * 100))}% · ваших боёв: ${left}/${FIGHTS}`, until: f.until, go: 'wild', pri: 1});
  }
  const hall = Number((world.tables.ae_clan_fort || []).find(x => same(x.clan, clan.id))?.b?.hall?.lvl) || 0, free = scoutOf(w.scout).squads - (w.squads || []).filter(s => !s.done).length;
  if (!alive && hall >= 1 && free > 0) out.push({k: 'scout', icon: '🔭', title: 'Отправьте разведку', sub: `боссов пока не нашли · свободных отрядов: ${free}`, go: 'wild', pri: 4});
  return out;
}
