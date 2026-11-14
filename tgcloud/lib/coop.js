// Co-op dungeons: a leader opens a room, up to two allies join, the party walks through 7 halls.
// Between halls the leader picks a path (allies can vote): fights, elites, traps/falls, treasure, shrines.
// Combat is resolved on the server; hero stats blend the level formula with the hero's reported gear stats (clamped).
import {clanCredit} from './clanPlus.js';
import {pushEvent, logQuest} from './arenaExtras.js';
import {blendedStats, saveStats, kitOf} from './heroStats.js';
import {companionOf, compStats, giveCompanionXp, COMP_ROLES, UNLOCK, isPaid} from './companions.js';
import {castSkill, crossPreview, outMult, inMult, CROSS, setupOf, gemProcs} from './skills.js';

const MAX_MEMBERS = 3, ROOMS = 7, IDLE_MS = 30 * 60 * 1000;
// Turn-based like the caves: every hero acts once per round (attack, any of their skills for mana, guard, potion),
// then the enemy acts. No timers at all. Skills come from the hero's own skill list and talent tree (see skills.js);
// a skill used right after an ally's setup skill triggers a cross-hero combo.
const ACTIONS = new Set(['attack', 'skill', 'guard', 'potion', 'hurry']);
const POTIONS = 3, GUARD_MP = 0.25;
// Tuned by simulation: a full run takes ~1.5–4 min; careless duos at the minimum level often fall to the boss.
const HP_TUNE = {goblin_cave: 1.4, spider_den: 1.3, crypt_depths: 0.75, rift_gate: 0.35};
const ATK_TUNE = 2.4 * 0.55; // turn-based: the enemy acts once per round (tuned by simulation)
const FOE_INFO = {
  'Гоблин-разведчик': 'Шустрый и трусливый. Бьёт исподтишка, но быстро выдыхается.', 'Гоблин-лучник': 'Держится в тени и пускает стрелы в самого раненого.',
  'Гоблин-шаман': 'Бормочет заклинания над костями. Опасен, если затянуть бой.', 'Гоблин-громила': 'Огромная дубина и толстая шкура. Удары медленные, но тяжёлые.',
  'Вожак гоблинов': 'Шрамы и трофейный шлем. Время от времени рубит по всему отряду.', 'Король гоблинов Гракх': 'Восседает на груде награбленного. Раз в несколько ходов обрушивает удар на всех.',
  'Паук-ткач': 'Плетёт сети между колоннами и ждёт, пока жертва запутается.', 'Ядовитый паук': 'Его укус жжёт, как огонь. Лучше не подставлять раненых.',
  'Кокон-ловушка': 'Шевелящийся кокон. Внутри — что-то голодное.', 'Паук-страж': 'Панцирь как камень. Охраняет кладку королевы.',
  'Матка-ткачиха': 'Огромная паучиха, выплёвывает кислотную паутину на весь отряд.', 'Паучья королева Ирхаса': 'Древняя владычица логова. Её крик парализует, а жвала рвут доспехи.',
  'Скелет-воин': 'Ржавый меч и пустые глазницы. Не чувствует боли.', 'Костяной маг': 'Шепчет проклятия, от которых стынет кровь.',
  'Упырь': 'Голодный мертвец. Бросается на самого слабого.', 'Рыцарь праха': 'Павший рыцарь, закованный в чёрные латы.',
  'Страж гробниц': 'Каменный исполин с рунами на груди. Сотрясает зал ударами.', 'Лич Морвен': 'Бессмертный колдун склепа. Его волны тьмы задевают всех.',
  'Бес пламени': 'Мелкий, злобный, пахнет серой.', 'Адская гончая': 'Огненная пасть и горящие следы. Охотится стаей.',
  'Демон-палач': 'Секира размером с дверь. Каждый удар — приговор.', 'Страж разлома': 'Охраняет трещину между мирами.',
  'Пожиратель душ': 'Тень с тысячей ртов. Вытягивает силы из всего отряда.', 'Владыка разлома Азгор': 'Повелитель демонов. Земля горит под его ногами.'};
const SCENES = {
  goblin_cave: ['Сырая пещера, пахнет дымом и жареной крысой. На стенах — корявые рисунки гоблинов.', 'Узкий тоннель завален мешками с краденым добром.', 'Зал с костром посередине. Тени пляшут на стенах.', 'Подземный ручей шумит под ногами, вода ледяная.'],
  spider_den: ['Своды затянуты липкой паутиной, под ногами хрустят панцири.', 'Пещера, полная коконов. Некоторые ещё шевелятся.', 'Влажный туннель, с потолка капает яд.', 'Огромная кладка яиц светится бледным светом.'],
  crypt_depths: ['Ряды каменных саркофагов. Крышки некоторых сдвинуты.', 'Холодный зал с выцветшими гербами павших королей.', 'Коридор костей, уложенных в стены узорами.', 'Часовня с погасшими свечами и шёпотом из темноты.'],
  rift_gate: ['Земля растрескалась, из трещин вырывается пламя.', 'Обсидиановый мост над рекой лавы.', 'Зал, где реальность дрожит и искажается.', 'Руины древнего храма, захваченного демонами.']};
