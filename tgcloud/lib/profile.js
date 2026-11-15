import {placeOf} from './clanPlus.js';
import {COMP_TITLES, compCtx} from './companions.js';
import {compStats, compImg} from './companions.js';
// Titles earned across the whole game + a chosen avatar (game characters only). Others see both on the player card.
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const ADMIN_ID = '437290420';

const HEROES = ['warrior', 'knight', 'paladin', 'berserker', 'rogue', 'assassin', 'archer', 'hunter', 'mage', 'necromancer', 'druid'];
const HERO_RU = {warrior: 'Воин', knight: 'Рыцарь', paladin: 'Паладин', berserker: 'Берсерк', rogue: 'Разбойник', assassin: 'Ассасин', archer: 'Лучник', hunter: 'Охотник', mage: 'Маг', necromancer: 'Некромант', druid: 'Друид'};
export const AVATARS = [
  ...HEROES.map(c => ({id: 'hero_' + c, name: HERO_RU[c], src: `/assets/sprites/generated/heroes/${c}.webp`})),
  ...[1, 2, 3, 4, 5, 6].map(n => ({id: 'gladiator_' + n, name: `Гладиатор ${n}`, src: `/assets/arena/opp_${n}.webp`})),
  {id: 'char_paladin', name: 'Паладин-командор', src: '/assets/char_warrior_paladin_1790595905774-BjMNog-W.jpg'},
  {id: 'char_sorceress', name: 'Чародейка', src: '/assets/char_mage_sorceress_1790595917068-DxR9yBtf.jpg'},
  {id: 'char_assassin', name: 'Тень гильдии', src: '/assets/char_rogue_assassin_1790595929467-anO2E87T.jpg'},
  {id: 'char_hunter', name: 'Следопыт', src: '/assets/game_hero_hunter_1790595108742-wgn-kliT.jpg'}];

// Profile banners: chosen only in the Android app (an app perk), seen by everyone on the player card.
export const BANNERS = [['plains', 'Зелёные равнины', '/assets/plains-DfAnHj7l.webp'], ['forest', 'Тёмный лес', '/assets/forest-B0c-87GO.webp'], ['crypt', 'Забытый склеп', '/assets/crypt-BTumbge1.webp'],
  ['swamp', 'Гиблые болота', '/assets/swamp-DLuFAhXR.webp'], ['desert', 'Пылающая пустыня', '/assets/desert-CWB6P9JN.webp'], ['rift', 'Демонический разлом', '/assets/rift-DTdreQra.webp'],
  ['dragon', 'Логово дракона', '/assets/cave-dragon-C5DdFomJ.webp'], ['court', 'Двор замка', '/assets/story/courtyard.webp'], ['king', 'Тронный зал', '/assets/story/king.webp'],
  ['party', 'Плечом к плечу', '/assets/story/coop-first-victory.webp'], ['boss', 'Первый босс', '/assets/story/first-boss.webp'], ['tavern', 'Таверна', '/assets/story/tavern-beer.webp']].map(([id, name, src]) => ({id, name, src}));
