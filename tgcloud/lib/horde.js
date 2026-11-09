// «Орда»: fast endless fights for fun and levelling. One active run per hero, resolved on the server.
// Every request resolves one or several exchanges instantly (auto-battle sends several at once).
// Blood Moon: monsters hit harder and more often, wounded ones may flee and new ones run in; rewards are higher.
import {logQuest} from './arenaExtras.js';
import {blendedStats, baseStats, saveStats} from './heroStats.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const rand = (a, b) => a + Math.random() * (b - a);
const CLASS = {warrior: {hp: 1.25, atk: 1.0}, knight: {hp: 1.3, atk: 0.9}, paladin: {hp: 1.15, atk: 0.95}, berserker: {hp: 1.05, atk: 1.3}, rogue: {hp: 0.9, atk: 1.25, crit: 0.22},
  assassin: {hp: 0.85, atk: 1.35, crit: 0.25}, hunter: {hp: 0.95, atk: 1.2}, archer: {hp: 0.95, atk: 1.2}, mage: {hp: 0.8, atk: 1.4}, necromancer: {hp: 0.9, atk: 1.25}, druid: {hp: 1.0, atk: 1.0}};
export const HORDE_COST = 10;
const MAX_STEPS = 6, POTIONS = 3, POWER_CD = 4, MILESTONES = [20, 40, 60];
// Tuned by simulation: auto-battle reaches ~39 kills, a careful player ~60; Blood Moon ~25 (auto ~14).
const TUNE = {atk: 0.018, atkGrow: 0.01, hpGrow: 0.015, leaderHp: 3.5, regen: 0.06};
// [sprite id, name, tier level]
const REGULARS = [['m_wolf', 'Свирепый волк', 2], ['m_goblin', 'Гоблин-разведчик', 4], ['m_boar', 'Клыкастый вепрь', 6], ['v_ww_wolf', 'Сумеречный волк', 6], ['m_bandit', 'Разбойник', 8],
  ['v_ww_shaman', 'Гоблин-шаман', 8], ['v_ww_spider', 'Древесный паук', 9], ['v_ww_raider', 'Лесной налётчик', 10], ['v_cr_robber', 'Расхититель гробниц', 11], ['v_cr_spider', 'Склепный паук', 12],
  ['m_spider', 'Ядовитый тарантул', 12], ['v_fo_wisp', 'Тёмный дух чащи', 15], ['v_sw_toad', 'Болотный вепрь-трупоед', 27], ['v_sw_leech', 'Болотный кровосос', 28], ['m_sand_scorpion', 'Барханный скорпион', 40],
  ['m_sand_guard', 'Песчаный страж', 45], ['m_cursed_soldier', 'Проклятый легионер', 55], ['m_blood_hound', 'Кровавый гончий', 62], ['m_ash_imp', 'Пепельный бес', 75], ['m_rift_drake', 'Дракончик разлома', 82],
  ['m_peak_guard', 'Страж драконьего пика', 90], ['m_scale_hunter', 'Чешуйчатый охотник', 100]];
export const LEADERS = [['m_queen_bat', 'Королева мышей', 10], ['v_cr_vampbat', 'Вампирша-нетопырь', 14], ['v_cr_colossus', 'Костяной колосс', 16], ['m_stone_golem', 'Каменный голем', 18], ['m_spider_queen', 'Матка арахнидов', 22],
  ['v_sw_golem', 'Трясинный голем', 34], ['v_sw_queen', 'Болотная матка', 38], ['v_de_colossus', 'Песчаный колосс', 48], ['m_death_knight_boss', 'Рыцарь Смерти Мортред', 50], ['v_de_knight', 'Пустынный рыцарь Сахрим', 52],
  ['v_cu_lord', 'Проклятый владыка Кхарн', 70], ['m_demon_lord', 'Повелитель Бездны Малгор', 80], ['v_ri_serpent', 'Огненный змей разлома', 88], ['v_dr_priest', 'Драконий жрец Велкар', 98], ['m_dragon_boss', 'Древний дракон Аэтельгор', 100]];