const BOSS_SCENE = 'Сердце подземелья. Здесь хозяин этих мест ждёт тех, кто осмелился дойти до конца.';
export const COOP_DUNGEONS = [
  {id: 'goblin_cave', name: 'Пещера гоблинов', minLevel: 3, maxLevel: 15, hp: 420, atk: 22, def: 8, gold: 180, silver: 120, exp: 260, foes: ['Гоблин-разведчик', 'Гоблин-лучник', 'Гоблин-шаман', 'Гоблин-громила'], elite: 'Вожак гоблинов', boss: 'Король гоблинов Гракх'},
  {id: 'spider_den', name: 'Логово паучьей королевы', minLevel: 12, maxLevel: 28, hp: 1500, atk: 70, def: 26, gold: 650, silver: 400, exp: 1100, foes: ['Паук-ткач', 'Ядовитый паук', 'Кокон-ловушка', 'Паук-страж'], elite: 'Матка-ткачиха', boss: 'Паучья королева Ирхаса'},
  {id: 'crypt_depths', name: 'Глубины Забытого склепа', minLevel: 22, maxLevel: 45, hp: 4200, atk: 160, def: 60, gold: 1600, silver: 900, exp: 3200, foes: ['Скелет-воин', 'Костяной маг', 'Упырь', 'Рыцарь праха'], elite: 'Страж гробниц', boss: 'Лич Морвен'},
  {id: 'rift_gate', name: 'Врата Демонического разлома', minLevel: 40, maxLevel: 120, hp: 12000, atk: 380, def: 140, gold: 4200, silver: 2400, exp: 9000, foes: ['Бес пламени', 'Адская гончая', 'Демон-палач', 'Страж разлома'], elite: 'Пожиратель душ', boss: 'Владыка разлома Азгор'},
];
// Paths and their hidden outcome weights. The hint is all the party sees.
const PATHS = [
  {id: 'corridor', name: 'Широкий коридор', icon: '🚪', hint: 'Слышны тяжёлые шаги. Скорее всего — бой.', w: {fight: 70, elite: 20, treasure: 10}},
  {id: 'ledge', name: 'Узкий карниз над пропастью', icon: '🧗', hint: 'Короткий путь, но камни осыпаются под ногами.', w: {trap: 50, treasure: 30, fight: 20}},
  {id: 'grotto', name: 'Тёмный грот', icon: '🕳️', hint: 'Из темноты доносится низкое рычание… и блеск металла.', w: {elite: 50, treasure: 30, shrine: 20}},
  {id: 'bridge', name: 'Старый подвесной мост', icon: '🌉', hint: 'Доски гнилые, внизу шумит подземная река.', w: {trap: 40, fight: 30, shrine: 30}},
  {id: 'glow', name: 'Светящийся проход', icon: '✨', hint: 'Мягкий свет и тишина. Похоже на святилище.', w: {shrine: 50, fight: 30, trap: 20}},
  {id: 'bones', name: 'Зал костей', icon: '💀', hint: 'Повсюду кости прежних искателей. Кто-то их здесь оставил.', w: {elite: 40, fight: 40, treasure: 20}},
];
const CLASS = {warrior: {hp: 1.25, atk: 1.0, def: 1.3}, knight: {hp: 1.3, atk: 0.9, def: 1.4}, paladin: {hp: 1.15, atk: 0.95, def: 1.2, healer: true}, berserker: {hp: 1.05, atk: 1.3, def: 0.85},
  rogue: {hp: 0.9, atk: 1.25, def: 0.8}, assassin: {hp: 0.85, atk: 1.35, def: 0.75}, hunter: {hp: 0.95, atk: 1.2, def: 0.85}, mage: {hp: 0.8, atk: 1.4, def: 0.7},
  necromancer: {hp: 0.9, atk: 1.25, def: 0.8}, druid: {hp: 1.0, atk: 1.0, def: 0.95, healer: true}};
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const rand = (a, b) => a + Math.random() * (b - a);
const alive = room => room.members.filter(m => !m.left && m.hp > 0);
const present = room => room.members.filter(m => !m.left);
const pick = w => { const total = Object.values(w).reduce((a, b) => a + b, 0); let r = Math.random() * total; for (const [k, v] of Object.entries(w)) { if ((r -= v) < 0) return k; } return Object.keys(w)[0]; };

