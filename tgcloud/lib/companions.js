// Companions: a player's own bot allies. Unlike the one-off hirelings in co-op, a companion stays with the hero,
// gains levels (from co-op runs and gold training) and wears real gear moved out of the hero's bag.
// Gear lives inside the companion row; taking it off puts it back into the bag as a server-owned item.
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const iso = t => new Date(t).toISOString();
const DAY = 864e5;

export const COMP_ROLES = {
  tank: {cls: 'knight', label: 'Танк', icon: '🛡️', text: 'Закрывает отряд щитом от сильных ударов, бьёт «Сокрушающим выпадом».'},
  heal: {cls: 'druid', label: 'Лекарь', icon: '💚', text: 'Лечит самого раненого, поднимает павших зельем.'},
  dps: {cls: 'mage', label: 'Боец', icon: '🔥', text: 'Наносит больше всех урона «Огненным шаром».'},
};
const CLASS = {knight: {hp: 1.3, atk: 0.9, def: 1.4}, druid: {hp: 1.0, atk: 1.0, def: 0.95}, mage: {hp: 0.8, atk: 1.4, def: 0.7}};
export const SLOTS = ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'belt', 'cloak', 'amulet', 'ring', 'artifact'];
export const SLOT_RU = {weapon: 'Оружие', offhand: 'Щит / левая рука', helmet: 'Шлем', armor: 'Доспех', pants: 'Поножи', gloves: 'Перчатки', boots: 'Сапоги', belt: 'Пояс', cloak: 'Плащ', amulet: 'Амулет', ring: 'Кольцо', artifact: 'Артефакт'};
const HIRE = [1000, 6000, 20000], MAX = 3, TRAIN_PER_DAY = 3;
// The Barracks opens step by step with the hero's level (all of it by level 20).
export const UNLOCK = {barracks: 5, train: 8, assist: 10, coop: 12, second: 14, autoAssist: 16, third: 20};
export const SLOT_LVL = {weapon: 5, armor: 5, helmet: 10, boots: 10, gloves: 10, pants: 14, belt: 14, cloak: 14, offhand: 18, amulet: 18, ring: 18, artifact: 18};
const maxComps = L => L >= UNLOCK.third ? 3 : L >= UNLOCK.second ? 2 : L >= UNLOCK.barracks ? 1 : 0;
export const xpNeed = lvl => Math.round(80 * Math.pow(lvl, 1.5));
const N = v => Math.max(0, Number(v) || 0);

// Stats: the class formula at the companion's level plus everything its gear gives.
export function compStats(c) {
  const k = CLASS[COMP_ROLES[c.role]?.cls] || CLASS.knight, L = Math.max(1, c.lvl || 1), g = {atk: 0, def: 0, hp: 0, crit: 0, mp: 0};
  for (const it of Object.values(c.gear || {})) { const s = it?.stats || {}, up = 1 + N(it.upgradeLevel) * 0.05;
    g.atk += (N(s.attack) + N(s.magicAttack) + N(s.physicalAttack) + N(s.strength) * 2 + N(s.intelligence) * 2 + N(s.agility)) * up;
    g.def += (N(s.defense) + N(s.vitality) * 0.5) * up; g.hp += (N(s.maxHp) + N(s.hp) + N(s.vitality) * 10) * up; g.crit += N(s.critChance); g.mp += N(s.maxMp); }
  return {level: L, classId: COMP_ROLES[c.role]?.cls || 'knight', maxHp: Math.round((160 + L * 48) * k.hp * 0.9 + g.hp), atk: Math.round((18 + L * 7) * k.atk * 0.8 + g.atk),
    def: Math.round((6 + L * 3) * k.def * 0.9 + g.def), crit: Math.min(0.5, 0.08 + g.crit / 100), maxMp: Math.round(100 + L * 4 + g.mp)};
}
// Daily wage: a little gold per day, paid ahead (up to 7 days). An unpaid companion rests: no fights, no co-op.
export const wageOf = c => Math.round(40 + (c.lvl || 1) * 6);
export const isPaid = (c, now = Date.now()) => !c.paidUntil || Date.parse(c.paidUntil) > now;
const view = (c, now = Date.now()) => ({paid: isPaid(c, now), paidUntil: c.paidUntil || null, wage: wageOf(c), id: c.id, name: c.name, role: c.role, roleLabel: COMP_ROLES[c.role].label, icon: COMP_ROLES[c.role].icon, roleText: COMP_ROLES[c.role].text, lvl: c.lvl, xp: c.xp, need: xpNeed(c.lvl),
  stats: compStats(c), gear: c.gear || {}, runs: c.runs || 0, wins: c.wins || 0});