// The Android app gift: once per hero, claimed only from the app.
export const APK_GIFT = {premiumDays: 7, gold: 5000, silver: 1000, energy: 100, fragments: 3, arenaTickets: 3};
// [id, icon, name, how to earn, value(ctx), need]
const T = (id, icon, name, desc, value, need) => ({id, icon, name, desc, value, need});
export const TITLES = [
  T('newcomer', '🌱', 'Новичок Аэтельгарда', 'Создать героя', () => 1, 1),
  T('veteran', '🎖️', 'Ветеран', 'Достичь 20 уровня', c => c.level, 20),
  T('legend', '🏛️', 'Легенда королевства', 'Достичь 50 уровня', c => c.level, 50),
  T('immortal', '♾️', 'Бессмертный', 'Достичь 100 уровня', c => c.level, 100),
  T('horde_hunter', '🗡️', 'Охотник на орду', 'Победить 100 монстров Орды', c => c.s.horde_kill, 100),
  T('horde_slayer', '⚔️', 'Истребитель орды', 'Победить 1000 монстров Орды', c => c.s.horde_kill, 1000),
  T('unstoppable', '🔥', 'Неудержимый', 'Победить 60 монстров за один поход Орды', c => c.hordeBest, 60),
  T('moon_child', '🌕', 'Дитя Кровавой луны', 'Победить 100 монстров в Кровавую луну', c => c.s.horde_blood_kill, 100),
  T('moon_herald', '🩸', 'Вестник луны', 'Победить 40 монстров за одну Кровавую луну', c => c.bloodBest, 40),
  T('duelist', '🤺', 'Дуэлянт', 'Победить в 10 дуэлях', c => c.s.duel_win, 10),
  T('blade_master', '🗡️', 'Мастер клинка', 'Победить в 100 дуэлях', c => c.s.duel_win, 100),
  T('arena_storm', '⚡', 'Гроза арены', 'Рейтинг дуэлей 1300', c => c.duelRating, 1300),
  T('brother_in_arms', '🤝', 'Боевой товарищ', 'Пройти кооп-подземелье', c => c.s.coop_win, 1),
  T('warband_leader', '🛡️', 'Предводитель отрядов', 'Пройти 25 кооп-подземелий', c => c.s.coop_win, 25),
  T('combo_master', '✨', 'Мастер связок', 'Сделать 50 связок способностей', c => c.s.coop_combo, 50),
  T('dungeon_reaper', '💀', 'Жнец подземелий', 'Победить 200 врагов в коопе', c => c.s.coop_kill, 200),
  T('soul_of_party', '🎉', 'Душа компании', 'Завести 5 друзей', c => c.friends, 5),
  T('merchant', '💰', 'Купец', 'Продать друзьям 5 вещей', c => c.s.trade_sold, 5),
  T('treasure_hunter', '🎁', 'Искатель сокровищ', 'Активировать 3 промокода', c => c.s.promo, 3),
  T('clansman', '🏰', 'Брат по клану', 'Вступить в клан', c => c.clan ? 1 : 0, 1),
  T('patron', '👑', 'Покровитель королевства', 'Активный Premium', c => c.premium ? 1 : 0, 1),
  T('pioneer', '🧭', 'Первопроходец', 'Начать играть до 1 января 2027', c => c.pioneer ? 1 : 0, 1),
  T('ascended_sss', '🌟', 'Первый вознесённый', 'Достичь вознесения ранга SSS', c => c.asc === 'SSS' ? 1 : 0, 1),
  ...COMP_TITLES.map(([id, icon, name, desc, val, need]) => T(id, icon, name, desc, c => val(c.comp), need)),
  T('pocket_hero', '📱', 'Герой в кармане', 'Играть в мобильном приложении Android', c => c.apk ? 1 : 0, 1),
  T('keeper', '🗝️', 'Хранитель Аэтельгарда', 'Администрация игры', c => c.admin ? 1 : 0, 1)];

