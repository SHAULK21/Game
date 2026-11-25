// «Путь новичка»: 7 simple steps for a new hero's first 15 minutes, each with a small reward; the last one
// (level 5) gives a day of Premium. Per hero, offered while the hero is level 10 or lower (or has started the path).
// The game client sees most steps (a won fight, spent stat points, a used skill, new gear, the settlement) and
// reports them; the login reward and level 5 are checked here too. Rewards: like mail gifts (the client adds
// gold/energy/…, Premium is set here). Rows stay when a hero is deleted, so a re-created hero cannot farm them.
import {realOf} from './alts.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const DAY = 864e5, iso = t => new Date(t).toISOString();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));

export const PATH_STEPS = [
  {id: 'win', icon: '⚔️', title: 'Первая победа', hint: 'Нажмите «Начать охоту» и победите монстра.', gifts: {gold: 150, energy: 20}},
  {id: 'stats', icon: '📈', title: 'Очки характеристик', hint: 'Откройте героя и распределите свободные очки кнопками «+».', gifts: {gold: 100, silver: 50}},
  {id: 'skill', icon: '🔮', title: 'Навык в бою', hint: 'В бою нажмите «Навыки» и примените любой навык — он бьёт сильнее обычной атаки.', gifts: {gold: 150, energy: 20}},
  {id: 'gear', icon: '🛡️', title: 'Новая вещь', hint: 'Откройте сумку и наденьте любую вещь из добычи.', gifts: {gold: 200}},
  {id: 'town', icon: '🏘️', title: 'Поселение', hint: 'Загляните в Поселение: там рынок, кузница, шахта, рыбалка и таверна.', gifts: {gold: 100, silver: 100}},
  {id: 'daily', icon: '🎁', title: 'Награда за вход', hint: 'Заберите награду за вход: «Меню» → «Награда за вход».', gifts: {energy: 30, arenaTickets: 1}},
  {id: 'level5', icon: '⭐', title: '5 уровень', hint: 'Сражайтесь с монстрами и выполняйте задания, чтобы достичь 5 уровня.', gifts: {premiumDays: 1, gold: 600, fragments: 2, energy: 50}},
];
const CLIENT = new Set(['win', 'stats', 'skill', 'gear', 'town', 'level5']);
const MAX_LEVEL = 10;

function rec(world, me) { return rows(world, 'ae_path').find(r => same(r.u, me)) || null; }
function view(world, me, p, r) {
  const daily = (world.tables.ae_daily || []).some(x => same(x.u, realOf(me)));
  const steps = PATH_STEPS.map(s => {
    const done = !!(r?.marks?.[s.id]) || (s.id === 'daily' && daily) || (s.id === 'level5' && (Number(p.level) || 1) >= 5);
    return {...s, done, claimed: !!r?.claimed?.[s.id]};
  });
  const finished = steps.every(s => s.claimed);
  const eligible = !finished && (!!r || (Number(p.level) || 1) <= MAX_LEVEL);
  return {eligible, finished, steps, ready: steps.filter(s => s.done && !s.claimed).length, claimed: steps.filter(s => s.claimed).length};
}

export function handlePath(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0]; if (!path.startsWith('/api/ae-path')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  const p = player(world, me); if (!p?.character_name) return fail('Сначала создайте персонажа.', 404);
  let r = rec(world, me);
  if (path === '/api/ae-path' && method === 'GET') return ok(view(world, me, p, r));
  if (path === '/api/ae-path/mark' && method === 'POST') {
    if (!view(world, me, p, r).eligible) return ok(view(world, me, p, r));
    const ids = (Array.isArray(body.steps) ? body.steps : []).map(String).filter(id => CLIENT.has(id));
    if (ids.length) { if (!r) { r = {u: me, marks: {}, claimed: {}, at: iso(now)}; rows(world, 'ae_path').push(r); } for (const id of ids) r.marks[id] ||= iso(now); }
    return ok(view(world, me, p, r));
  }
  if (path === '/api/ae-path/claim' && method === 'POST') {
    const op = String(body.operationId || ''); if (!UUID.test(op)) return fail('Нет идентификатора операции.');
    const step = PATH_STEPS.find(s => s.id === body.step); if (!step) return fail('Нет такого шага.', 404);
    if (r?.claimed?.[step.id]) return r.claimed[step.id] === op ? ok({gifts: step.gifts, step: step.id, replayed: true, ...view(world, me, p, r)}) : fail('Награда за этот шаг уже получена.');
    const v = view(world, me, p, r); if (!v.steps.find(s => s.id === step.id)?.done) return fail('Сначала выполните этот шаг.');
    if (!r) { r = {u: me, marks: {}, claimed: {}, at: iso(now)}; rows(world, 'ae_path').push(r); }
    r.claimed[step.id] = op;
    if (step.gifts.premiumDays) p.premium_until = iso(Math.max(now, Date.parse(p.premium_until || 0) || 0) + step.gifts.premiumDays * DAY);
    return ok({gifts: step.gifts, step: step.id, ...view(world, me, p, r)});
  }
  return fail('API не найден.', 404);
}