// Blood Moon only: its own monsters (any level, scaled like the rest)
const BLOOD_REGULARS = [['bm_werewolf', 'Кровавый волколак'], ['bm_ghoul', 'Лунный упырь'], ['bm_bat_swarm', 'Рой кровопийц'], ['bm_hound', 'Гончая багровой луны'], ['bm_cultist', 'Культист луны']];
const BLOOD_LEADER = ['bm_moon_lord', 'Вестник Кровавой луны'];
// Blood Moon weekend: Saturday and Sunday (Moscow time) every run is a Blood Moon run with double rewards.
const MSK = 3 * 3600e3;
export function bloodWeekend(now) {
  const d = new Date(now + MSK), day = d.getUTCDay(), on = day === 6 || day === 0;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day === 0 ? 1 : 0)) - MSK);
  const end = new Date(start.getTime() + 2 * 864e5);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ((6 - day + 7) % 7 || 7)) - MSK);
  return {on, key: start.toISOString().slice(0, 10), endsAt: on ? end.toISOString() : null, nextAt: on ? null : next.toISOString()};
}
const near = (list, lvl) => { const pool = list.filter(x => x[2] <= lvl + 3 && x[2] >= lvl - 30); return pool.length ? pool : [list.reduce((a, b) => Math.abs(b[2] - lvl) < Math.abs(a[2] - lvl) ? b : a)]; };

