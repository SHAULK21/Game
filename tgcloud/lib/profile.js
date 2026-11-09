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
  T('keeper', '🗝️', 'Хранитель Аэтельгарда', 'Администрация игры', c => c.admin ? 1 : 0, 1)];

function ctxOf(world, id, now) {
  const p = player(world, id) || {}, s = rows(world, 'ae_stats').find(x => same(x.u, id))?.c || {};
  const hb = rows(world, 'horde_best').find(x => same(x.user, id)) || {}, dr = rows(world, 'duel_ratings').find(x => same(x.id, id));
  const friends = rows(world, 'friendships').filter(f => f.status === 'accepted' && (same(f.a, id) || same(f.b, id))).length;
  return {level: Number(p.level) || 1, s: new Proxy(s, {get: (o, k) => Number(o[k]) || 0}), hordeBest: hb.kills || 0, bloodBest: hb.bloodKills || 0, duelRating: dr?.rating || 1000,
    friends, clan: !!p.clan_id, premium: Date.parse(p.premium_until || 0) > now, pioneer: Date.parse(p.created_at || now) < Date.parse('2027-01-01T00:00:00Z'), admin: same(id, ADMIN_ID)};
}
export function titlesOf(world, id, now) {
  const c = ctxOf(world, id, now);
  return TITLES.filter(t => t.id !== 'keeper' || c.admin).map(t => { const v = Math.max(0, Number(t.value(c)) || 0); return {id: t.id, icon: t.icon, name: t.name, desc: t.desc, earned: v >= t.need, progress: Math.min(v, t.need), need: t.need}; });
}
// Ascension rank: kept in the hero's save; the client reports it so other players can see it (trials have no hard level gate).
const ASC = [['D', 'Страж порога', 1], ['C', 'Рыцарь зеркального щита', 15], ['B', 'Хранитель живого пламени', 30], ['A', 'Судья трёх стихий', 45],
  ['S', 'Повелитель разлома', 60], ['SS', 'Владыка пустоты', 75], ['SSS', 'Первый вознесённый', 85]];
const ascOf = pr => { const a = ASC.find(x => x[0] === pr?.asc); return a ? {rank: a[0], name: a[1], step: ASC.indexOf(a) + 1} : null; };
const clanOf = (world, id) => { const m = rows(world, 'clan_members').find(x => same(x.telegram_id, id)); const c = m && rows(world, 'clans').find(x => same(x.id, m.clan_id)); return c ? {id: c.id, tag: c.tag, name: c.name, level: Number(c.level) || 1, role: m.role} : null; };
const profileRow = (world, id) => rows(world, 'ae_profiles').find(x => same(x.u, id));
export function publicProfile(world, id, now) {
  const p = player(world, id); if (!p) return null;
  const pr = profileRow(world, id) || {}, earned = new Set(titlesOf(world, id, now).filter(t => t.earned).map(t => t.id));
  const title = TITLES.find(t => t.id === pr.title && earned.has(t.id));
  const av = AVATARS.find(a => a.id === pr.avatar) || AVATARS.find(a => a.id === 'hero_' + (p.class_id || 'warrior')) || AVATARS[0];
  const c = ctxOf(world, id, now);
  return {id: String(p.telegram_id), name: nameOf(p), level: Number(p.level) || 1, classId: p.class_id || 'warrior', title: title ? {id: title.id, icon: title.icon, name: title.name} : null,
    avatar: av, asc: ascOf(pr), clan: clanOf(world, id), titlesEarned: earned.size, stats: {duelRating: c.duelRating, duelWins: c.s.duel_win, coopWins: c.s.coop_win, hordeBest: c.hordeBest, hordeKills: c.s.horde_kill}};
}

export function handleProfileRequest(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/ae-profile')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  if (!player(world, me)) return fail('Сначала создайте персонажа.', 404);
  if (method === 'GET' && path === '/api/ae-profile') return ok({profile: publicProfile(world, me, now), titles: titlesOf(world, me, now), avatars: AVATARS});
  if (method === 'GET' && path === '/api/ae-profile/card') {
    const id = String(input.path.split('?')[1]?.match(/id=(\d+)/)?.[1] || body.id || '');
    const prof = publicProfile(world, id, now); return prof ? ok({profile: prof}) : fail('Игрок не найден.', 404);
  }
  if (method === 'POST' && path === '/api/ae-profile/batch') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 40).map(String);
    return ok({profiles: ids.map(id => publicProfile(world, id, now)).filter(Boolean).map(p => ({id: p.id, title: p.title, avatar: p.avatar.src, asc: p.asc?.rank || null, clan: p.clan?.tag || null}))});
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
    pr.asc = rank; return ok({profile: publicProfile(world, me, now)});
  }
  if (method === 'POST' && path === '/api/ae-profile/avatar') {
    if (!AVATARS.some(a => a.id === body.id)) return fail('Такой аватарки нет.', 404);
    pr.avatar = body.id; return ok({profile: publicProfile(world, me, now)});
  }
  return fail('API не найден.', 404);
}
