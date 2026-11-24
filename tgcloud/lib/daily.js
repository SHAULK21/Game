// Daily login reward: a 7-day calendar. One reward a day per Telegram account (not per hero), the next day of the
// streak if the player came yesterday, day 1 again after a missed day. Day 7 adds a day of Premium.
// The server records the claim (idempotent by operationId) and returns the gifts; the game client adds gold,
// silver, energy, fragments and tickets to the hero (as with mail gifts); Premium is set here.
import {realOf, accountIds} from './alts.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const DAY = 864e5, iso = t => new Date(t).toISOString();
const dayKey = t => iso(t).slice(0, 10);                  // the reward day changes at 00:00 UTC, like the other daily limits
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));

export function dailyRewards(level) {
  const L = Math.max(1, Math.min(120, Number(level) || 1)), g = Math.round((80 + L * 15) / 10) * 10, s = Math.round((100 + L * 3) / 10) * 10;
  return [
    {gold: g, energy: 20},
    {gold: g, silver: s},
    {gold: g, fragments: 1},
    {energy: 40, arenaTickets: 1},
    {gold: g * 2, silver: Math.round(s * 1.5 / 10) * 10},
    {fragments: 2, energy: 30},
    {premiumDays: 1, gold: g * 3, fragments: 3, arenaTickets: 2},
  ];
}

function state(world, tg, now) {
  const rec = rows(world, 'ae_daily').find(r => same(r.u, tg)) || null, today = dayKey(now), yesterday = dayKey(now - DAY);
  const claimedToday = rec?.day === today;
  const alive = rec && (rec.day === today || rec.day === yesterday);
  const next = claimedToday ? rec.n : alive ? rec.n % 7 + 1 : 1;   // the calendar day shown as «today»
  const done = alive ? (claimedToday ? rec.n : rec.n % 7) : 0;     // days of the current week already taken
  return {rec, today, claimedToday, next, done: next === 1 && !claimedToday ? 0 : done};
}

export function handleDaily(world, input, user, now) {
  const path = String(input?.path || '').split('?')[0]; if (!path.startsWith('/api/ae-daily')) return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id), tg = String(realOf(me));
  const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
  const rewards = dailyRewards(p.level), st = state(world, tg, now);
  const view = extra => ok({day: st.claimedToday ? st.rec.n : st.next, claimedToday: st.claimedToday, done: st.done, rewards,
    resetAt: iso(Date.parse(st.today + 'T00:00:00Z') + DAY), ...extra});
  if (path === '/api/ae-daily' && method === 'GET') return view();
  if (path === '/api/ae-daily/claim' && method === 'POST') {
    const op = String(body.operationId || ''); if (!UUID.test(op)) return fail('Нет идентификатора операции.');
    if (st.claimedToday) return st.rec.op === op ? ok({gifts: st.rec.gifts, day: st.rec.n, replayed: true}) : fail('Сегодняшняя награда уже получена. Приходите завтра!');
    const n = st.next, gifts = rewards[n - 1];
    let rec = st.rec; if (!rec) { rec = {u: tg}; rows(world, 'ae_daily').push(rec); }
    Object.assign(rec, {day: st.today, n, op, gifts, by: me, at: iso(now), best: Math.max(rec.best || 0, n)});
    if (gifts.premiumDays) for (const id of accountIds(me)) { const h = player(world, id); if (h) h.premium_until = iso(Math.max(now, Date.parse(h.premium_until || 0) || 0) + gifts.premiumDays * DAY); }
    return ok({gifts, day: n});
  }
  return fail('API не найден.', 404);
}
