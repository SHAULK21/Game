// Mentorship: a strong hero (50+) takes up to 3 apprentices (up to 20 level when they ask). When the apprentice
// reaches 10 / 20 / 30 / 40 level both claim a reward; at 40 the apprentice graduates. One mentor per apprentice
// per season, at most 5 graduations per mentor per season (alts cannot farm it).
import {pushEvent} from './arenaExtras.js';
import {isNpc} from './npc.js';
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => (world.tables.players || []).find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const lvlOf = (world, id) => Number(player(world, id)?.level) || 1;
const DAY = 864e5, iso = t => new Date(t).toISOString();
const SEASON = 1, MENTOR_LVL = 50, APPRENTICE_MAX = 20, SLOTS = 3, GRAD_CAP = 5;
export const MILESTONES = [
  {lvl: 10, a: {gold: 1000}, m: {gold: 2000}},
  {lvl: 20, a: {gold: 3000, fragments: 1}, m: {gold: 4000}},
  {lvl: 30, a: {gold: 6000, fragments: 2}, m: {gold: 6000, fragments: 1}},
  {lvl: 40, a: {gold: 10000, fragments: 3}, m: {gold: 10000, fragments: 2}, grad: true}];
const links = world => rows(world, 'ae_mentors');
const seenAt = p => Date.parse(p?.last_seen_at || p?.updated_at || 0) || 0;
const graduates = (world, m) => links(world).filter(x => same(x.m, m) && x.status === 'done').length;

function view(world, me, now) {
  const L = lvlOf(world, me), all = links(world);
  const mine = all.filter(x => same(x.m, me) && (x.status === 'active' || x.status === 'pending'));
  const asA = all.find(x => same(x.a, me) && (x.status === 'active' || x.status === 'pending'));
  const card = x => { const al = lvlOf(world, x.a), next = MILESTONES.find(s => !(x.gotA || []).includes(s.lvl) || !(x.gotM || []).includes(s.lvl));
    return {id: x.id, status: x.status, mentor: {id: String(x.m), name: nameOf(player(world, x.m)), level: lvlOf(world, x.m)}, apprentice: {id: String(x.a), name: nameOf(player(world, x.a)), level: al},
      steps: MILESTONES.map(s => ({lvl: s.lvl, reached: al >= s.lvl, before: (x.skip || []).includes(s.lvl), gotA: (x.gotA || []).includes(s.lvl), gotM: (x.gotM || []).includes(s.lvl), a: s.a, m: s.m, grad: !!s.grad})), next: next?.lvl || null, since: x.at}; };
  const graduated = all.some(x => same(x.a, me) && x.season === SEASON && x.status === 'done');
  const mentors = !asA && !graduated && L <= APPRENTICE_MAX ? (world.tables.players || [])
    .filter(p => !same(p.telegram_id, me) && !isNpc(p.telegram_id) && (Number(p.level) || 1) >= MENTOR_LVL && now - seenAt(p) < 3 * DAY && p.character_name)
    .map(p => ({id: String(p.telegram_id), name: nameOf(p), level: Number(p.level) || 1, busy: all.filter(x => same(x.m, p.telegram_id) && x.status === 'active').length, grads: graduates(world, p.telegram_id)}))
    .filter(x => x.busy < SLOTS).sort((a, b) => b.grads - a.grads || b.level - a.level).slice(0, 20) : [];
  return {level: L, canMentor: L >= MENTOR_LVL, canLearn: L <= APPRENTICE_MAX && !asA && !graduated, mentorLvl: MENTOR_LVL, apprenticeMax: APPRENTICE_MAX, slots: SLOTS, gradCap: GRAD_CAP,
    graduates: graduates(world, me), apprentices: mine.map(card), mentor: asA ? card(asA) : null, mentors, milestones: MILESTONES};
}