function memberStats(p, world) {
  const level = Math.max(1, Math.min(120, Number(p?.level) || 1)), c = CLASS[p?.class_id] || CLASS.warrior;
  const base = {level, classId: p?.class_id || 'warrior', healer: !!c.healer, maxHp: Math.round((160 + level * 48) * c.hp), atk: Math.round((18 + level * 7) * c.atk), def: Math.round((6 + level * 3) * c.def)};
  const b = world ? blendedStats(world, p.telegram_id, p) : null; // gear and attributes count (blended with the level formula)
  const maxMp = Math.max(60, Math.min(2000, b?.maxMp || 100 + level * 8));
  return b?.real ? {...base, maxHp: b.maxHp, atk: b.atk, def: b.def, crit: b.crit || 0.12, maxMp} : {...base, maxMp};
}
function makeFoe(room, d, kind) {
  const n = present(room).length, boss = kind === 'boss', elite = kind === 'elite', scale = 1 + 0.65 * (n - 1);
  const hp = Math.round(d.hp * (HP_TUNE[d.id] || 1) * scale * (boss ? 2.6 : elite ? 1.6 : 1) * (1 + 0.1 * (room.stage - 1)));
  const name = boss ? d.boss : elite ? d.elite : d.foes[Math.floor(Math.random() * d.foes.length)];
  return {name, boss, elite, hp, maxHp: hp, atk: Math.round(ATK_TUNE * d.atk * (boss ? 1.45 : elite ? 1.3 : 1) * (1 + 0.07 * (room.stage - 1))), def: d.def, hits: 0, desc: FOE_INFO[name] || ''};
}
function rollIntent(room, foe) {
  const team = alive(room); if (!team.length) { foe.intent = null; return; }
  const n = foe.hits + 1, aoe = (foe.boss && n % 4 === 0) || (foe.elite && n % 5 === 0);
  const heavy = !aoe && Math.random() < (foe.boss || foe.elite ? 0.25 : 0.12);
  const t = team[Math.floor(Math.random() * team.length)];
  foe.intent = aoe ? {kind: 'aoe'} : {kind: heavy ? 'heavy' : 'strike', targetId: t.id, targetName: t.name};
}
function spawn(room, foe, now) { room.foe = foe; rollIntent(room, foe); for (const m of present(room)) m.acted = false; room.round = (room.round || 0) + 1; }
const waitingFor = room => alive(room).filter(m => !m.acted && !m.bot);
const humans = room => present(room).filter(m => !m.bot);
// Everyone alive has acted (or the round was hurried): dots tick, then the enemy acts and a new round starts.
function endRound(world, room, now) {
  const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId), foe = room.foe;
  if (!foe || foe.hp <= 0) return;
  if (applyDots(room, now)) { foeDown(world, room, d, now); return; }
  if (foe.stunned > 0) { foe.stunned--; log(room, `💫 ${foe.name} оглушён и пропускает ход`, now); rollIntent(room, foe); }
  else enemyTurn(room, now);
  if (foe.vuln > 0) foe.vuln--;
  for (const m of present(room)) { m.acted = false; if (m.fury > 0) m.fury--; }
  room.round = (room.round || 0) + 1;
}
function applyDots(room, now) {
  const foe = room.foe; if (!foe?.dots?.length) return false;
  for (const dot of foe.dots) { foe.hp = Math.max(0, foe.hp - dot.per); dot.left--; log(room, `${dot.icon} ${dot.name}: −${dot.per}`, now); }
  foe.dots = foe.dots.filter(x => x.left > 0);
  return foe.hp <= 0;
}
function foeDown(world, room, d, now) {
  log(room, `Победа над врагом «${room.foe.name}»!`, now); room.lastSkill = null;
  for (const m of humans(room)) logQuest(world, m.id, 'coop_kill', now);
  for (const m of alive(room)) { const kr = kitOf(world, m.id).talents?.killRecovery || 0; m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * (0.15 + kr / 100))); m.mp = Math.min(m.maxMp, (m.mp || 0) + Math.round(m.maxMp * 0.2)); }
  if (room.stage >= ROOMS) finish(world, room, d, now);
  else offerPaths(room, now);
}
function hitFoe(room, self, mult, now, {ignoreDef = 0} = {}) {
  const def = room.foe.def * (1 - ignoreDef);
  const dmg = Math.max(1, Math.round(self.atk * rand(0.9, 1.1) * mult * outMult(self) * inMult(room.foe) * (1 - def / (def + 75))));
  room.foe.hp = Math.max(0, room.foe.hp - dmg); return dmg;
}
function intentText(room) {
  const i = room.foe?.intent; if (!i) return '';
  const guard = alive(room).find(m => m.guard);
  if (i.kind === 'aoe') return 'набирает силу для удара по всему отряду';
  const who = guard ? `${guard.name} (прикрывает)` : i.targetName;
  return i.kind === 'heavy' ? `готовит сокрушительный удар — цель: ${who}, ×1.7 урона` : `атакует — цель: ${who}`;
}
const log = (room, text, now) => { room.log.push({at: new Date(now).toISOString(), text}); room.log = room.log.slice(-50); };
function myRoom(world, me) { return rows(world, 'coop_rooms').find(r => ['lobby', 'active', 'won', 'failed'].includes(r.status) && r.members.some(m => same(m.id, me) && !m.left)); }
function expire(world, now) {
  for (const r of rows(world, 'coop_rooms')) if (['lobby', 'active'].includes(r.status) && Date.parse(r.updated_at) < now - IDLE_MS) r.status = 'expired';
  world.tables.coop_rooms = rows(world, 'coop_rooms').filter(r => Date.parse(r.updated_at) > now - 24 * 3600e3);
}
function view(room, me, world) {
  const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId), last = room.lastSkill;
  const meM = room.members.find(m => same(m.id, me));
  // Cross-hero combo the viewer can trigger right now (ally's last skill set it up).
  const myKit = world ? kitOf(world, me) : {skills: []};
  const combos = last && !same(last.by, me) && room.foe ? myKit.skills.map(sk => { const c = crossPreview(last.sk, sk); return c ? {id: sk.id, ...c} : null; }).filter(Boolean) : [];
  return {id: room.id, dungeon: {id: d.id, name: d.name, minLevel: d.minLevel, maxLevel: d.maxLevel}, status: room.status, phase: room.phase, hostId: room.hostId, stage: room.stage, rooms: ROOMS, round: room.round || 1,
    foe: room.foe ? {name: room.foe.name, boss: room.foe.boss, elite: room.foe.elite, hp: room.foe.hp, maxHp: room.foe.maxHp, atk: room.foe.atk, def: room.foe.def, desc: room.foe.desc || FOE_INFO[room.foe.name] || '',
      intent: room.foe.intent?.kind || null, intentText: intentText(room), stunned: room.foe.stunned || 0, vuln: room.foe.vuln || 0, dots: (room.foe.dots || []).map(x => ({icon: x.icon, name: x.name, left: x.left}))} : null,
    scene: room.scene || '',
    setup: last && room.foe ? {by: last.name, byId: String(last.by), icon: last.sk.icon, skill: last.sk.name, kind: setupOf(last.sk), combo: CROSS[setupOf(last.sk)]?.[1] || null} : null, combos,
    waiting: room.foe ? waitingFor(room).map(m => ({id: String(m.id), name: m.name})) : [],
    options: room.phase === 'choose' ? room.options.map(o => ({id: o.id, name: o.name, icon: o.icon, hint: o.hint, votes: Object.values(room.votes || {}).filter(v => v === o.id).length})) : [],
    myVote: room.votes?.[String(me)] || null, bonus: room.bonus || 0, log: room.log.slice(-18), isHost: same(room.hostId, me),
    members: present(room).map(m => ({id: m.id, bot: !!m.bot, comp: !!m.compId, owner: m.owner || null, role: m.role || null, name: m.name, level: m.level, classId: m.classId, healer: m.healer, hp: m.hp, maxHp: m.maxHp, atk: m.atk, def: m.def, guard: !!m.guard, barrier: m.barrier || 0, fury: m.fury || 0,
      mp: m.mp ?? m.maxMp ?? 100, maxMp: m.maxMp || 100, acted: !!m.acted, potions: same(m.id, me) ? (m.potions ?? POTIONS) : undefined})),
    reward: room.rewards?.[String(me)] || null};
}
const tellParty = (world, room, except, icon, text, now) => { for (const m of humans(room)) if (!same(m.id, except)) pushEvent(world, m.id, icon, text, 'coop', {roomId: room.id}, now); };

