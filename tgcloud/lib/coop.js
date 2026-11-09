// Co-op dungeons: a leader opens a room, up to two allies join, the party walks through 7 halls.
// Between halls the leader picks a path (allies can vote): fights, elites, traps/falls, treasure, shrines.
// All combat is resolved on the server from server-side level/class, so clients cannot inflate stats.
import {pushEvent, logQuest} from './arenaExtras.js';

const MAX_MEMBERS = 3, ROOMS = 7, IDLE_MS = 30 * 60 * 1000;
const COOLDOWN = {attack: 900, power: 4500, heal: 4000, guard: 6000, spell: 1};
// Each class has its own spell. Two different heroes casting within COMBO_MS chain into a combo; a third makes a triple.
export const SPELLS = {
  warrior: {name: 'Боевой клич', icon: '📯', el: 'phys', cd: 15000, text: '+25% урона всему отряду на 6 с'},
  knight: {name: 'Стена щитов', icon: '🧱', el: 'holy', cd: 18000, text: '−40% урона по отряду на 6 с'},
  paladin: {name: 'Свет небес', icon: '🌟', el: 'holy', cd: 16000, text: 'лечит весь отряд на 20%'},
  berserker: {name: 'Кровавая ярость', icon: '🩸', el: 'phys', cd: 12000, text: 'удар ×3.2, стоит 10% вашего HP'},
  rogue: {name: 'Ядовитый клинок', icon: '🧪', el: 'nature', cd: 12000, text: 'удар ×1.3 и яд на 3 хода врага'},
  assassin: {name: 'Удар в спину', icon: '🗡️', el: 'shadow', cd: 12000, text: 'гарантированный крит ×2.6'},
  hunter: {name: 'Метка охотника', icon: '🎯', el: 'nature', cd: 16000, text: 'враг получает +30% урона 8 с'},
  mage: {name: 'Огненный шар', icon: '🔥', el: 'fire', cd: 12000, text: 'урон ×2.6 и поджог на 2 хода'},
  necromancer: {name: 'Похищение жизни', icon: '💀', el: 'shadow', cd: 12000, text: 'урон ×1.8, лечит вас на половину урона'},
  druid: {name: 'Оплетающие корни', icon: '🌿', el: 'nature', cd: 18000, text: 'враг пропускает ход (+3 с), отряд +10% HP'}};
export const ELEMENT_RU = {phys: '⚔️ Сила', holy: '✨ Свет', nature: '🌿 Природа', shadow: '🌑 Тьма', fire: '🔥 Огонь'};
const COMBO_MS = 5000;
const COMBOS = {'fire+nature': ['🔥🌿', 'Лесной пожар', 'dot'], 'holy+shadow': ['☯️', 'Сумеречный разлом', 'burst'], 'fire+shadow': ['😈', 'Адское пламя', 'burst'], 'fire+holy': ['☀️', 'Священный огонь', 'heal'],
  'nature+shadow': ['☠️', 'Гнилая чума', 'dot'], 'holy+nature': ['🌳', 'Благословение рощи', 'heal'], 'fire+phys': ['☄️', 'Пылающий натиск', 'burst'], 'nature+phys': ['🌪️', 'Удар бури', 'stun'],
  'phys+shadow': ['🌑', 'Удар из тьмы', 'burst'], 'holy+phys': ['⚔️', 'Клятва рыцарей', 'heal'], 'phys+phys': ['🤜', 'Двойной натиск', 'stun']};
const comboOf = (a, b) => COMBOS[[a, b].sort().join('+')] || ['💫', 'Слияние стихий', 'burst'];
export const COMBO_LIST = Object.entries(COMBOS).map(([k, [icon, name, kind]]) => ({els: k.split('+'), icon, name, kind}));
const GUARD_MS = 5000;
// Tuned by simulation: a full run takes ~1.5–4 min; careless duos at the minimum level often fall to the boss.
const HP_TUNE = {goblin_cave: 1.4, spider_den: 1.3, crypt_depths: 0.75, rift_gate: 0.35};
const ATK_TUNE = 2.4;
let nowRef = 0; const clock = () => nowRef || Date.now();
// The enemy acts on its own clock and announces its next move, so the party can react (guard, heal).
const enemyMs = (room, foe) => Math.round((foe.boss ? 2600 : foe.elite ? 2800 : 3000) / (1 + 0.2 * (present(room).length - 1)));
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