export function hero(p) {
  const level = Math.max(1, Math.min(120, Number(p?.level) || 1)), c = CLASS[p?.class_id] || CLASS.warrior;
  return {level, classId: p?.class_id || 'warrior', maxHp: Math.round((160 + level * 48) * c.hp), atk: Math.round((18 + level * 7) * c.atk), crit: c.crit || 0.14};
}
// The fighter uses the hero's gear/attributes (blended); monsters keep scaling from the level formula.
function fighterOf(world, p) {
  const base = hero(p), b = blendedStats(world, p.telegram_id, p), baseDef = baseStats(p).def;
  return {base, hero: {...base, maxHp: b.maxHp, atk: b.atk, crit: b.crit ?? base.crit, def: b.def, guardMul: b.real ? Math.max(0.55, Math.min(1.5, (baseDef + 150) / ((b.def || baseDef) + 150))) : 1, real: b.real}};
}
function spawn(run) {
  const n = run.spawned + 1, lvl = run.hero.level, ref = run.base || run.hero;
  const kind = n % 20 === 0 ? 'leader' : n % 10 === 0 ? 'elite' : 'normal';
  const pool = near(kind === 'leader' ? LEADERS : REGULARS, lvl);
  let [sprite, name] = pool[Math.floor(Math.random() * pool.length)];
  if (run.blood && kind === 'leader') [sprite, name] = BLOOD_LEADER;
  else if (run.blood && Math.random() < 0.6) [sprite, name] = BLOOD_REGULARS[Math.floor(Math.random() * BLOOD_REGULARS.length)];
  const grow = 1 + run.kills * TUNE.hpGrow, mult = kind === 'leader' ? TUNE.leaderHp : kind === 'elite' ? 1.8 : 1;
  const hp = Math.round(ref.atk * rand(2.1, 2.7) * grow * mult);
  const atk = Math.round(ref.maxHp * TUNE.atk * (1 + run.kills * TUNE.atkGrow) * (kind === 'leader' ? 1.4 : kind === 'elite' ? 1.25 : 1) * (run.blood ? 1.3 : 1));
  run.spawned = n;
  return {uid: n, sprite, name: (kind === 'leader' ? 'Вожак: ' : kind === 'elite' ? 'Элита: ' : '') + name, kind, hp, maxHp: hp, atk};
}
function fillQueue(run) { const want = run.blood ? 3 : 2; while (run.queue.length < want) run.queue.push(spawn(run)); }
function reward(run, kind) {
  const L = run.hero.level, m = (kind === 'leader' ? 8 : kind === 'elite' ? 3 : 1) * (run.blood ? 1.75 : 1) * (run.weekend ? 2 : 1);
  run.loot.gold += Math.round((2 + L * 0.3) * m); run.loot.exp += Math.round((10 + L * 3) * m);
  if (kind === 'leader' && Math.random() < 0.25) run.loot.fragments++;
}
function milestone(run, events, now, world, me) {
  const k = MILESTONES.indexOf(run.kills); if (k < 0) return;
  const L = run.hero.level, gold = (60 + L * 8) * (k + 1) * (run.weekend ? 2 : 1), frag = k >= 1 ? 1 : 0;
  run.loot.gold += gold; run.loot.fragments += frag;
  events.push({t: 'milestone', n: run.kills, gold, frag});
  run.log.push(`🏆 Веха ${run.kills} монстров! Сундук: +${gold} 🪙${frag ? ' и ✦ осколок' : ''}`);
}
function exchange(world, me, run, action, now, events) {
  const front = run.queue[0], h = run.hero;
  if (action === 'potion') {
    if (run.potions <= 0) { events.push({t: 'info', text: 'Зелья закончились'}); action = 'attack'; }
    else { run.potions--; const v = Math.round(h.maxHp * 0.4); run.hp = Math.min(h.maxHp, run.hp + v); events.push({t: 'heal', v}); run.log.push(`🧪 Зелье: +${v} HP`); }
  }
  if (action === 'attack' || action === 'power') {
    const power = action === 'power' && run.powerCd <= 0;
    if (power) run.powerCd = POWER_CD;
    const crit = Math.random() < h.crit, dmg = Math.round(h.atk * rand(0.9, 1.1) * (power ? 2.5 : 1) * (crit ? 1.7 : 1));
    front.hp = Math.max(0, front.hp - dmg); events.push({t: 'hit', v: dmg, crit, power});
    if (front.hp <= 0) {
      run.kills++; if (run.blood) run.bloodKills++;
      reward(run, front.kind); events.push({t: 'kill', name: front.name, kind: front.kind});
      run.log.push(`☠️ ${front.name} повержен${front.kind === 'leader' ? '! Вожак пал' : ''}`);
      logQuest(world, me, 'horde_kill', now); if (run.blood) logQuest(world, me, 'horde_blood_kill', now);
      const regen = Math.round(h.maxHp * (run.blood ? TUNE.regen * 0.85 : TUNE.regen)); run.hp = Math.min(h.maxHp, run.hp + regen);
      run.queue.shift(); milestone(run, events, now, world, me); fillQueue(run);
      if (run.blood && Math.random() < 0.3) { run.queue.push(spawn(run)); events.push({t: 'join'}); run.log.push('🩸 На запах крови прибежал ещё один монстр!'); }
    }
  }
  if (run.powerCd > 0) run.powerCd--;
  // monsters strike back
  const strikers = [run.queue[0], ...(run.blood ? run.queue.slice(1).filter(() => Math.random() < 0.3) : [])].filter(Boolean);
  for (const [i, m] of strikers.entries()) {
    const dmg = Math.max(1, Math.round(m.atk * rand(0.85, 1.15) * (i ? 0.6 : 1) * (run.hero.guardMul || 1)));
    run.hp = Math.max(0, run.hp - dmg); events.push({t: 'hurt', v: dmg, from: m.name});
    if (run.hp <= 0) break;
  }
  // Blood Moon: badly wounded monsters may flee, a fresh one takes the place
  const f = run.queue[0];
  if (run.blood && run.hp > 0 && f && f.hp < f.maxHp * 0.35 && f.kind === 'normal' && Math.random() < 0.22) {
    run.queue.shift(); events.push({t: 'flee', name: f.name}); run.log.push(`💨 ${f.name} убегает в темноту!`); fillQueue(run);
  }
  if (run.hp <= 0) { run.status = 'ended'; run.died = true; run.log.push('💀 Вы пали. Орда отступает — награды сохранены.'); events.push({t: 'dead'}); }
  run.log = run.log.slice(-14);
}
const view = run => run && ({id: run.id, status: run.status, blood: run.blood, weekend: !!run.weekend, kills: run.kills, hp: run.hp, maxHp: run.hero.maxHp, potions: run.potions, powerCd: run.powerCd, died: !!run.died,
  queue: run.queue.map(m => ({uid: m.uid, sprite: m.sprite, name: m.name, kind: m.kind, hp: m.hp, maxHp: m.maxHp})), loot: run.loot, log: run.log, claimed: !!run.claimed,
  next: MILESTONES.find(x => x > run.kills) || null});