function ctxOf(world, id, now) {
  const p = player(world, id) || {}, s = rows(world, 'ae_stats').find(x => same(x.u, id))?.c || {};
  const hb = rows(world, 'horde_best').find(x => same(x.user, id)) || {}, dr = rows(world, 'duel_ratings').find(x => same(x.id, id));
  const friends = rows(world, 'friendships').filter(f => f.status === 'accepted' && (same(f.a, id) || same(f.b, id))).length;
  return {level: Number(p.level) || 1, s: new Proxy(s, {get: (o, k) => Number(o[k]) || 0}), hordeBest: hb.kills || 0, bloodBest: hb.bloodKills || 0, duelRating: dr?.rating || 1000,
    friends, asc: rows(world, 'ae_profiles').find(x => same(x.u, id))?.asc || null, clan: !!p.clan_id, premium: Date.parse(p.premium_until || 0) > now, pioneer: Date.parse(p.created_at || now) < Date.parse('2027-01-01T00:00:00Z'), admin: same(id, ADMIN_ID), comp: compCtx(world, id), apk: !!rows(world, 'ae_profiles').find(x => same(x.u, id))?.apkAt};
}
// ---------- profile look, chosen by the player (frames, nickname colour, motto, showcase, aura, card theme) ----------
// [id, name, unlock text, unlocked(ctx)] — the server checks the unlock, the client only shows the choice.
const ASC_I = r => ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'].indexOf(r);
export const STYLE = {
  frame: [['none', 'Без рамки', '', () => true], ['bronze', 'Бронзовая', 'с 10 уровня', c => c.level >= 10], ['silver', 'Серебряная', 'с 30 уровня', c => c.level >= 30], ['gold', 'Золотая', 'с 50 уровня', c => c.level >= 50],
    ['fire', 'Огненная', 'вознесение A', c => ASC_I(c.asc) >= 3], ['frost', 'Ледяная', '50 побед в дуэлях', c => c.s.duel_win >= 50], ['royal', 'Королевская', 'Premium', c => c.premium], ['clan', 'Клановая', 'состоять в клане', c => c.clan],
    ['pocket', 'Мобильная', 'игра в приложении', c => c.apk], ['void', 'Бездна', 'вознесение SSS', c => c.asc === 'SSS']],
  color: [['default', 'Обычный', '', () => true], ['gold', 'Золотой', 'с 40 уровня', c => c.level >= 40], ['crimson', 'Багровый', '100 побед в Орде', c => c.s.horde_kill >= 100], ['emerald', 'Изумрудный', '10 кооп-побед', c => c.s.coop_win >= 10],
    ['azure', 'Лазурный', 'рейтинг дуэлей 1200', c => c.duelRating >= 1200], ['violet', 'Фиолетовый', 'Premium', c => c.premium], ['rainbow', 'Радужный', 'вознесение S', c => ASC_I(c.asc) >= 4]],
  aura: [['none', 'Без ауры', '', () => true], ['ember', 'Тлеющие угли', 'с 20 уровня', c => c.level >= 20], ['frost', 'Морозная дымка', 'с 40 уровня', c => c.level >= 40], ['shadow', 'Тень', 'вознесение B', c => ASC_I(c.asc) >= 2],
    ['holy', 'Сияние', 'вознесение S', c => ASC_I(c.asc) >= 4], ['void', 'Бездна', 'вознесение SSS', c => c.asc === 'SSS'], ['royal', 'Королевская', 'Premium', c => c.premium]],
  theme: [['night', 'Ночь', '', () => true], ['forest', 'Лес', '', () => true], ['ember', 'Пламя', '', () => true], ['ice', 'Лёд', '', () => true], ['royal', 'Королевская', 'с 25 уровня', c => c.level >= 25],
    ['blood', 'Кровавая луна', '40 монстров за одну Кровавую луну', c => c.bloodBest >= 40], ['abyss', 'Бездна', 'вознесение A', c => ASC_I(c.asc) >= 3]],
};
export function styleOptions(world, id, now) {
  const c = ctxOf(world, id, now); return Object.fromEntries(Object.entries(STYLE).map(([k, list]) => [k, list.map(([oid, name, need, f]) => ({id: oid, name, need, open: !!f(c)}))]));
}
const MOTTO_BAD = /(https?:|t\.me|@[a-z0-9_]{4,}|\bwww\.)/i;
function styleOf(world, id, pr, now) {
  const L = pr?.look || {}, opts = styleOptions(world, id, now), pick = (k, v) => opts[k].find(o => o.id === v && o.open)?.id || STYLE[k][0][0];
  const earned = new Map(titlesOf(world, id, now).filter(t => t.earned).map(t => [t.id, t]));
  const comp = L.comp ? rows(world, 'ae_companions').find(c => same(c.u, id) && c.id === L.comp) : null;
  return {frame: pick('frame', L.frame), color: pick('color', L.color), aura: pick('aura', L.aura), theme: pick('theme', L.theme), motto: L.motto || '', showPet: L.showPet !== false,
    showcase: (L.showcase || []).map(t => earned.get(t)).filter(Boolean).slice(0, 3).map(t => ({id: t.id, icon: t.icon, name: t.name})),
    comp: comp ? {name: comp.name, role: comp.role, lvl: comp.lvl, classId: compStats(comp).classId, img: compImg(comp)} : null};
}
export function titlesOf(world, id, now) {
  const c = ctxOf(world, id, now);
  return TITLES.filter(t => t.id !== 'keeper' || c.admin).map(t => { const v = Math.max(0, Number(t.value(c)) || 0); return {id: t.id, icon: t.icon, name: t.name, desc: t.desc, earned: v >= t.need, progress: Math.min(v, t.need), need: t.need}; });
}
// Ascension rank: kept in the hero's save; the client reports it so other players can see it (trials have no hard level gate).
const ASC = [['D', 'Страж порога', 1], ['C', 'Рыцарь зеркального щита', 15], ['B', 'Хранитель живого пламени', 30], ['A', 'Судья трёх стихий', 45],
  ['S', 'Повелитель разлома', 60], ['SS', 'Владыка пустоты', 75], ['SSS', 'Первый вознесённый', 85]];