function memberStats(p) {
  const level = Math.max(1, Math.min(120, Number(p?.level) || 1)), c = CLASS[p?.class_id] || CLASS.warrior;
  return {level, classId: p?.class_id || 'warrior', healer: !!c.healer, maxHp: Math.round((160 + level * 48) * c.hp), atk: Math.round((18 + level * 7) * c.atk), def: Math.round((6 + level * 3) * c.def)};
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
function spawn(room, foe, now) { room.foe = foe; rollIntent(room, foe); foe.nextAt = now + enemyMs(room, foe) + 1500; }
function tick(world, room, now) {
  const foe = room.foe;
  if (room.status !== 'active' || room.phase !== 'fight' || !foe || foe.hp <= 0) return;
  const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId);
  if (!foe.nextAt) foe.nextAt = now + enemyMs(room, foe);
  const ms = enemyMs(room, foe);
  if (now - foe.nextAt > 3 * ms) foe.nextAt = now - ms + 1;   // nobody was watching: no backlog of free hits
  for (let i = 0; i < 2 && now >= foe.nextAt && room.status === 'active' && room.foe === foe; i++) {
    const at = foe.nextAt; foe.nextAt += ms;
    if (applyDots(room, at)) { foeDown(world, room, d, at); return; }
    enemyTurn(room, at);
  }
}
function applyDots(room, now) {
  const foe = room.foe; if (!foe?.dots?.length) return false;
  for (const dot of foe.dots) { foe.hp = Math.max(0, foe.hp - dot.per); dot.left--; log(room, `${dot.icon} ${dot.name}: −${dot.per}`, now); }
  foe.dots = foe.dots.filter(x => x.left > 0);
  return foe.hp <= 0;
}
function foeDown(world, room, d, now) {
  log(room, `Победа над врагом «${room.foe.name}»!`, now); room.chain = null; room.fx = {};
  for (const m of present(room)) logQuest(world, m.id, 'coop_kill', now);
  if (room.stage >= ROOMS) finish(world, room, d, now);
  else { for (const m of alive(room)) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.15)); offerPaths(room, now); }
}
const dmgMods = (room, now) => ((room.fx?.warcry || 0) > now ? 1.25 : 1) * ((room.foe?.markUntil || 0) > now ? 1.3 : 1);
function hitFoe(room, self, mult, now, {ignoreDef = 0} = {}) {
  const def = room.foe.def * (1 - ignoreDef);
  const dmg = Math.max(1, Math.round(self.atk * rand(0.9, 1.1) * mult * dmgMods(room, now) * (1 - def / (def + 75))));
  room.foe.hp = Math.max(0, room.foe.hp - dmg); return dmg;
}
function castSpell(world, room, self, now) {
  const sp = SPELLS[self.classId] || SPELLS.warrior, foe = room.foe, team = alive(room); let note = '';
  switch (self.classId in SPELLS ? self.classId : 'warrior') {
    case 'warrior': room.fx = {...room.fx, warcry: now + 6000}; note = 'отряд бьёт на 25% сильнее'; break;
    case 'knight': room.fx = {...room.fx, wall: now + 6000}; note = 'урон по отряду −40%'; break;
    case 'paladin': for (const m of present(room)) if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.2)); note = 'отряд +20% HP'; break;
    case 'berserker': { const cost = Math.round(self.maxHp * 0.1); self.hp = Math.max(1, self.hp - cost); note = `−${hitFoe(room, self, 3.2, now)} (−${cost} своих HP)`; break; }
    case 'rogue': { const dmg = hitFoe(room, self, 1.3, now); (foe.dots ||= []).push({icon: '🧪', name: 'Яд', per: Math.round(self.atk * 0.7), left: 3}); note = `−${dmg} и яд`; break; }
    case 'assassin': note = `−${hitFoe(room, self, 2.6 * 1.6, now, {ignoreDef: 0.3})} (крит!)`; break;
    case 'hunter': foe.markUntil = now + 8000; note = 'враг получает +30% урона'; break;
    case 'mage': { const dmg = hitFoe(room, self, 2.6, now, {ignoreDef: 0.4}); (foe.dots ||= []).push({icon: '🔥', name: 'Поджог', per: Math.round(self.atk * 0.6), left: 2}); note = `−${dmg} и поджог`; break; }
    case 'necromancer': { const dmg = hitFoe(room, self, 1.8, now), heal = Math.round(dmg / 2); self.hp = Math.min(self.maxHp, self.hp + heal); note = `−${dmg}, +${heal} HP себе`; break; }
    case 'druid': foe.nextAt = (foe.nextAt || now) + 3000; for (const m of team) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.1)); note = 'враг пропускает ход, отряд +10% HP'; break;
  }
  log(room, `${sp.icon} ${self.name} — «${sp.name}»: ${note}`, now);
  // combo chain
  const ch = room.chain;
  if (ch && now - ch.at <= COMBO_MS && !ch.ids.includes(String(self.id)) && foe.hp > 0) {
    const prev = ch.els[ch.els.length - 1], [icon, name, kind] = comboOf(prev, sp.el), triple = ch.ids.length >= 2;
    const partner = present(room).find(m => same(m.id, ch.ids[ch.ids.length - 1]));
    const base = (self.atk + (partner?.atk || self.atk)) * (triple ? 1.9 : 1.2) * (kind === 'burst' ? 1.5 : 1);
    const def = foe.def * 0.5, dmg = Math.max(1, Math.round(base * rand(0.95, 1.05) * dmgMods(room, now) * (1 - def / (def + 75))));
    foe.hp = Math.max(0, foe.hp - dmg);
    let extra = '';
    if (kind === 'dot') { (foe.dots ||= []).push({icon, name, per: Math.round(base * 0.35), left: 3}); extra = ', враг горит/гниёт 3 хода'; }
    if (kind === 'heal') { for (const m of present(room)) if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.12)); extra = ', отряд +12% HP'; }
    if (kind === 'stun') { foe.nextAt = (foe.nextAt || now) + 2000; extra = ', враг оглушён (+2 с)'; }
    logQuest(world, self.id, 'coop_combo', now); if (partner) logQuest(world, partner.id, 'coop_combo', now);
    log(room, `${triple ? '🌟 ТРОЙНАЯ СВЯЗКА! ' : '⚡ СВЯЗКА! '}${icon} «${name}» (${partner?.name || ''} + ${self.name}): −${dmg}${extra}`, now);
    if (triple) room.chain = null; else { ch.ids.push(String(self.id)); ch.els.push(sp.el); ch.at = now; ch.by = self.name; }
  } else room.chain = {ids: [String(self.id)], els: [sp.el], at: now, by: self.name};
}
function intentText(room) {
  const i = room.foe?.intent; if (!i) return '';
  const guard = alive(room).find(m => (m.guardUntil || 0) > clock());
  if (i.kind === 'aoe') return 'набирает силу для удара по всему отряду';
  const who = guard && i.kind !== 'aoe' ? `${guard.name} (прикрывает)` : i.targetName;
  return i.kind === 'heavy' ? `готовит сокрушительный удар — цель: ${who}, ×1.7 урона` : `атакует — цель: ${who}`;
}
const log = (room, text, now) => { room.log.push({at: new Date(now).toISOString(), text}); room.log = room.log.slice(-50); };
function myRoom(world, me) { return rows(world, 'coop_rooms').find(r => ['lobby', 'active', 'won', 'failed'].includes(r.status) && r.members.some(m => same(m.id, me) && !m.left)); }
function expire(world, now) {
  for (const r of rows(world, 'coop_rooms')) if (['lobby', 'active'].includes(r.status) && Date.parse(r.updated_at) < now - IDLE_MS) r.status = 'expired';
  world.tables.coop_rooms = rows(world, 'coop_rooms').filter(r => Date.parse(r.updated_at) > now - 24 * 3600e3);
}
function view(room, me) {
  const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId);
  return {id: room.id, dungeon: {id: d.id, name: d.name, minLevel: d.minLevel, maxLevel: d.maxLevel}, status: room.status, phase: room.phase, hostId: room.hostId, stage: room.stage, rooms: ROOMS,
    foe: room.foe ? {name: room.foe.name, boss: room.foe.boss, elite: room.foe.elite, hp: room.foe.hp, maxHp: room.foe.maxHp, atk: room.foe.atk, def: room.foe.def, desc: room.foe.desc || FOE_INFO[room.foe.name] || '',
      intent: room.foe.intent?.kind || null, intentText: intentText(room), nextIn: room.foe.nextAt ? Math.max(0, room.foe.nextAt - clock()) : null} : null,
    scene: room.scene || '',
    fx: {warcry: Math.max(0, (room.fx?.warcry || 0) - clock()), wall: Math.max(0, (room.fx?.wall || 0) - clock()), mark: Math.max(0, (room.foe?.markUntil || 0) - clock()), dots: (room.foe?.dots || []).map(x => ({icon: x.icon, name: x.name, left: x.left}))},
    chain: room.chain && clock() - room.chain.at <= COMBO_MS && room.foe ? {by: room.chain.by, ids: room.chain.ids, els: room.chain.els, left: COMBO_MS - (clock() - room.chain.at), next: room.chain.ids.length >= 2 ? 'triple' : 'combo',
      preview: (() => { const mm = room.members.find(m => same(m.id, me)); if (!mm || room.chain.ids.includes(String(me))) return null; const [icon, name, kind] = comboOf(room.chain.els[room.chain.els.length - 1], (SPELLS[mm.classId] || SPELLS.warrior).el); return {icon, name, kind}; })()} : null,
    options: room.phase === 'choose' ? room.options.map(o => ({id: o.id, name: o.name, icon: o.icon, hint: o.hint, votes: Object.values(room.votes || {}).filter(v => v === o.id).length})) : [],
    myVote: room.votes?.[String(me)] || null, bonus: room.bonus || 0, log: room.log.slice(-18), isHost: same(room.hostId, me),
    members: present(room).map(m => ({id: m.id, name: m.name, level: m.level, classId: m.classId, healer: m.healer, hp: m.hp, maxHp: m.maxHp, atk: m.atk, def: m.def, guardUntil: Math.max(0, (m.guardUntil || 0) - clock()), spell: {...(SPELLS[m.classId] || SPELLS.warrior), elRu: ELEMENT_RU[(SPELLS[m.classId] || SPELLS.warrior).el]},
      cooldowns: same(m.id, me) ? Object.fromEntries(Object.entries(m.next || {}).map(([k, v]) => [k, Math.max(0, v - clock())])) : undefined})),
    reward: room.rewards?.[String(me)] || null};
}
const tellParty = (world, room, except, icon, text, now) => { for (const m of present(room)) if (!same(m.id, except)) pushEvent(world, m.id, icon, text, 'coop', {roomId: room.id}, now); };