function offerPaths(room, now) {
  if (room.stage >= ROOMS) { room.phase = 'fight'; room.foe = null; return; }
  const pool = PATHS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  room.options = pool.map(p => ({id: p.id, name: p.name, icon: p.icon, hint: p.hint})); room.votes = {}; room.phase = 'choose'; room.foe = null;
  log(room, `Развилка перед залом ${room.stage + 1}. Путь может выбрать любой участник.`, now);
}
function enterHall(world, room, d, pathId, now) {
  room.stage++;
  const sc = SCENES[d.id] || []; room.scene = room.stage >= ROOMS ? BOSS_SCENE : sc[Math.floor(Math.random() * sc.length)] || '';
  if (room.stage >= ROOMS) { room.phase = 'fight'; spawn(room, makeFoe(room, d, 'boss'), now); log(room, `Зал ${room.stage} — логово босса! Перед вами ${room.foe.name}.`, now); return; }
  const path = PATHS.find(p => p.id === pathId), outcome = pick(path.w);
  log(room, `${path.icon} Отряд идёт: «${path.name}».`, now);
  room.scene = `${path.icon} ${path.name}. ${room.scene}`;
  if (outcome === 'fight' || outcome === 'elite') { room.phase = 'fight'; spawn(room, makeFoe(room, d, outcome), now); log(room, outcome === 'elite' ? `⚠️ Засада! Сильный враг: ${room.foe.name}.` : `Враг: ${room.foe.name}.`, now); return; }
  if (outcome === 'trap') {
    const fall = Math.random() < 0.5;
    for (const m of alive(room)) { const dmg = Math.round(m.maxHp * rand(fall ? 0.25 : 0.15, fall ? 0.45 : 0.3)); m.hp = Math.max(0, m.hp - dmg); log(room, `${fall ? '🪨 Карниз обрушился — ' + m.name + ' падает со скалы' : '🕸️ Ловушка ранит ' + m.name}: −${dmg} HP${m.hp === 0 ? ', герой без сил!' : ''}`, now); }
    if (!alive(room).length) { room.status = 'failed'; room.phase = 'end'; log(room, 'Отряд пал в пропасти. Подземелье не пройдено.', now); return; }
  } else if (outcome === 'treasure') {
    room.bonus = Math.min(1, (room.bonus || 0) + 0.2); log(room, `💰 Тайник с сокровищами! Награда отряда +20% (всего +${Math.round(room.bonus * 100)}%).`, now);
  } else if (outcome === 'shrine') {
    for (const m of present(room)) { const was = m.hp; m.hp = Math.min(m.maxHp, Math.max(m.hp, Math.round(m.maxHp * 0.3)) + Math.round(m.maxHp * 0.35)); if (was === 0) log(room, `✨ Святилище поднимает ${m.name}.`, now); }
    log(room, '✨ Святилище восстанавливает силы отряду.', now);
  }
  offerPaths(room, now);
}
const kitOf0 = m => m.talents || {};
function enemyTurn(room, now) {
  const team = alive(room);
  if (!team.length || !room.foe || room.foe.hp <= 0) return;
  if (!room.foe.intent) rollIntent(room, room.foe);
  const it = room.foe.intent; room.foe.hits++;
  const aoe = it.kind === 'aoe', heavy = it.kind === 'heavy';
  const guard = team.find(m => m.guard);
  const aimed = team.find(m => same(m.id, it.targetId)) || team[Math.floor(Math.random() * team.length)];
  const targets = aoe ? team : [guard || aimed];
  for (const t of targets) {
    const raw = room.foe.atk * rand(0.85, 1.15) * (aoe ? 0.7 : heavy ? 1.7 : 1) * (kitOf0(t).defensiveStance ? 0.85 : 1), mit = t.def / (t.def + 75), shield = t.guard ? 0.5 : 1;
    let dmg = Math.max(1, Math.round(raw * (1 - mit) * shield));
    if (t.barrier > 0) { const ab = Math.min(t.barrier, dmg); t.barrier -= ab; dmg -= ab; }
    t.hp = Math.max(0, t.hp - dmg);
    log(room, `${aoe ? '🌀' : heavy ? '💢' : '🗡️'} ${room.foe.name} ${aoe ? 'бьёт по всему отряду: ' : heavy ? 'сокрушает ' : 'бьёт '}${t.name} на ${dmg}${shield < 1 ? ' (щит)' : ''}${t.hp === 0 ? ' — герой без сил!' : ''}`, now);
  }
  for (const m of team) m.guard = false;
  rollIntent(room, room.foe);
  if (!alive(room).length) { room.status = 'failed'; room.phase = 'end'; log(room, 'Отряд пал. Подземелье не пройдено.', now); }
}
function finish(world, room, d, now) {
  room.status = 'won'; room.phase = 'end'; room.rewards = {};
  const team = humans(room), hired = present(room).some(m => m.bot && !m.compId), mult = (1 + 0.1 * (team.length - 1)) * (1 + (room.bonus || 0)) * (hired ? 0.85 : 1);
  if (hired) log(room, '🤖 Наёмники забирают свою долю: награда −15%.', now);
  for (const m of team) logQuest(world, m.id, 'coop_win', now);
  const clanId = id => rows(world, 'clan_members').find(x => String(x.telegram_id) === String(id))?.clan_id;
  for (const m of team) {
    const c = clanId(m.id), mates = c ? team.filter(o => o !== m && String(clanId(o.id)) === String(c)).length : 0, cm = mates ? 1.2 : 1;
    room.rewards[String(m.id)] = {gold: Math.round(d.gold * mult * cm), silver: Math.round(d.silver * mult * cm), exp: Math.round(d.exp * mult * cm), fragment: Math.random() < 0.35 + (room.bonus || 0) * 0.3 + (mates ? 0.1 : 0), claimed: false, clanBonus: mates > 0};
    clanCredit(world, m.id, {dungeons: 1}, now);
  }
  if (team.some(m => room.rewards[String(m.id)].clanBonus)) log(room, '🛡️ Соклановцы в отряде: +20% к награде и шанс осколка выше!', now);
  log(room, `Победа! «${d.boss}» больше не угрожает королевству. Заберите награду.`, now);
  tellParty(world, room, null, '🏆', `Отряд прошёл «${d.name}»! Заберите награду в кооп-подземельях.`, now);
}