export function handleMentor(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0], method = String(input?.method || 'GET').toUpperCase(), me = String(user.id), body = input?.body || {};
  if (!path.startsWith('/api/ae-mentor')) return null;
  if (!player(world, me)) return fail('Сначала создайте героя.', 404);
  const done = extra => ok({...view(world, me, now), ...extra});
  if (method === 'GET') return done();
  const all = links(world);
  if (path === '/api/ae-mentor/ask') {   // the apprentice asks a mentor
    const m = player(world, body.mentorId); if (!m || same(body.mentorId, me)) return fail('Наставник не найден.');
    const mineAsks = all.filter(y => same(y.a, me)), last = mineAsks.reduce((t, y) => Math.max(t, Date.parse(y.at) || 0), 0);
    if (now - last < 10 * 60e3) return fail('Просить можно раз в 10 минут.');
    if (mineAsks.some(y => same(y.m, m.telegram_id) && y.status === 'declined' && now - (Date.parse(y.at) || 0) < DAY)) return fail('Этот наставник недавно отказал — попробуйте другого или завтра.');
    const v = view(world, me, now); if (!v.canLearn) return fail(lvlOf(world, me) > APPRENTICE_MAX ? `Учеником можно стать до ${APPRENTICE_MAX} уровня.` : 'У вас уже есть наставник в этом сезоне.');
    if ((Number(m.level) || 1) < MENTOR_LVL) return fail(`Наставник должен быть не ниже ${MENTOR_LVL} уровня.`);
    if (all.filter(x => same(x.m, m.telegram_id) && x.status === 'active').length >= SLOTS) return fail('У этого наставника уже нет свободных мест.');
    all.push({id: crypto.randomUUID(), m: String(m.telegram_id), a: me, status: 'pending', season: SEASON, at: iso(now), gotA: [], gotM: []});
    pushEvent(world, m.telegram_id, '🎓', `${nameOf(player(world, me))} (${lvlOf(world, me)} ур.) просит вас стать наставником`, 'mentor', null, now);
    return done({toast: 'Просьба отправлена — наставник ответит.'});
  }
  const x = all.find(y => y.id === body.id); if (!x) return fail('Связь не найдена.', 404);
  const isM = same(x.m, me), isA = same(x.a, me); if (!isM && !isA) return fail('Это не ваша связь.', 403);
  if (path === '/api/ae-mentor/accept' || path === '/api/ae-mentor/decline') {
    if (!isM || x.status !== 'pending') return fail('Просьба уже рассмотрена.');
    if (path.endsWith('decline')) { x.status = 'declined'; pushEvent(world, x.a, '🎓', `${nameOf(player(world, me))} не смог(ла) взять вас в ученики. Выберите другого наставника.`, 'mentor', null, now); return done(); }
    if (lvlOf(world, me) < MENTOR_LVL) return fail(`Наставником можно стать с ${MENTOR_LVL} уровня.`);
    if (all.filter(y => same(y.m, me) && y.status === 'active').length >= SLOTS) return fail(`Учеников не больше ${SLOTS}.`);
    if (graduates(world, me) >= GRAD_CAP) return fail(`В этом сезоне вы уже выпустили ${GRAD_CAP} учеников.`);
    // rewards only for growth together: steps already passed count as taken (also after changing mentors)
    const passed = MILESTONES.filter(s => s.lvl <= lvlOf(world, x.a)).map(s => s.lvl);
    x.skip = passed; x.gotA = [...new Set([...(x.gotA || []), ...passed])]; x.gotM = [...new Set([...(x.gotM || []), ...passed])];
    x.status = 'active'; x.since = iso(now);
    pushEvent(world, x.a, '🎓', `${nameOf(player(world, me))} теперь ваш наставник! Награды — на 10, 20, 30 и 40 уровне.`, 'mentor', null, now);
    return done();
  }
  if (path === '/api/ae-mentor/claim') {
    if (x.status !== 'active') return fail('Связь не активна.');
    const s = MILESTONES.find(y => y.lvl === Number(body.lvl)); if (!s) return fail('Нет такой ступени.');
    if (lvlOf(world, x.a) < s.lvl) return fail(`Ученик ещё не достиг ${s.lvl} уровня.`);
    const key = isM ? 'gotM' : 'gotA'; x[key] ||= []; if (x[key].includes(s.lvl)) return fail('Награда уже получена.');
    // the mentor's reward for a step needs real time together (1 / 2 / 3 / 4 days): a fast-levelled alt pays nothing extra
    if (isM) { const wait = (MILESTONES.indexOf(s) + 1) * DAY - (now - (Date.parse(x.since || x.at) || now)); if (wait > 0) return fail(`Награду наставнику можно забрать через ${Math.ceil(wait / 3600e3)} ч — ученику нужно время.`); }
    x[key].push(s.lvl);
    if (s.grad && x.gotA?.includes(s.lvl) && x.gotM?.includes(s.lvl)) { x.status = 'done'; x.doneAt = iso(now); }
    return done({reward: isM ? s.m : s.a});
  }
  if (path === '/api/ae-mentor/leave') {
    if (x.status !== 'active' && x.status !== 'pending') return fail('Связь уже завершена.');
    x.status = 'ended'; x.endedAt = iso(now);
    pushEvent(world, isM ? x.a : x.m, '🎓', `${nameOf(player(world, me))} завершил(а) наставничество.`, 'mentor', null, now);
    return done();
  }
  return fail('API не найден.', 404);
}