function offerPaths(room, now) {
  if (room.stage >= ROOMS) { room.phase = 'fight'; room.foe = null; return; }
  const pool = PATHS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  room.options = pool.map(p => ({id: p.id, name: p.name, icon: p.icon, hint: p.hint})); room.votes = {}; room.phase = 'choose'; room.foe = null;
  log(room, `Развилка перед залом ${room.stage + 1}. Лидер выбирает путь, союзники могут голосовать.`, now);
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
function enemyTurn(room, now) {
  const team = alive(room);
  if (!team.length || !room.foe || room.foe.hp <= 0) return;
  if (!room.foe.intent) rollIntent(room, room.foe);
  const it = room.foe.intent; room.foe.hits++;
  const aoe = it.kind === 'aoe', heavy = it.kind === 'heavy';
  const guard = team.find(m => (m.guardUntil || 0) > now);
  const aimed = team.find(m => same(m.id, it.targetId)) || team[Math.floor(Math.random() * team.length)];
  const targets = aoe ? team : [guard || aimed];
  for (const t of targets) {
    const raw = room.foe.atk * rand(0.85, 1.15) * (aoe ? 0.7 : heavy ? 1.7 : 1) * ((room.fx?.wall || 0) > now ? 0.6 : 1), mit = t.def / (t.def + 75), shield = (t.guardUntil || 0) > now ? 0.4 : 1;
    const dmg = Math.max(1, Math.round(raw * (1 - mit) * shield));
    t.hp = Math.max(0, t.hp - dmg);
    log(room, `${aoe ? '🌀' : heavy ? '💢' : '🗡️'} ${room.foe.name} ${aoe ? 'бьёт по всему отряду: ' : heavy ? 'сокрушает ' : 'бьёт '}${t.name} на ${dmg}${shield < 1 ? ' (щит)' : ''}${t.hp === 0 ? ' — герой без сил!' : ''}`, now);
  }
  rollIntent(room, room.foe);
  if (!alive(room).length) { room.status = 'failed'; room.phase = 'end'; log(room, 'Отряд пал. Подземелье не пройдено.', now); }
}
function finish(world, room, d, now) {
  room.status = 'won'; room.phase = 'end'; room.rewards = {};
  const team = present(room), mult = (1 + 0.1 * (team.length - 1)) * (1 + (room.bonus || 0));
  for (const m of team) logQuest(world, m.id, 'coop_win', now);
  for (const m of team) room.rewards[String(m.id)] = {gold: Math.round(d.gold * mult), silver: Math.round(d.silver * mult), exp: Math.round(d.exp * mult), fragment: Math.random() < 0.35 + (room.bonus || 0) * 0.3, claimed: false};
  log(room, `Победа! «${d.boss}» больше не угрожает королевству. Заберите награду.`, now);
  tellParty(world, room, null, '🏆', `Отряд прошёл «${d.name}»! Заберите награду в кооп-подземельях.`, now);
}

export async function handleCoopRequest(world, input, user, now, notify) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/coop')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = user.id, p = player(world, me);
  if (!p) return fail('Сначала создайте персонажа.', 404);
  nowRef = now;
  expire(world, now);
  const stamp = new Date(now).toISOString();
  let room = myRoom(world, me);
  if (room) tick(world, room, now);
  if (method === 'GET' && path === '/api/coop/rooms') {
    const lvl = Number(p.level) || 1;
    const open = rows(world, 'coop_rooms').filter(r => r.status === 'lobby' && present(r).length < MAX_MEMBERS)
      .map(r => ({...view(r, me), fits: lvl >= COOP_DUNGEONS.find(d => d.id === r.dungeonId).minLevel}));
    return ok({dungeons: COOP_DUNGEONS.map(({id, name, minLevel, maxLevel}) => ({id, name, minLevel, maxLevel})), open, mine: room ? view(room, me) : null});
  }
  if (method === 'GET' && path === '/api/coop/room') return ok({room: room ? view(room, me) : null});
  if (method !== 'POST') return fail('Метод не поддерживается.', 405);
  const meStats = memberStats(p), meMember = () => ({id: String(me), name: nameOf(p), ...meStats, hp: meStats.maxHp, next: {}});
  if (path === '/api/coop/create') {
    if (room && ['lobby', 'active'].includes(room.status)) return fail('Вы уже в отряде. Сначала покиньте его.');
    const d = COOP_DUNGEONS.find(x => x.id === body.dungeonId);
    if (!d) return fail('Подземелье не найдено.', 404);
    if (meStats.level < d.minLevel) return fail(`Нужен ${d.minLevel} уровень.`);
    if (room) room.members.find(m => same(m.id, me)).left = true;
    room = {id: crypto.randomUUID(), dungeonId: d.id, hostId: String(me), status: 'lobby', phase: 'lobby', stage: 0, members: [meMember()], foe: null, options: [], votes: {}, bonus: 0, log: [], created_at: stamp, updated_at: stamp};
    log(room, `${nameOf(p)} открыл(а) комнату «${d.name}». Ждём союзников.`, now);
    rows(world, 'coop_rooms').push(room);
    return ok({room: view(room, me)}, 201);
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
    return ok({room: view(target, me)});
  }
  if (!room) return fail('Вы не в отряде.', 404);
  const d = COOP_DUNGEONS.find(x => x.id === room.dungeonId), self = room.members.find(m => same(m.id, me));
  room.updated_at = stamp;
  if (path === '/api/coop/leave') {
    self.left = true; log(room, `${self.name} покидает отряд.`, now);
    tellParty(world, room, me, '🚪', `${self.name} покинул(а) отряд в «${d.name}».`, now);
    const rest = present(room);
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
  if (path === '/api/coop/start') {
    if (!same(room.hostId, me)) return fail('Начать может только лидер отряда.');
    if (room.status !== 'lobby') return fail('Поход уже начат.');
    if (present(room).length < 2) return fail('Нужно минимум 2 героя.');
    room.status = 'active'; room.stage = 1; room.phase = 'fight'; room.scene = (SCENES[d.id] || [''])[0]; spawn(room, makeFoe(room, d, 'fight'), now);
    log(room, `Отряд входит в «${d.name}». Зал 1: ${room.foe.name}.`, now);
    tellParty(world, room, me, '⚔️', `Лидер начал поход в «${d.name}»! Откройте кооп, чтобы сражаться.`, now);
    return ok({room: view(room, me)});
  }
  if (path === '/api/coop/vote' || path === '/api/coop/choose') {
    if (room.status !== 'active' || room.phase !== 'choose') return fail('Сейчас нет развилки.');
    const opt = room.options.find(o => o.id === body.optionId);
    if (!opt) return fail('Такого пути нет.');
    if (path === '/api/coop/vote') { room.votes[String(me)] = opt.id; log(room, `${self.name} предлагает: «${opt.name}».`, now); return ok({room: view(room, me)}); }
    if (!same(room.hostId, me)) return fail('Путь выбирает лидер отряда.');
    enterHall(world, room, d, opt.id, now);
    return ok({room: view(room, me)});
  }
  if (path === '/api/coop/act') {
    if (room.status !== 'active' || room.phase !== 'fight' || !room.foe) return fail('Сейчас нельзя сражаться.');
    const action = String(body.action || '');
    if (!COOLDOWN[action]) return fail('Неизвестное действие.');
    if (self.hp <= 0) return fail('Вы без сил. Дождитесь лечения союзника или святилища.');
    self.next ||= {};
    if ((self.next[action] || 0) > now) return fail('Действие ещё восстанавливается.');
    self.next[action] = now + (action === 'spell' ? (SPELLS[self.classId] || SPELLS.warrior).cd : COOLDOWN[action]);
    if (action === 'spell') castSpell(world, room, self, now);
    else if (action === 'attack' || action === 'power') {
      const crit = Math.random() < 0.12, mult = (action === 'power' ? 2.2 : 1) * (crit ? 1.6 : 1);
      const dmg = hitFoe(room, self, mult, now);
      log(room, `${self.name}${action === 'power' ? ' проводит мощный удар' : ' атакует'}: ${dmg}${crit ? ' (крит!)' : ''}`, now);
    } else if (action === 'heal') {
      const team = present(room), target = team.find(m => same(m.id, body.targetId)) || team.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const revive = target.hp === 0, amount = Math.round(target.maxHp * (revive ? 0.3 : self.healer ? 0.4 : 0.25));
      target.hp = Math.min(target.maxHp, target.hp + amount);
      log(room, revive ? `${self.name} поднимает ${target.name} (+${amount} HP)` : `${self.name} лечит ${target.name}: +${amount} HP`, now);
    } else if (action === 'guard') { self.guardUntil = now + GUARD_MS; log(room, `${self.name} прикрывает отряд щитом и берёт удар на себя`, now); }
    if (room.foe && room.foe.hp <= 0) foeDown(world, room, d, now);
    return ok({room: view(room, me)});
  }
  if (path === '/api/coop/ping') {
    const PINGS = {help: '🆘 Нужна помощь!', guard: '🛡️ Прикрой меня!', combo: '⚡ Готов к связке — жмите способность!', focus: '🎯 Все в атаку!', ok: '👍 Принято'};
    const text = PINGS[body.kind]; if (!text) return fail('Неизвестный сигнал.');
    if ((self.pingAt || 0) > now - 1500) return fail('Не так часто.');
    self.pingAt = now; log(room, `📣 ${self.name}: ${text}`, now);
    return ok({room: view(room, me)});
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