// ---------- bot allies: anyone can go alone and take up to two hired heroes (tank, healer, damage) ----------
const BOT_ROLES = {
  tank: {cls: 'knight', label: 'Танк', names: ['Сэр Борн', 'Гарет Щит', 'Ульрих Стойкий']},
  heal: {cls: 'druid', label: 'Лекарь', names: ['Сестра Мирра', 'Травница Ив', 'Элайна']},
  dps: {cls: 'mage', label: 'Боец', names: ['Каэль Огнерук', 'Ровена', 'Зорн Клинок']},
};
function makeBot(room, host, role) {
  const R = BOT_ROLES[role], taken = new Set(room.members.map(m => m.name)), name = R.names.find(n => !taken.has(n + ' 🤖')) || R.names[0];
  const lvl = Math.max(1, Number(host?.level) || 1), base = memberStats({level: lvl, class_id: R.cls}), hostS = host ? memberStats(host, null) : base;
  // as strong as an average hero of the host's level (a bit behind a well-geared player)
  const maxHp = Math.round(base.maxHp * 0.85), atk = Math.round(Math.max(base.atk, hostS.atk * 0.8) * 0.75), maxMp = 100 + lvl * 4;
  return {id: 'bot:' + crypto.randomUUID().slice(0, 8), bot: true, role, name: name + ' 🤖', ...base, maxHp, hp: maxHp, atk, def: Math.round(base.def * 0.95), maxMp, mp: maxMp, potions: 2, talents: {}};
}
function botAct(world, room, d, b, now) {
  const foe = room.foe, team = present(room), ally = team.filter(m => m !== b);
  b.mp = Math.min(b.maxMp, (b.mp || 0) + Math.round(b.maxMp * 0.1));
  const downed = ally.find(m => m.hp <= 0 && !m.bot) || ally.find(m => m.hp <= 0);
  const hurt = team.filter(m => m.hp > 0).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  if (b.hp < b.maxHp * 0.3 && b.potions > 0 && b.role !== 'heal') { b.potions--; const v = Math.round(b.maxHp * 0.4); b.hp = Math.min(b.maxHp, b.hp + v); log(room, `🧪 ${b.name} пьёт зелье: +${v} HP`, now); return; }
  if (b.role === 'heal') {
    if (downed && b.potions > 0) { b.potions--; const v = Math.round(downed.maxHp * 0.3); downed.hp = v; log(room, `🧪 ${b.name} поднимает ${downed.name}: +${v} HP`, now); return; }
    if (hurt && hurt.hp < hurt.maxHp * 0.55 && b.mp >= 30) { b.mp -= 30; const v = Math.round(b.atk * 0.9 + hurt.maxHp * 0.1); hurt.hp = Math.min(hurt.maxHp, hurt.hp + v); log(room, `💚 ${b.name} лечит ${hurt.name}: +${v} HP`, now); return; }
  }
  if (b.role === 'tank' && foe.intent && foe.intent.kind !== 'aoe' && !team.some(m => m.guard) && (foe.intent.kind === 'heavy' || (foe.intent.targetId && !same(foe.intent.targetId, b.id)))) {
    b.guard = true; log(room, `🛡️ ${b.name} закрывает отряд щитом`, now); return; }
  const strong = b.role === 'dps' ? b.mp >= 30 : b.role === 'tank' && b.mp >= 25 && (room.round || 1) % 3 === 0;
  if (strong) { b.mp -= b.role === 'dps' ? 30 : 25; const dmg = hitFoe(room, b, b.role === 'dps' ? 1.9 : 1.6, now); log(room, `${b.role === 'dps' ? '🔥' : '⚔️'} ${b.name} — «${b.role === 'dps' ? 'Огненный шар' : 'Сокрушающий выпад'}»: ${dmg}`, now); return; }
  const crit = Math.random() < 0.12, dmg = hitFoe(room, b, (crit ? 1.6 : 1) * (b.role === 'heal' ? 0.8 : 1), now);
  log(room, `${b.name} атакует: ${dmg}${crit ? ' (крит!)' : ''}`, now);
}
// A player's own companion (leveled and geared on the Companions screen) joins as a bot that acts like a hireling of its role.
function companionBot(world, me, c) {
  const st = compStats(c);
  return {id: 'comp:' + c.id, bot: true, compId: c.id, owner: String(me), role: c.role, name: c.name + ' 🛡', level: st.level, classId: st.classId, healer: c.role === 'heal',
    maxHp: st.maxHp, hp: st.maxHp, atk: st.atk, def: st.def, crit: st.crit, maxMp: st.maxMp, mp: st.maxMp, potions: 2, talents: {}};
}
// When a run ends (won or lost) companions get experience: full on a win, a share of the halls passed otherwise.
function settleCompanions(world, room) {
  if (room.compDone || !['won', 'failed'].includes(room.status)) return;
  room.compDone = true; const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId), won = room.status === 'won';
  for (const m of room.members.filter(x => x.compId)) {
    const r = giveCompanionXp(world, m.owner, m.compId, d.exp * (won ? 1 : 0.25 * Math.max(1, room.stage) / ROOMS), won);
    if (r) log(room, `🛡 ${r.name}: +${r.xp} опыта${r.up ? ` — новый уровень ${r.lvl}!` : ''}`, Date.now());
  }
}
// Bots act once the humans have; if every human is down, the bots fight on by themselves until the hall is decided.
function advance(world, room, d, now) {
  for (let i = 0; i < 60; i++) {
    if (room.status !== 'active' || room.phase !== 'fight' || !room.foe || room.foe.hp <= 0) return;
    if (waitingFor(room).length) return;
    for (const b of alive(room).filter(m => m.bot && !m.acted)) { botAct(world, room, d, b, now); b.acted = true; if (room.foe.hp <= 0) { foeDown(world, room, d, now); return; } }
    endRound(world, room, now);
    if (alive(room).some(m => !m.bot)) return;
  }
}

