// Season 1: 30 days of season points (from fights the server runs), a 30-step reward track, a rating and
// permanent titles. When it ends the points freeze and the top places get their titles; the hero wipe itself is a
// separate admin action (not tied to the date).
const rows = (world, n) => (world.tables[n] ||= []);
const peek = (world, n) => world.tables[n] || [];
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => peek(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const DAY = 864e5, iso = t => new Date(t).toISOString();

export const SEASON = {id: 1, name: 'Сезон 1 · Пробуждение', start: '2026-11-17T00:00:00Z', end: '2026-12-17T18:00:00Z'};
const STEP = 150, TIERS = 30;
// points for a fight the server ran and paid out (each first claim only)
const POINTS = {'/api/duel/claim': 20, '/api/coop/claim': 40, '/api/horde/claim': 30, '/api/ae-clanx/raid/claim': 30, '/api/ae-clanx/fort/hunt/claim': 30,
  '/api/ae-clanx/wild/claim': 40, '/api/ae-clanx/lands/attack': 15, '/api/quests/special/claim': 25, '/api/ae-clanx/goal/claim': 20};
export const SEASON_SOURCES = [['📅', 'Первый вход за день', 10], ['⚔️', 'Дуэль', 20], ['🤝', 'Кооп-подземелье', 40], ['🌕', 'Поход в Орду (от 5 побед)', 30], ['🛡️', 'Бой со Стражем врат', 30],
  ['🐾', 'Охота Крепости', 30], ['🐉', 'Бродячий босс', 40], ['🗺️', 'Штурм земли', 15], ['📜', 'Кооп/PvP задание', 25], ['🎯', 'Награда цели клана', 20]];
const DAILY_CAP = 600;   // one hero cannot run far ahead in a single day

// the track: every tier pays something now; tiers 10 / 20 / 30 give titles that outlive the wipe
const TRACK = Array.from({length: TIERS}, (_, i) => { const t = i + 1;
  if (t === 10) return {t, title: 's1_seeker', text: 'Титул «Искатель 1 сезона»', gold: 3000};
  if (t === 20) return {t, title: 's1_veteran', text: 'Титул «Ветеран 1 сезона»', gold: 6000, fragments: 2};
  if (t === 30) return {t, title: 's1_hero', text: 'Титул «Герой 1 сезона» и 3 дня Premium', gold: 10000, fragments: 3, premiumDays: 3};
  if (t % 5 === 0) return {t, gold: 1500 + t * 100, fragments: 1, tickets: 2};
  return {t, gold: 400 + t * 60, silver: 200 + t * 20}; });
// places at the end: permanent titles
const PLACES = [[1, 's1_champion'], [3, 's1_podium'], [10, 's1_top10']];
export const SEASON_TITLES = {
  s1_seeker: ['🥉', 'Искатель 1 сезона', '10-я ступень трека Сезона 1'], s1_veteran: ['🥈', 'Ветеран 1 сезона', '20-я ступень трека Сезона 1'],
  s1_hero: ['🥇', 'Герой 1 сезона', 'Весь трек Сезона 1'], s1_champion: ['👑', 'Чемпион 1 сезона', '1-е место в рейтинге Сезона 1'],
  s1_podium: ['🏆', 'Призёр 1 сезона', 'Места 2–3 в рейтинге Сезона 1'], s1_top10: ['🎖️', 'Десятка Сезона 1', 'Места 4–10 в рейтинге Сезона 1']};

const isLive = now => now >= Date.parse(SEASON.start) && now < Date.parse(SEASON.end);
const rowOf = (world, me) => { const list = rows(world, 'ae_season'); let r = list.find(x => x.s === SEASON.id && same(x.u, me)); if (!r) { r = {s: SEASON.id, u: String(me), pts: 0, got: [], day: '', dayPts: 0}; list.push(r); } return r; };
export const seasonAwards = (world, me) => new Set(peek(world, 'ae_season_awards').filter(a => same(a.u, me)).map(a => a.id));
function award(world, me, id, now) { if (seasonAwards(world, me).has(id)) return; rows(world, 'ae_season_awards').push({u: String(me), id, s: SEASON.id, at: iso(now)}); }

export function seasonAdd(world, me, pts, now) {
  if (!isLive(now) || !(pts > 0) || !player(world, me)) return 0;
  const r = rowOf(world, me), day = iso(now).slice(0, 10);
  if (r.day !== day) { r.day = day; r.dayPts = 0; }
  const add = Math.max(0, Math.min(pts, DAILY_CAP - r.dayPts)); if (!add) return 0;
  r.pts += add; r.dayPts += add; r.at = iso(now); return add;
}
// after every request: a daily login bonus and points for the fight just claimed
export function seasonHook(world, me, input, reply, now) {
  try {
    if (!isLive(now) || !player(world, me)) return;
    const r = rowOf(world, me), day = iso(now).slice(0, 10);
    if (r.login !== day) { r.login = day; seasonAdd(world, me, 10, now); }
    const path = String(input?.path || '').split('?')[0], pts = POINTS[path];
    if (!pts || !(reply?.status < 300) || reply.body?.alreadyClaimed) return;
    if (path === '/api/horde/claim' && !((Number(reply.body?.kills) || 0) >= 5)) return;   // an empty run (start → leave) earns nothing
    seasonAdd(world, me, pts, now);
  } catch (e) { console.warn('season hook', e?.message); }
}
function ranking(world) {
  return peek(world, 'ae_season').filter(x => x.s === SEASON.id && x.pts > 0).sort((a, b) => b.pts - a.pts || String(a.at).localeCompare(String(b.at)));
}
// season over: titles for the places, once (lazy, on the first request after the end)
function finish(world, now) {
  if (now < Date.parse(SEASON.end)) return;
  const flags = rows(world, 'ae_flags'), key = 'season_done_' + SEASON.id; if (flags.some(f => f.key === key)) return;
  flags.push({key, at: iso(now)});
  ranking(world).slice(0, 10).forEach((r, i) => { const id = PLACES.find(([n]) => i + 1 <= n)[1]; award(world, r.u, id, now); });
}

export function handleSeason(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0], method = String(input?.method || 'GET').toUpperCase(), me = String(user.id), body = input?.body || {};
  if (!path.startsWith('/api/ae-season')) return null;
  finish(world, now);
  const p = player(world, me); if (!p) return fail('Сначала создайте героя.', 404);
  const r = rowOf(world, me), tier = Math.min(TIERS, Math.floor(r.pts / STEP));
  if (path === '/api/ae-season' && method === 'GET') {
    const rank = ranking(world), place = rank.findIndex(x => same(x.u, me)) + 1;
    return ok({season: {...SEASON, live: isLive(now), now: iso(now)}, pts: r.pts, tier, step: STEP, tiers: TIERS, dayPts: r.day === iso(now).slice(0, 10) ? r.dayPts : 0, dailyCap: DAILY_CAP,
      track: TRACK.map(x => ({...x, open: tier >= x.t, got: r.got.includes(x.t)})), sources: SEASON_SOURCES, place: place || null,
      top: rank.slice(0, 20).map((x, i) => ({place: i + 1, name: nameOf(player(world, x.u)), level: Number(player(world, x.u)?.level) || 1, pts: x.pts, me: same(x.u, me)})),
      places: [['👑', '1 место', 'Чемпион 1 сезона'], ['🏆', '2–3 место', 'Призёр 1 сезона'], ['🎖️', '4–10 место', 'Десятка Сезона 1']],
      titles: [...seasonAwards(world, me)].map(id => SEASON_TITLES[id] ? {id, icon: SEASON_TITLES[id][0], name: SEASON_TITLES[id][1]} : null).filter(Boolean)});
  }
  if (path === '/api/ae-season/claim' && method === 'POST') {
    const t = Number(body.tier), x = TRACK.find(y => y.t === t);
    if (!x) return fail('Нет такой ступени.'); if (tier < t) return fail(`Нужно ${t * STEP} очков сезона.`); if (r.got.includes(t)) return fail('Награда уже получена.');
    r.got.push(t);
    if (x.title) award(world, me, x.title, now);
    if (x.premiumDays) { const base = Math.max(now, Date.parse(p.premium_until || 0) || 0); p.premium_until = iso(base + x.premiumDays * DAY); }
    return ok({reward: {gold: x.gold || 0, silver: x.silver || 0, fragments: x.fragments || 0, tickets: x.tickets || 0}, title: x.title ? SEASON_TITLES[x.title][1] : null, premiumDays: x.premiumDays || 0});
  }
  return fail('API не найден.', 404);
}