const ascOf = pr => { const a = ASC.find(x => x[0] === pr?.asc); return a ? {rank: a[0], name: a[1], step: ASC.indexOf(a) + 1} : null; };
const clanOf = (world, id) => { const m = rows(world, 'clan_members').find(x => same(x.telegram_id, id)); const c = m && rows(world, 'clans').find(x => same(x.id, m.clan_id)); return c ? {id: c.id, tag: c.tag, name: c.name, level: Number(c.level) || 1, role: m.role, emblem: rows(world, 'ae_clan_meta').find(x => same(x.clan, c.id))?.emblem || '🛡️'} : null; };
const profileRow = (world, id) => rows(world, 'ae_profiles').find(x => same(x.u, id));
// The hero's active companion: what the game last reported, completed with the level and satiety the server keeps.
const PET_CAT = {pet_wolf: ['Снежный лютоволк', 'rare'], pet_fairy: ['Астральная фея', 'rare'], pet_dragon: ['Огненный дракончик', 'epic'], pet_golem: ['Адамантитовый големчик', 'epic'], pet_voidling: ['Эфирный пустотник', 'mythic']};
function petOf(world, id, now) {
  const reported = rows(world, 'ae_combat_stats').find(x => same(x.u, id))?.pet, food = rows(world, 'ae_pet_food').find(x => same(x.user, id));
  const pid = food?.active || reported?.id; if (!pid || (reported === null && !food?.active)) return null;
  const cat = PET_CAT[pid], sat = food ? Math.max(0, Math.min(100, food.v - (now - food.t) * 100 / 864e5)) : null;
  return {id: pid, name: (reported?.id === pid && reported.name) || cat?.[0] || 'Питомец', rarity: (reported?.id === pid && reported.rarity) || cat?.[1] || 'common',
    level: food?.pets?.[pid]?.lvl || (reported?.id === pid ? reported.level : 1) || 1, hungry: sat != null ? sat < 25 : !!reported?.hungry};
}
// What the hero wears (from the server-kept save): a light copy for the player card — no bag, only the equipped gear.
const GEAR_SLOTS = ['helmet', 'weapon', 'gloves', 'pants', 'boots', 'cloak', 'amulet', 'offhand', 'armor', 'ring', 'belt', 'artifact'];
export function gearOf(world, id) {
  const p = player(world, id), eq = p?.progress_json?.player?.equipped; if (!eq || typeof eq !== 'object') return null;
  const out = {};
  for (const slot of GEAR_SLOTS) { const it = eq[slot]; if (!it || typeof it !== 'object' || !it.name) continue;
    const stats = Object.fromEntries(Object.entries(it.stats || {}).filter(([, v]) => typeof v === 'number' && v).slice(0, 8));
    out[slot] = {name: String(it.name).slice(0, 60), templateId: it.templateId || null, type: it.type || slot, rarity: it.rarity || 'common', level: Number(it.level) || 1, upgradeLevel: Number(it.upgradeLevel) || 0,
      ascension: Number(it.ascension) || 0, twoHanded: !!it.twoHanded, icon: typeof it.icon === 'string' ? it.icon.slice(0, 200) : null, stats, gems: Array.isArray(it.gems) ? it.gems.slice(0, 3) : []}; }
  return out;
}
export function publicProfile(world, id, now) {
  const p = player(world, id); if (!p) return null;
  const pr = profileRow(world, id) || {}, earned = new Set(titlesOf(world, id, now).filter(t => t.earned).map(t => t.id));
  const title = TITLES.find(t => t.id === pr.title && earned.has(t.id));
  const av = AVATARS.find(a => a.id === pr.avatar) || AVATARS.find(a => a.id === 'hero_' + (p.class_id || 'warrior')) || AVATARS[0];
  const c = ctxOf(world, id, now);
  return {id: String(p.telegram_id), name: nameOf(p), level: Number(p.level) || 1, classId: p.class_id || 'warrior', title: title ? {id: title.id, icon: title.icon, name: title.name} : null,
    avatar: av, look: styleOf(world, id, pr, now), app: Date.parse(pr.apkSeen || pr.apkAt || 0) > now - 30 * 864e5, banner: BANNERS.find(b => b.id === pr.banner) || null, asc: ascOf(pr), clan: clanOf(world, id), pet: petOf(world, id, now), titlesEarned: earned.size, stats: {duelRating: c.duelRating, duelWins: c.s.duel_win, coopWins: c.s.coop_win, hordeBest: c.hordeBest, hordeKills: c.s.horde_kill}};
}

