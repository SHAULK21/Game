// «Орда»: fast endless fights for fun and levelling. One active run per hero, resolved on the server.
// Every request resolves one or several exchanges instantly (auto-battle sends several at once).
// Blood Moon: monsters hit harder and more often, wounded ones may flee and new ones run in; rewards are higher.
import {logQuest} from './arenaExtras.js';
import {blendedStats, baseStats, saveStats, kitOf} from './heroStats.js';
import {castSkill, outMult, inMult, gemProcs} from './skills.js';
import {usePotion, pbAtk, pbCrit, pbIn, pbTick, throwDmg, poisonDot} from './potions.js';

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
  return {base, hero: {...base, maxHp: b.maxHp, atk: b.atk, crit: b.crit ?? base.crit, def: b.def, maxMp: Math.max(60, Math.min(2000, b.maxMp || 100 + base.level * 8)), guardMul: b.real ? Math.max(0.55, Math.min(1.5, (baseDef + 150) / ((b.def || baseDef) + 150))) : 1, real: b.real}};
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
  run.loot.gold += Math.round((2 + L * 0.3) * m * (1 + (run.greed || 0))); run.loot.exp += Math.round((10 + L * 3) * m);
  if (kind === 'leader' && Math.random() < 0.25) run.loot.fragments++;
}
function milestone(run, events, now, world, me) {
  if (!run.kills || run.kills % 20) return; const k = run.kills / 20 - 1;   // a chest every 20 kills, no upper limit
  const L = run.hero.level, gold = (60 + L * 8) * (k + 1) * (run.weekend ? 2 : 1), frag = k >= 1 ? 1 : 0;
  run.loot.gold += gold; run.loot.fragments += frag;
  events.push({t: 'milestone', n: run.kills, gold, frag});
  run.log.push(`🏆 Веха ${run.kills} монстров! Сундук: +${gold} 🪙${frag ? ' и ✦ осколок' : ''}`);
}
// «Дары Орды»: on the 10th, 30th, 50th… kill the hero picks one of three boons for the rest of the run
export const BOONS = {
  fury: {icon: '⚔️', name: 'Ярость', text: '+8% урона'},
  vigor: {icon: '❤️', name: 'Стойкость', text: '+10% здоровья и лечение 20%'},
  eye: {icon: '🎯', name: 'Меткость', text: '+4% шанса крита'},
  leech: {icon: '🩸', name: 'Кровопийца', text: '3% урона возвращается здоровьем'},
  flask: {icon: '🧪', name: 'Запас зелий', text: '+1 зелье'},
  second: {icon: '🌿', name: 'Второе дыхание', text: '+2% здоровья за каждое убийство'},
  greed: {icon: '💰', name: 'Жадность', text: '+15% золота с монстров'},
  focus: {icon: '🔷', name: 'Сосредоточение', text: '+20% маны и полная мана'},
};
function offerBoon(run, events) {
  if (!run.kills || run.kills % 20 !== 10) return;
  if (run.boon?.length) applyBoon(run, run.boon[0]);   // an old offer nobody answered: its first boon
  const ids = Object.keys(BOONS).filter(k => k !== 'flask' || run.potions < 6).sort(() => Math.random() - 0.5).slice(0, 3);
  run.boon = ids; events.push({t: 'boon', ids}); run.log.push('✨ Дары Орды: выберите усиление!');
}
function applyBoon(run, id) {
  const b = BOONS[id], h = run.hero; if (!b) return false;
  (run.boons ||= []).push(id); run.boon = null;
  if (id === 'fury') h.atk = Math.round(h.atk * 1.08);
  if (id === 'vigor') { h.maxHp = Math.round(h.maxHp * 1.1); run.hp = Math.min(h.maxHp, run.hp + Math.round(h.maxHp * 0.2)); }
  if (id === 'eye') h.crit = Math.min(0.75, (h.crit || 0) + 0.04);
  if (id === 'leech') run.leech = (run.leech || 0) + 0.03;
  if (id === 'flask') run.potions = (run.potions || 0) + 1;
  if (id === 'second') run.regenPlus = (run.regenPlus || 0) + 0.02;
  if (id === 'greed') run.greed = (run.greed || 0) + 0.15;
  if (id === 'focus') { run.maxMp = Math.round((run.maxMp || 100) * 1.2); run.mp = run.maxMp; }
  run.log.push(`${b.icon} Дар «${b.name}»: ${b.text}`);
  return true;
}
function killFront(world, me, run, events, now, kit) {
  const front = run.queue[0], h = run.hero; if (!front || front.hp > 0) return;
    run.kills++; if (run.blood) run.bloodKills++;
    reward(run, front.kind); events.push({t: 'kill', name: front.name, kind: front.kind});
    run.log.push(`☠️ ${front.name} повержен${front.kind === 'leader' ? '! Вожак пал' : ''}`);
    logQuest(world, me, 'horde_kill', now); if (run.blood) logQuest(world, me, 'horde_blood_kill', now);
    const regen = Math.round(h.maxHp * ((run.blood ? TUNE.regen * 0.85 : TUNE.regen) + (kit.talents?.killRecovery || 0) / 200 + (run.regenPlus || 0))); run.hp = Math.min(h.maxHp, run.hp + regen);
    run.mp = Math.min(run.maxMp, run.mp + Math.round(run.maxMp * 0.08));
    run.queue.shift(); milestone(run, events, now, world, me); offerBoon(run, events); fillQueue(run);
    if (run.blood && Math.random() < 0.3) { run.queue.push(spawn(run)); events.push({t: 'join'}); run.log.push('🩸 На запах крови прибежал ещё один монстр!'); }
}
function exchange(world, me, run, action, now, events, skillId) {
  run.tn = (run.tn || 0) + 1;
  const front = run.queue[0], h = run.hero, kit = kitOf(world, me);
  run.maxMp ||= h.maxMp || 100; run.mp ??= run.maxMp;
  if (action === 'potion') {
    if (run.potions <= 0) { events.push({t: 'info', text: 'Зелья закончились'}); action = 'attack'; }
    else { run.potions--; const v = Math.round(h.maxHp * 0.4); run.hp = Math.min(h.maxHp, run.hp + v); events.push({t: 'heal', v}); run.log.push(`🧪 Зелье: +${v} HP`); }
  }
  let guard = false;
  if (action === 'defend') { guard = true; run.mp = Math.min(run.maxMp, run.mp + Math.round(run.maxMp * 0.12)); run.log.push('🛡️ Защитная стойка: −50% урона, +12% маны'); }
  if (action === 'skill') {
    const sk = (kit.skills || []).find(x => x.id === skillId);
    if (!sk || sk.mana > run.mp) action = 'attack';
    else {
      run.mp -= sk.mana;
      const self = {hp: run.hp, maxHp: h.maxHp, mp: run.mp, maxMp: run.maxMp, atk: h.atk, crit: h.crit, barrier: run.barrier || 0, fury: run.fury || 0, name: 'Вы'};
      let dealt = 0;
      const r = castSkill({self, foe: front, kit, sk, ownLast: run.lastSkill, hit: (mult, ignoreDef) => { const dmg = Math.round(h.atk * rand(0.9, 1.1) * mult * outMult(self) * pbAtk(run) * inMult(front) * (1 - (ignoreDef || 0) * 0)); front.hp = Math.max(0, front.hp - dmg); dealt += dmg; return dmg; }});
      Object.assign(run, {hp: self.hp, mp: self.mp, barrier: self.barrier, fury: self.fury}); run.lastSkill = {id: sk.id};
      if (dealt) events.push({t: 'hit', v: dealt, power: sk.mult >= 1.5});
      if (self.hp > run.hp) events.push({t: 'heal', v: 0});
      run.log.push(`${sk.icon} «${sk.name}»${r.parts.length ? ': ' + r.parts.join(', ') : ''}`);
      action = 'done';
    }
  }
  if (action === 'attack' || action === 'power') {
    const power = action === 'power' && run.powerCd <= 0;
    if (power) run.powerCd = POWER_CD;
    const crit = Math.random() < h.crit + pbCrit(run), dmg = Math.round(h.atk * rand(0.9, 1.1) * (power ? 2.5 : 1) * (crit ? 1.7 : 1) * outMult(run) * pbAtk(run) * inMult(front));
    front.hp = Math.max(0, front.hp - dmg); events.push({t: 'hit', v: dmg, crit, power});
    if (run.leech) { const v = Math.round(dmg * run.leech); if (v > 0) run.hp = Math.min(h.maxHp, run.hp + v); }
    for (const g of gemProcs({atk: h.atk}, front, kit)) run.log.push(g);
    run.mp = Math.min(run.maxMp, run.mp + Math.round(run.maxMp * 0.05));
  }
  if (front.hp > 0 && front.dots?.length) { for (const d of front.dots) { front.hp = Math.max(0, front.hp - d.per); d.left--; } front.dots = front.dots.filter(d => d.left > 0); }
  killFront(world, me, run, events, now, kit);
  if (run.powerCd > 0) run.powerCd--;
  // monsters strike back
  if (run.fury > 0) run.fury--; if (run.queue[0]?.vuln > 0) run.queue[0].vuln--;
  const stunnedFront = run.queue[0]?.stunned > 0 ? (run.queue[0].stunned--, true) : false;
  const strikers = [stunnedFront ? null : run.queue[0], ...(run.blood ? run.queue.slice(1).filter(() => Math.random() < 0.3) : [])].filter(Boolean);
  for (const [i, m] of strikers.entries()) {
    const pin = pbIn(run), dmg = pin === 0 ? 0 : Math.max(1, Math.round(m.atk * rand(0.85, 1.15) * (i ? 0.6 : 1) * (run.hero.guardMul || 1) * (guard ? 0.5 : 1) * pin));
    let left = dmg; if (run.barrier > 0) { const ab = Math.min(run.barrier, left); run.barrier -= ab; left -= ab; }
    run.hp = Math.max(0, run.hp - left); events.push({t: 'hurt', v: left, from: m.name});
    if (run.hp <= 0) break;
  }
  // Blood Moon: badly wounded monsters may flee, a fresh one takes the place
  const f = run.queue[0];
  if (run.blood && run.hp > 0 && f && f.hp < f.maxHp * 0.35 && f.kind === 'normal' && Math.random() < 0.22) {
    run.queue.shift(); events.push({t: 'flee', name: f.name}); run.log.push(`💨 ${f.name} убегает в темноту!`); fillQueue(run);
  }
  pbTick(run);
  if (run.hp <= 0) { run.status = 'ended'; run.died = true; run.log.push('💀 Вы пали. Орда отступает — награды сохранены.'); events.push({t: 'dead'}); }
  run.log = run.log.slice(-14);
}
const view = run => run && ({id: run.id, status: run.status, blood: run.blood, weekend: !!run.weekend, mp: run.mp ?? run.maxMp ?? run.hero?.maxMp ?? 100, maxMp: run.maxMp || run.hero?.maxMp || 100, barrier: run.barrier || 0, kills: run.kills, hp: run.hp, maxHp: run.hero.maxHp, potions: run.potions, powerCd: run.powerCd, died: !!run.died,
  queue: run.queue.map(m => ({uid: m.uid, sprite: m.sprite, name: m.name, kind: m.kind, hp: m.hp, maxHp: m.maxHp, atk: Math.round(m.atk * (run.hero.guardMul || 1))})), loot: run.loot, log: run.log, claimed: !!run.claimed,
  next: (Math.floor(run.kills / 20) + 1) * 20, boon: run.boon?.length ? run.boon.map(id => ({id, ...BOONS[id]})) : null, boons: (run.boons || []).map(id => ({id, ...BOONS[id]}))});