export async function handleCoopRequest(world, input, user, now, notify) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/coop')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = user.id, p = player(world, me);
  if (!p) return fail('Сначала создайте персонажа.', 404);
  expire(world, now);
  const stamp = new Date(now).toISOString();
  let room = myRoom(world, me);
  if (method === 'GET' && path === '/api/coop/rooms') {
    const lvl = Number(p.level) || 1;
    const open = rows(world, 'coop_rooms').filter(r => r.status === 'lobby' && present(r).length < MAX_MEMBERS)
      .map(r => ({...view(r, me), fits: lvl >= COOP_DUNGEONS.find(d => d.id === r.dungeonId).minLevel}));
    return ok({dungeons: COOP_DUNGEONS.map(({id, name, minLevel, maxLevel}) => ({id, name, minLevel, maxLevel})), open, mine: room ? view(room, me, world) : null});
  }
  if (method === 'GET' && path === '/api/coop/room') return ok({room: room ? view(room, me, world) : null});
  if (method !== 'POST') return fail('Метод не поддерживается.', 405);
  if (input?.body?.stats) saveStats(world, me, input.body.stats, now);
  const meStats = memberStats(p, world), meMember = () => ({id: String(me), name: nameOf(p), ...meStats, hp: meStats.maxHp, mp: meStats.maxMp, potions: POTIONS, talents: kitOf(world, me).talents || {}});
  if (path === '/api/coop/create') {
    if (room && ['lobby', 'active'].includes(room.status)) return fail('Вы уже в отряде. Сначала покиньте его.');
    const d = COOP_DUNGEONS.find(x => x.id === body.dungeonId);
    if (!d) return fail('Подземелье не найдено.', 404);
    if (meStats.level < d.minLevel) return fail(`Нужен ${d.minLevel} уровень.`);
    if (room) room.members.find(m => same(m.id, me)).left = true;
    room = {id: crypto.randomUUID(), dungeonId: d.id, hostId: String(me), status: 'lobby', phase: 'lobby', stage: 0, members: [meMember()], foe: null, options: [], votes: {}, bonus: 0, log: [], created_at: stamp, updated_at: stamp};
    log(room, `${nameOf(p)} открыл(а) комнату «${d.name}». Ждём союзников.`, now);
    rows(world, 'coop_rooms').push(room);
    return ok({room: view(room, me, world)}, 201);
  }
  if (path === '/api/coop/join') {
    const target = rows(world, 'coop_rooms').find(r => r.id === body.roomId);
    if (!target || target.status !== 'lobby') return fail('Комната уже недоступна.', 404);
    if (room && room !== target && ['lobby', 'active'].includes(room.status)) return fail('Сначала покиньте текущий отряд.');
    const d = COOP_DUNGEONS.find(x => x.id === target.dungeonId);
    if (meStats.level < d.minLevel) return fail(`Нужен ${d.minLevel} уровень.`);
    const existing = target.members.find(m => same(m.id, me));
    if (existing) existing.left = false;
    else { if (present(target).length >= MAX_MEMBERS) return fail('Отряд уже собран.'); target.members.push(meMember()); }
    target.updated_at = stamp; log(target, `${nameOf(p)} присоединяется к отряду.`, now);
    tellParty(world, target, me, '🛡️', `${nameOf(p)} присоединился(ась) к вашему отряду в «${d.name}».`, now);
    notify?.(world, target.hostId, `⚔️ ${nameOf(p)} присоединился(ась) к вашему отряду в «${d.name}».`, 'coop-join', now);
    return ok({room: view(target, me, world)});
  }
  if (!room) return fail('Вы не в отряде.', 404);
  const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId), self = room.members.find(m => same(m.id, me));
  room.updated_at = stamp;
  if (path === '/api/coop/leave') {
    self.left = true; log(room, `${self.name} покидает отряд.`, now);
    tellParty(world, room, me, '🚪', `${self.name} покинул(а) отряд в «${d.name}».`, now);
    const rest = humans(room);
    if (!rest.length) room.status = room.status === 'won' ? 'won' : 'expired';
    else if (same(room.hostId, me)) { room.hostId = rest[0].id; log(room, `Новый лидер отряда: ${rest[0].name}.`, now); }
    if (room.status === 'active' && !alive(room).length) room.status = 'failed';
    return ok({room: null});
  }
  if (path === '/api/coop/invite') {
    const friend = String(body.friendId || '');
    const linked = rows(world, 'friendships').some(f => f.status === 'accepted' && (same(f.a, me) && same(f.b, friend) || same(f.b, me) && same(f.a, friend)));
    if (!linked) return fail('Приглашать можно только друзей.');
    pushEvent(world, friend, '🛡️', `${nameOf(p)} зовёт вас в кооп «${d.name}»`, 'coop-invite', {roomId: room.id}, now);
    notify?.(world, friend, `🛡️ ${nameOf(p)} зовёт вас в кооп-подземелье «${d.name}». Откройте игру → Ещё → Кооп-подземелья.`, 'coop-invite:' + me, now);
    return ok({invited: true});
  }
  if (path === '/api/coop/bot' || path === '/api/coop/unbot') {
    if (room.status !== 'lobby') return fail('Поход уже начат.');
    if (path === '/api/coop/unbot') { const b = room.members.find(m => m.bot && m.id === body.id); if (!b) return fail('Бот не найден.', 404);
      if (!same(room.hostId, me) && !same(b.owner, me)) return fail('Отпустить бота может лидер или хозяин соратника.');
      room.members = room.members.filter(m => m !== b); log(room, `${b.name} покидает отряд.`, now); return ok({room: view(room, me, world)}); }
    if (body.compId) {
      const c = companionOf(world, me, body.compId); if (!c) return fail('Соратник не найден.', 404);
      if ((Number(p.level) || 1) < UNLOCK.coop) return fail(`Соратники в кооп-подземельях — с ${UNLOCK.coop} уровня.`);
      if (!isPaid(c, now)) return fail(`${c.name} ждёт жалования — заплатите в Казарме.`);
      if (room.members.some(m => m.compId === c.id)) return fail('Этот соратник уже в отряде.');
      if (present(room).length >= MAX_MEMBERS) return fail('Отряд уже полный.');
      const b = companionBot(world, me, c); room.members.push(b);
      log(room, `🛡 Соратник ${c.name} (${COMP_ROLES[c.role].label}, ${c.lvl} ур.) встаёт в строй.`, now);
      return ok({room: view(room, me, world)});
    }
    if (!same(room.hostId, me)) return fail('Наёмников берёт лидер отряда.');
    if (!BOT_ROLES[body.role]) return fail('Нет такой роли.');
    if (present(room).length >= MAX_MEMBERS) return fail('Отряд уже полный.');
    const b = makeBot(room, p, body.role); room.members.push(b);
    log(room, `🤖 ${b.name} (${BOT_ROLES[body.role].label}) присоединяется к отряду.`, now);
    return ok({room: view(room, me, world)});
  }
  if (path === '/api/coop/start') {
    if (!same(room.hostId, me)) return fail('Начать может только лидер отряда.');
    if (room.status !== 'lobby') return fail('Поход уже начат.');
    if (present(room).length < 2) return fail('Нужно минимум 2 героя.');
    for (const m of present(room)) { m.potions = POTIONS; m.mp = m.maxMp || 100; }
    room.status = 'active'; room.stage = 1; room.phase = 'fight'; room.scene = (SCENES[d.id] || [''])[0]; spawn(room, makeFoe(room, d, 'fight'), now);
    log(room, `Отряд входит в «${d.name}». Зал 1: ${room.foe.name}.`, now);
    tellParty(world, room, me, '⚔️', `Лидер начал поход в «${d.name}»! Откройте кооп, чтобы сражаться.`, now);
    return ok({room: view(room, me, world)});
  }
  if (path === '/api/coop/vote' || path === '/api/coop/choose') {
    if (room.status !== 'active' || room.phase !== 'choose') return fail('Сейчас нет развилки.');
    const opt = room.options.find(o => o.id === body.optionId);
    if (!opt) return fail('Такого пути нет.');
    if (path === '/api/coop/vote') { room.votes[String(me)] = opt.id; log(room, `${self.name} предлагает: «${opt.name}».`, now); return ok({room: view(room, me, world)}); }
    enterHall(world, room, d, opt.id, now); settleCompanions(world, room);
    return ok({room: view(room, me, world)});
  }
  if (path === '/api/coop/act') {
    if (room.status !== 'active' || room.phase !== 'fight' || !room.foe) return fail('Сейчас нельзя сражаться.');
    const action = String(body.action || '');
    if (!ACTIONS.has(action)) return fail('Неизвестное действие.');
    self.maxMp ||= 100; self.mp ??= self.maxMp; self.potions ??= POTIONS;
    const kit = kitOf(world, me); self.talents = kit.talents || {};
    if (action === 'hurry') {  // the ally is away: their turn is skipped
      if (!self.acted) return fail('Сначала сделайте свой ход.');
      const w = waitingFor(room); if (!w.length) return fail('Все уже походили.');
      log(room, `⏩ ${self.name} не ждёт: ${w.map(m => m.name).join(', ')} пропускает ход`, now);
      for (const m of w) m.acted = true; advance(world, room, d, now); settleCompanions(world, room); return ok({room: view(room, me, world)});
    }
    if (self.hp <= 0) return fail('Вы без сил. Союзник может поднять вас лечением, или дождитесь святилища.');
    if (self.acted) return fail(`Вы уже походили. Ждём: ${waitingFor(room).map(m => m.name).join(', ')}.`);
    const t = kit.talents || {};
    if (action === 'skill') {
      const sk = kit.skills.find(x => x.id === body.skillId); if (!sk) return fail('Навык не найден — откройте окно заново.');
      if (self.mp < sk.mana) return fail(`Недостаточно маны: нужно ${sk.mana}.`);
      self.mp -= sk.mana;
      const team = alive(room), last = room.lastSkill;
      const healTarget = sk.heal > 0 ? (team.find(m => same(m.id, body.targetId)) || present(room).filter(m => m.hp > 0 || sk.heal > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]) : null;
      const r = castSkill({self, foe: room.foe, kit, sk, ownLast: self.lastSkill, allyLast: last && !same(last.by, me) ? last.sk : null, allyName: last?.name,
        hit: (mult, ignoreDef) => hitFoe(room, self, mult, now, {ignoreDef}), healTarget});
      if (r.combo) { log(room, `⚡ СВЯЗКА! ${r.combo.icon} «${r.combo.name}» (${r.combo.with} + ${self.name})`, now); logQuest(world, me, 'coop_combo', now); if (last) logQuest(world, last.by, 'coop_combo', now); }
      log(room, `${sk.icon} ${self.name} — «${sk.name}»${r.parts.length ? ': ' + r.parts.join(', ') : ''}`, now);
      self.lastSkill = {id: sk.id};
      room.lastSkill = r.combo ? null : {by: String(me), name: self.name, sk};
    } else if (action === 'attack') {
      const crit = Math.random() < (self.crit || 0.12), dmg = hitFoe(room, self, crit ? 1.6 : 1, now);
      if (crit && t.critMana) self.mp = Math.min(self.maxMp, self.mp + Math.round(self.maxMp * t.critMana / 100));
      const gp = gemProcs(self, room.foe, kit);
      log(room, `${self.name} атакует: ${dmg}${crit ? ' (крит!)' : ''}${gp.length ? ', ' + gp.join(', ') : ''}`, now);
    } else if (action === 'guard') {
      self.guard = true; const mpGain = Math.round(self.maxMp * (GUARD_MP + (t.blockMana || 0) / 100)); self.mp = Math.min(self.maxMp, self.mp + mpGain);
      const heal = t.defendHeal ? Math.round(self.maxHp * t.defendHeal / 100) : 0; if (heal) self.hp = Math.min(self.maxHp, self.hp + heal);
      log(room, `🛡️ ${self.name} в защите: прикрывает отряд, +${mpGain} MP${heal ? `, +${heal} HP` : ''}`, now);
    } else if (action === 'potion') {
      if (self.potions <= 0) return fail('Зелья закончились.');
      self.potions--; const team = present(room), target = team.find(m => same(m.id, body.targetId)) || self;
      const revive = target.hp === 0, amount = Math.round(target.maxHp * (revive ? 0.3 : 0.4)); target.hp = Math.min(target.maxHp, target.hp + amount);
      log(room, revive ? `🧪 ${self.name} поднимает ${target.name} зельем (+${amount} HP)` : `🧪 ${self.name} пьёт зелье${target !== self ? ' за ' + target.name : ''}: +${amount} HP (осталось ${self.potions})`, now);
    }
    self.acted = true;
    if (room.foe && room.foe.hp <= 0) foeDown(world, room, d, now);
    else advance(world, room, d, now);
    settleCompanions(world, room);
    return ok({room: view(room, me, world)});
  }
  if (path === '/api/coop/ping') {
    const PINGS = {help: '🆘 Нужна помощь!', guard: '🛡️ Прикрой меня!', combo: '⚡ Готов к связке — жмите способность!', focus: '🎯 Все в атаку!', ok: '👍 Принято'};
    const text = PINGS[body.kind]; if (!text) return fail('Неизвестный сигнал.');
    if ((self.pingAt || 0) > now - 1500) return fail('Не так часто.');
    self.pingAt = now; log(room, `📣 ${self.name}: ${text}`, now);
    return ok({room: view(room, me, world)});
  }
  if (path === '/api/coop/claim') {
    const reward = room.rewards?.[String(me)];
    if (room.status !== 'won' || !reward) return fail('Награды нет.', 404);
    if (reward.claimed) return ok({reward, alreadyClaimed: true});
    reward.claimed = true; self.left = true;
    return ok({reward});
  }
  return fail('API не найден.', 404);
}