export function handleHordeRequest(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/horde')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id), p = player(world, me);
  if (!p) return fail('Сначала создайте персонажа.', 404);
  const runs = rows(world, 'horde_runs');
  world.tables.horde_runs = runs.filter(r => r.status === 'active' || !r.claimed || Date.parse(r.updated_at) > now - 2 * 864e5);
  let run = rows(world, 'horde_runs').filter(r => same(r.user, me)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (run && run.status === 'active' && Date.parse(run.updated_at) < now - 30 * 60e3) { run.status = 'ended'; run.log.push('Поход прерван: вы долго отсутствовали.'); }
  const best = rows(world, 'horde_best').find(b => same(b.user, me));
  if (method === 'GET') return ok({run: view(run), best: best || {kills: 0, bloodKills: 0}, cost: HORDE_COST, weekend: bloodWeekend(now)});
  if (path === '/api/horde/start') {
    if (run && run.status === 'active') return ok({run: view(run)});
    if (run && !run.claimed && (run.loot.gold || run.loot.exp)) return fail('Сначала заберите награду прошлого похода.');
    if (body.stats) saveStats(world, me, body.stats, now);
    const {base, hero: h} = fighterOf(world, p), weekend = bloodWeekend(now).on, blood = weekend || !!body.blood;
    if (blood && !weekend && h.level < 10) return fail('Кровавая луна открывается с 10 уровня.');
    run = {id: crypto.randomUUID(), user: me, status: 'active', blood, weekend, base, hero: h, hp: h.maxHp, potions: POTIONS, powerCd: 0, kills: 0, bloodKills: 0, spawned: 0, queue: [],
      loot: {gold: 0, exp: 0, fragments: 0}, log: [weekend ? '🌕 Выходные Кровавой луны! Награды ×2 — Орда беснуется!' : blood ? '🌕 Восходит Кровавая луна… Орда беснуется!' : '⚔️ Орда приближается!'], claimed: false, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString()};
    fillQueue(run); rows(world, 'horde_runs').push(run);
    return ok({run: view(run)}, 201);
  }
  if (!run) return fail('Похода нет.', 404);
  run.updated_at = new Date(now).toISOString();
  if (path === '/api/horde/act') {
    if (run.status !== 'active') return fail('Поход окончен.');
    const action = ['attack', 'power', 'potion'].includes(body.action) ? body.action : 'attack';
    const steps = Math.max(1, Math.min(MAX_STEPS, Number(body.steps) || 1)), events = [];
    for (let i = 0; i < steps && run.status === 'active'; i++) exchange(world, me, run, i === 0 ? action : 'attack', now, events);
    return ok({run: view(run), events});
  }
  if (path === '/api/horde/leave') {
    if (run.status === 'active') { run.status = 'ended'; run.log.push('🏃 Вы покинули поле боя с добычей.'); }
    return ok({run: view(run)});
  }
  if (path === '/api/horde/claim') {
    if (run.status !== 'ended') return fail('Сначала завершите поход.');
    if (run.claimed) return ok({reward: run.loot, alreadyClaimed: true});
    run.claimed = true;
    const b = best || (rows(world, 'horde_best').push({user: me, kills: 0, bloodKills: 0}), rows(world, 'horde_best').find(x => same(x.user, me)));
    if (run.kills > b.kills) b.kills = run.kills; if (run.blood && run.kills > b.bloodKills) b.bloodKills = run.kills;
    return ok({reward: run.loot, kills: run.kills, best: b});
  }
  return fail('API не найден.', 404);
}