// Reaching ascension SSS: the «Первый вознесённый» achievement, announced once in the 🔔 history.
function awardSSS(world, me, now) {
  const pr = rows(world, 'ae_profiles').find(x => same(x.u, me)); if (!pr || pr.asc !== 'SSS' || pr.sssAt) return;
  pr.sssAt = new Date(now).toISOString();
  rows(world, 'ae_events').push({id: crypto.randomUUID(), to: String(me), icon: '🌟', text: 'Достижение «Первый вознесённый»: вы прошли все испытания вознесения до ранга SSS! Титул можно надеть в профиле.', kind: 'achievement', data: null, at: pr.sssAt, acked: false});
}
export function handleProfileRequest(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/ae-profile')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  if (!player(world, me)) return fail('Сначала создайте персонажа.', 404);
  if (method === 'GET' && path === '/api/ae-profile') { awardSSS(world, me, now); return ok({profile: publicProfile(world, me, now), titles: titlesOf(world, me, now), avatars: AVATARS, banners: BANNERS, look: styleOptions(world, me, now)}); }
  if (method === 'GET' && path === '/api/ae-profile/card') {
    const id = String(input.path.split('?')[1]?.match(/id=(\d+)/)?.[1] || body.id || '');
    const prof = publicProfile(world, id, now); return prof ? ok({profile: {...prof, gear: gearOf(world, id)}}) : fail('Игрок не найден.', 404);
  }
  if (method === 'POST' && path === '/api/ae-profile/batch') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 40).map(String);
    return ok({profiles: ids.map(id => publicProfile(world, id, now)).filter(Boolean).map(p => ({id: p.id, app: p.app, color: p.look?.color !== 'default' ? p.look?.color : undefined, title: p.title, avatar: p.avatar.src, asc: p.asc?.rank || null, clan: p.clan?.tag || null, clanPlace: p.clan ? placeOf(world, p.clan.id, now) : null, emblem: p.clan?.emblem || null}))});
  }
  let pr = profileRow(world, me); if (!pr && method === 'POST') { pr = {u: me}; rows(world, 'ae_profiles').push(pr); }
  if (method === 'POST' && path === '/api/ae-profile/title') {
    if (body.id == null || body.id === '') { pr.title = null; return ok({profile: publicProfile(world, me, now)}); }
    const t = titlesOf(world, me, now).find(x => x.id === body.id);
    if (!t) return fail('Такого титула нет.', 404); if (!t.earned) return fail('Этот титул ещё не получен.');
    pr.title = t.id; return ok({profile: publicProfile(world, me, now)});
  }
  if (method === 'POST' && path === '/api/ae-profile/asc') {
    const rank = String(body.rank || '');
    if (rank === 'E' || !rank) { pr.asc = null; return ok({profile: publicProfile(world, me, now)}); }
    const a = ASC.find(x => x[0] === rank); if (!a) return fail('Неизвестный ранг вознесения.');
    pr.asc = rank; awardSSS(world, me, now); return ok({profile: publicProfile(world, me, now)});
  }
  if (path === '/api/ae-profile/apk') {  // the Android app gift (status / claim) — the claim only counts from the app
    if (method === 'GET') { if (/[?&]app=1/.test(String(input.path))) { if (!pr) { pr = {u: me}; rows(world, 'ae_profiles').push(pr); } pr.apkSeen = new Date(now).toISOString(); } return ok({claimed: !!pr?.apkAt, gift: APK_GIFT}); }
    if (body.apk !== true || !(Number(body.ver) >= 1)) return fail('Подарок можно получить только в мобильном приложении.');
    if (pr.apkAt) return fail('Подарок за приложение уже получен.');
    const p = player(world, me); pr.apkAt = new Date(now).toISOString();
    p.premium_until = new Date(Math.max(now, Date.parse(p.premium_until || 0) || 0) + APK_GIFT.premiumDays * 864e5).toISOString(); p.updated_at = pr.apkAt;
    rows(world, 'ae_events').push({id: crypto.randomUUID(), to: me, icon: '📱', text: 'Подарок за мобильное приложение: Premium на 7 дней и награды! Титул «Герой в кармане» можно надеть в профиле.', kind: 'achievement', at: pr.apkAt, acked: false});
    return ok({gifts: APK_GIFT, premiumUntil: p.premium_until, profile: publicProfile(world, me, now)});
  }
  if (method === 'POST' && path === '/api/ae-profile/look') {
    if (body.apk !== true) return fail('Оформление профиля меняется только в мобильном приложении.');
    const opts = styleOptions(world, me, now), L = (pr.look ||= {});
    for (const k of ['frame', 'color', 'aura', 'theme']) if (body[k] != null) { const o = opts[k].find(x => x.id === body[k]); if (!o) return fail('Нет такого варианта.'); if (!o.open) return fail(`«${o.name}» откроется: ${o.need}.`); L[k] = o.id; }
    if (body.motto != null) { const m = String(body.motto).replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48); if (MOTTO_BAD.test(m)) return fail('В девизе нельзя ссылки и упоминания.'); L.motto = m; }
    if (body.showcase != null) { const earned = new Set(titlesOf(world, me, now).filter(t => t.earned).map(t => t.id)); L.showcase = (Array.isArray(body.showcase) ? body.showcase : []).map(String).filter(t => earned.has(t)).slice(0, 3); }
    if (body.showPet != null) L.showPet = !!body.showPet;
    if (body.comp !== undefined) { if (!body.comp) L.comp = null; else { if (!rows(world, 'ae_companions').some(c => same(c.u, me) && c.id === body.comp)) return fail('Соратник не найден.'); L.comp = String(body.comp); } }
    return ok({profile: publicProfile(world, me, now), options: styleOptions(world, me, now)});
  }
  if (method === 'POST' && path === '/api/ae-profile/banner') {
    if (body.apk !== true) return fail('Баннеры профиля выбираются только в мобильном приложении.');
    if (body.id == null || body.id === '') { pr.banner = null; return ok({profile: publicProfile(world, me, now)}); }
    if (!BANNERS.some(b => b.id === body.id)) return fail('Такого баннера нет.', 404);
    pr.banner = body.id; return ok({profile: publicProfile(world, me, now)});
  }
  if (method === 'POST' && path === '/api/ae-profile/avatar') {
    if (!AVATARS.some(a => a.id === body.id)) return fail('Такой аватарки нет.', 404);
    pr.avatar = body.id; return ok({profile: publicProfile(world, me, now)});
  }
  return fail('API не найден.', 404);
}