const mine = (world, me) => rows(world, 'ae_companions').filter(c => same(c.u, me));
export const companionOf = (world, me, id) => rows(world, 'ae_companions').find(c => same(c.u, me) && c.id === id) || null;

// XP from a co-op run (called by coop.js); a companion never outgrows its hero.
export function giveCompanionXp(world, me, id, xp, won) {
  const c = companionOf(world, me, id); if (!c) return null;
  const cap = Math.max(1, Number(player(world, me)?.level) || 1), before = c.lvl;
  c.runs = (c.runs || 0) + 1; if (won) c.wins = (c.wins || 0) + 1;
  addXp(c, Math.round(xp), cap); compAwards(world, me, Date.now());
  return {name: c.name, xp: Math.round(xp), up: c.lvl - before, lvl: c.lvl};
}
function addXp(c, xp, cap) {
  c.xp = (c.xp || 0) + xp;
  while (c.lvl < cap && c.xp >= xpNeed(c.lvl)) { c.xp -= xpNeed(c.lvl); c.lvl++; }
  if (c.lvl >= cap) c.xp = Math.min(c.xp, xpNeed(c.lvl) - 1);
}
const backToBag = (world, me, item, now) => {
  const id = crypto.randomUUID(), stamp = iso(now);
  rows(world, 'owned_items').push({id, owner_telegram_id: Number(me), item_json: item, quantity: 1, equipped_slot: null, locked: false, bound_clan_id: null, character_id: null, origin: 'companion', created_at: stamp, updated_at: stamp});
  return {...item, id, serverOwned: true, marketTradable: true, isLocked: false, isEquipped: false, stackCount: 1};
};
// ---------- achievements (shown with all other titles in the profile; announced once in the 🔔 history) ----------
export function compCtx(world, me) {
  const list = mine(world, me), heroL = Number(player(world, me)?.level) || 1;
  return {count: list.length, roles: new Set(list.map(c => c.role)).size, maxLvl: list.reduce((m, c) => Math.max(m, c.lvl || 1), 0), gear: list.reduce((m, c) => Math.max(m, Object.keys(c.gear || {}).length), 0),
    wins: list.reduce((s2, c) => s2 + (c.wins || 0), 0), peer: list.some(c => heroL >= 20 && (c.lvl || 1) >= heroL) ? 1 : 0};
}
export const COMP_TITLES = [
  ['comp_first', '🛡️', 'Командир', 'Нанять первого соратника', c => c.count, 1],
  ['comp_squad', '⚔️', 'Полный отряд', 'Нанять трёх соратников', c => c.count, 3],
  ['comp_roles', '🎭', 'Щит, свет и пламя', 'Собрать соратников всех трёх ролей: танка, лекаря и бойца', c => c.roles, 3],
  ['comp_mentor', '📈', 'Наставник', 'Поднять соратника до 30 уровня', c => c.maxLvl, 30],
  ['comp_grand', '🏅', 'Великий наставник', 'Поднять соратника до 60 уровня', c => c.maxLvl, 60],
  ['comp_legend', '👑', 'Легендарный соратник', 'Поднять соратника до 100 уровня', c => c.maxLvl, 100],
  ['comp_peer', '🤝', 'Равный герою', 'Поднять соратника до своего уровня (с 20 уровня героя)', c => c.peer, 1],
  ['comp_armorer', '🧰', 'Оружейник', 'Одеть соратника во все 12 слотов', c => c.gear, 12],
  ['comp_veterans', '🏆', 'Ветераны походов', 'Соратники победили в 25 кооп-подземельях', c => c.wins, 25],
];
export function compAwards(world, me, now) {
  const c = compCtx(world, me); let r = rows(world, 'ae_comp_ach').find(x => same(x.u, me));
  for (const [id, icon, name, desc, val, need] of COMP_TITLES) {
    if ((Number(val(c)) || 0) < need || r?.got.includes(id)) continue;
    if (!r) { r = {u: String(me), got: []}; rows(world, 'ae_comp_ach').push(r); }
    r.got.push(id);
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(me), icon, text: `Достижение «${name}»: ${desc.toLowerCase()}. Титул можно надеть в профиле.`, kind: 'achievement', at: iso(now), acked: false});
  }
}
const NAMES = {tank: ['Бран Железный', 'Тора Стойкая', 'Эдрик Щит'], heal: ['Лиара Светлая', 'Мирена', 'Отец Альвин'], dps: ['Кейн Пламя', 'Ирвена Буря', 'Дарен Клинок']};