// weekly ranking (Monday 00:00 Moscow time); the top 3 of the week before get a letter with gifts
const weekKey = now => { const d = new Date(now + MSK), day = (d.getUTCDay() + 6) % 7; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10); };
const WEEK_PRIZES = [{gold: 10000, fragments: 5, arenaTickets: 3}, {gold: 6000, fragments: 3, arenaTickets: 2}, {gold: 3000, fragments: 2, arenaTickets: 1}];
const weekTop = (world, wk) => rows(world, 'horde_week').filter(r => r.w === wk && r.kills > 0).sort((a, b) => b.kills - a.kills || String(a.at).localeCompare(String(b.at)));
function weekPrizes(world, now) {
  const prev = weekKey(now - 7 * 864e5), flags = rows(world, 'ae_flags'), key = 'horde_week_' + prev; if (flags.some(f => f.key === key)) return;
  flags.push({key, at: new Date(now).toISOString()});
  weekTop(world, prev).slice(0, 3).forEach((r, i) => rows(world, 'ae_mail').push({id: crypto.randomUUID(), op: `horde-week-${prev}-${r.u}`, to: String(r.u),
    title: `🌕 Орда: ${i + 1}-е место недели!`, text: `Вы ${i + 1}-й в рейтинге Орды за неделю с ${prev}: ${r.kills} монстров за один поход. Награда — в письме.`, gifts: WEEK_PRIZES[i], at: new Date(now).toISOString()}));
  world.tables.horde_week = rows(world, 'horde_week').filter(r => r.w >= prev);
}
export function handleHordeRequest(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/horde')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id), p = player(world, me);
  if (!p) return fail('Сначала создайте персонажа.', 404);
  const runs = rows(world, 'horde_runs');
  world.tables.horde_runs = runs.filter(r => r.status === 'active' || !r.claimed || Date.parse(r.updated_at) > now - 2 * 864e5);
  // the newest run of this player; an active one always wins (a new run used to have no updated_at and lost to the finished one)
  const at = r => Date.parse(r.updated_at || r.started_at || '') || 0;
  let run = rows(world, 'horde_runs').filter(r => same(r.user, me)).sort((a, b) => (b.status === 'active') - (a.status === 'active') || at(b) - at(a))[0];
  if (run && run.status === 'active' && at(run) && at(run) < now - 12 * 3600e3) { run.status = 'ended'; run.log.push('Поход прерван: вас не было больше 12 часов. Награды сохранены.'); }
  const best = rows(world, 'horde_best').find(b => same(b.user, me));
  weekPrizes(world, now);
  if (method === 'GET') { const wk = weekKey(now), top = weekTop(world, wk), place = top.findIndex(r => same(r.u, me)) + 1;
    return ok({run: view(run), best: best || {kills: 0, bloodKills: 0}, cost: HORDE_COST, weekend: bloodWeekend(now), boons: BOONS,
      week: {top: top.slice(0, 10).map((r, i) => ({place: i + 1, name: String(player(world, r.u)?.character_name || 'Игрок'), level: Number(player(world, r.u)?.level) || 1, kills: r.kills, me: same(r.u, me)})),
        place: place || null, mine: top.find(r => same(r.u, me))?.kills || 0, prizes: WEEK_PRIZES, ends: new Date(Date.parse(wk + 'T00:00:00Z') - MSK + 7 * 864e5).toISOString()}}); }
  if (path === '/api/horde/start') {
    if (run && run.status === 'active') return ok({run: view(run)});
    if (run && !run.claimed && (run.loot.gold || run.loot.exp)) return fail('Сначала заберите награду прошлого похода.');
    if (body.stats) saveStats(world, me, body.stats, now);
    const {base: base0, hero: h} = fighterOf(world, p), mid = (a, b) => Math.round(Math.sqrt(Math.max(1, a) * Math.max(1, b)));
    // monsters grow with the hero's real strength too (halfway), so strong gear helps but does not walk through the Horde
    const base = h.real ? {...base0, atk: mid(mid(base0.atk, h.atk), h.atk), maxHp: mid(mid(base0.maxHp, h.maxHp), h.maxHp)} : base0, weekend = bloodWeekend(now).on, blood = weekend || !!body.blood;
    if (blood && !weekend && h.level < 10) return fail('Кровавая луна открывается с 10 уровня.');
    run = {id: crypto.randomUUID(), user: me, status: 'active', started_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(), blood, weekend, base, hero: h, hp: h.maxHp, maxMp: h.maxMp, mp: h.maxMp, potions: POTIONS, powerCd: 0, kills: 0, bloodKills: 0, spawned: 0, queue: [],
      loot: {gold: 0, exp: 0, fragments: 0}, log: [weekend ? '🌕 Выходные Кровавой луны! Награды ×2 — Орда беснуется!' : blood ? '🌕 Восходит Кровавая луна… Орда беснуется!' : '⚔️ Орда приближается!'], claimed: false, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString()};
    fillQueue(run); rows(world, 'horde_runs').push(run);
    return ok({run: view(run)}, 201);
  }
  if (!run) return fail('Похода нет.', 404);
  run.updated_at = new Date(now).toISOString();
  if (path === '/api/horde/act') {
    if (run.status !== 'active') return fail('Поход окончен.');
    if (body.action === 'item') {  // a bag potion: does not spend the turn
      const f = {hp: run.hp, maxHp: run.hero.maxHp, mp: run.mp, maxMp: run.maxMp, pb: run.pb, potTurn: run.potTurn}, events = [], front = run.queue[0];
      const r = usePotion(f, body.item, run.tn || 0, (pw, fx) => { const dmg = throwDmg(fx, run.hero.classId, 0); front.hp = Math.max(0, front.hp - dmg); const dot = poisonDot(fx, run.hero.classId); if (dot) (front.dots ||= []).push(dot); events.push({t: 'hit', v: dmg}); return dmg; });
      if (r.error) return fail(r.error);
      Object.assign(run, {hp: f.hp, mp: f.mp, pb: f.pb, potTurn: f.potTurn}); run.log.push(r.text); if (!r.fx.throw && (r.fx.heal || r.fx.healFull)) events.push({t: 'heal', v: 0});
      killFront(world, me, run, events, now, kitOf(world, me)); run.log = run.log.slice(-14);
      return ok({run: view(run), events});
    }
    const action = ['attack', 'power', 'potion', 'skill', 'defend'].includes(body.action) ? body.action : 'attack';
    const steps = Math.max(1, Math.min(MAX_STEPS, Number(body.steps) || 1)), events = [];
    for (let i = 0; i < steps && run.status === 'active'; i++) exchange(world, me, run, i === 0 ? action : 'attack', now, events, body.skillId);
    return ok({run: view(run), events});
  }
  if (path === '/api/horde/boon') {
    if (run.status !== 'active' || !run.boon?.includes(body.id)) return fail('Дар уже выбран.');
    applyBoon(run, body.id); return ok({run: view(run)});
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
    { const wk = weekKey(now), list = rows(world, 'horde_week'); let w = list.find(r => r.w === wk && same(r.u, me));   // the week's best single run
      if (!w) { w = {w: wk, u: me, kills: 0}; list.push(w); } if (run.kills > w.kills) { w.kills = run.kills; w.at = new Date(now).toISOString(); } }
    return ok({reward: run.loot, kills: run.kills, best: b});
  }
  return fail('API не найден.', 404);
}