export function handleCompanions(world, path, method, body, me, now) {
  const r = companionsRoute(world, path, method, body, me, now);
  if (method === 'POST' && r.status < 300) { try { compAwards(world, me, now); } catch (e) { console.warn('comp awards', e?.message); } }
  return r;
}
function companionsRoute(world, path, method, body, me, now) {
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  for (const c of mine(world, me)) if (!c.paidUntil) c.paidUntil = iso(now + DAY); // the first day is on the house
  const L = Math.max(1, Number(p.level) || 1), list = () => ok({companions: mine(world, me).map(c => view(c, now)), max: MAX, hire: mine(world, me).length < maxComps(L) ? HIRE[mine(world, me).length] ?? null : null, unlock: UNLOCK, slotLvl: SLOT_LVL, maxNow: maxComps(L), nextHireAt: mine(world, me).length >= maxComps(L) && mine(world, me).length < MAX ? [UNLOCK.barracks, UNLOCK.second, UNLOCK.third][mine(world, me).length] : null, roles: COMP_ROLES, slots: SLOTS, slotRu: SLOT_RU,
    train: {left: Math.max(0, TRAIN_PER_DAY - mine(world, me).reduce((s, c) => s + (c.trainDay === iso(now).slice(0, 10) ? c.trains || 0 : 0), 0)), per: TRAIN_PER_DAY}, heroLevel: L});
  if (path === '/api/ae-comp' && method === 'GET') return list();
  if (method !== 'POST') return fail('API не найден.', 404);
  if (path === '/api/ae-comp/hire') {
    const n = mine(world, me).length; if (n >= MAX) return fail(`Соратников может быть не больше ${MAX}.`);
    if (L < UNLOCK.barracks) return fail(`Казарма откроется на ${UNLOCK.barracks} уровне.`);
    if (n >= maxComps(L)) return fail(`Следующий соратник — с ${n === 1 ? UNLOCK.second : UNLOCK.third} уровня.`);
    const role = COMP_ROLES[body.role] ? body.role : null; if (!role) return fail('Выберите роль.');
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 24) || NAMES[role].find(x => !mine(world, me).some(c => c.name === x)) || NAMES[role][0];
    if ((Number(body.pay) || 0) !== HIRE[n]) return fail('Цена изменилась — откройте окно заново.');
    rows(world, 'ae_companions').push({id: crypto.randomUUID().slice(0, 12), u: String(me), name, role, lvl: Math.max(1, L - 5), xp: 0, gear: {}, at: iso(now), paidUntil: iso(now + DAY)});
    return ok({...list().body, paid: HIRE[n]});
  }
  const c = companionOf(world, me, body.id); if (!c) return fail('Соратник не найден.', 404);
  if (path === '/api/ae-comp/fightxp') {  // the companion helped in an ordinary fight that was won
    if (L < UNLOCK.assist) return fail(`Помощь в боях откроется на ${UNLOCK.assist} уровне.`);
    if (!isPaid(c, now)) return fail('Соратник ждёт жалования.');
    const day = iso(now).slice(0, 10); if (c.fxDay !== day) { c.fxDay = day; c.fxN = 0; }
    if (c.fxN >= 40) return ok({gained: 0, lvl: c.lvl, capped: true});
    c.fxN++; const before = c.lvl, xp = Math.max(5, Math.round(xpNeed(c.lvl) * 0.04)); addXp(c, xp, L);
    return ok({gained: xp, lvl: c.lvl, up: c.lvl - before, name: c.name});
  }
  if (path === '/api/ae-comp/pay') {
    const days = Math.max(1, Math.min(7, Math.floor(Number(body.days) || 1))), cost = wageOf(c) * days;
    if ((Number(body.pay) || 0) !== cost) return fail('Сумма изменилась — откройте окно заново.');
    const from = Math.max(now, Date.parse(c.paidUntil || 0) || 0); if (from + days * DAY > now + 8 * DAY) return fail('Платить можно не больше чем на неделю вперёд.');
    c.paidUntil = iso(from + days * DAY);
    return ok({...list().body, paid: cost});
  }
  if (path === '/api/ae-comp/rename') { const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 24); if (name.length < 2) return fail('Имя слишком короткое.'); c.name = name; return list(); }
  if (path === '/api/ae-comp/train') {
    if (L < UNLOCK.train) return fail(`Тренировки откроются на ${UNLOCK.train} уровне.`);
    const day = iso(now).slice(0, 10), used = mine(world, me).reduce((s, x) => s + (x.trainDay === day ? x.trains || 0 : 0), 0);
    if (used >= TRAIN_PER_DAY) return fail('Сегодня тренировок больше нет. Новые — в 00:00 UTC.');
    if (c.lvl >= L) return fail('Соратник не может быть сильнее вас: сначала поднимите свой уровень.');
    const xp = Math.round(xpNeed(c.lvl) * 0.35), cost = Math.round(xp * 0.5);
    if ((Number(body.pay) || 0) !== cost) return fail('Цена изменилась — откройте окно заново.');
    if (c.trainDay !== day) { c.trainDay = day; c.trains = 0; } c.trains++;
    addXp(c, xp, L);
    return ok({...list().body, paid: cost, gained: xp});
  }
  if (path === '/api/ae-comp/equip') {
    const row = rows(world, 'owned_items').find(r => r.id === body.itemId && same(r.owner_telegram_id, me));
    if (!row) return fail('Вещь не найдена в сумке.', 404);
    if (row.equipped_slot || row.locked || row.bound_clan_id) return fail('Эта вещь надета, заблокирована или принадлежит клану.');
    const it = row.item_json || {}, slot = it.type;
    if (!SLOTS.includes(slot)) return fail('Соратнику можно надеть только снаряжение.');
    if (L < SLOT_LVL[slot]) return fail(`Слот «${SLOT_RU[slot]}» откроется на ${SLOT_LVL[slot]} уровне героя.`);
    if ((Number(it.level) || 1) > c.lvl + 3) return fail(`Вещь ${it.level} ур. слишком тяжела: соратнику ${c.lvl} ур. можно до ${c.lvl + 3} ур.`);
    world.tables.owned_items = rows(world, 'owned_items').filter(r => r !== row);
    const back = c.gear?.[slot] ? backToBag(world, me, c.gear[slot], now) : null;
    c.gear = {...(c.gear || {}), [slot]: it};
    return ok({...list().body, back});
  }
  if (path === '/api/ae-comp/unequip') {
    const slot = String(body.slot || ''); if (!c.gear?.[slot]) return fail('Слот пуст.');
    const back = backToBag(world, me, c.gear[slot], now); delete c.gear[slot];
    return ok({...list().body, back});
  }
  if (path === '/api/ae-comp/dismiss') {
    const back = Object.values(c.gear || {}).map(it => backToBag(world, me, it, now));
    world.tables.ae_companions = rows(world, 'ae_companions').filter(x => x !== c);
    return ok({...list().body, backs: back});
  }
  return fail('API не найден.', 404);
}
