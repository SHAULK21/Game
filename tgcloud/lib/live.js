// Live features: pet satiety (server-kept, bot reminder), Blood Moon weekend announcement,
// invite-a-friend (on top of the engine's referral reward) and admin analytics.
import {bloodWeekend} from './horde.js';
import {saveStats} from './heroStats.js';

const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const DAY = 864e5;

// ---------- scheduled bot notifications (delivered by the engine's outbox worker) ----------
function schedule(world, to, key, category, text, dueAt, now) {
  const list = rows(world, 'game_notifications');
  if (list.some(n => same(n.telegram_id, to) && n.event_key === key)) return;
  const id = list.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0) + 1;
  list.push({id, telegram_id: Number(to), event_key: key, category, text, due_at: iso(dueAt), sent_at: null, read_at: null, attempts: 0,
    next_attempt_at: iso(now), created_at: iso(now), updated_at: iso(now)});
}
const unschedule = (world, to, category) => { world.tables.game_notifications = rows(world, 'game_notifications').filter(n => !(same(n.telegram_id, to) && n.category === category && !n.sent_at)); };

// ---------- pet satiety: 100 → 0 over a day, hungry below 25 ----------
const HUNGRY = 25, FEED = {food: 40, bowl: 50, feast: 100};
const satOf = (r, now) => Math.max(0, Math.min(100, r.v - (now - r.t) * 100 / DAY));
function petView(r, now) { const sat = satOf(r, now); return {sat: Math.round(sat * 10) / 10, hungry: sat < HUNGRY, at: now}; }
function petRemind(world, me, r, now) {
  unschedule(world, me, 'pets');
  const sat = satOf(r, now), due = sat > HUNGRY ? now + (sat - HUNGRY) * DAY / 100 : now;
  schedule(world, me, 'pet_' + Math.round(due / 60e3), 'pets', '🐾 Ваш питомец проголодался! Голодный питомец даёт только половину характеристик — загляните в Приют и покормите его.', due, now);
}
function handlePet(world, body, me, now) {
  const list = rows(world, 'ae_pet_food');
  let r = list.find(x => same(x.user, me));
  if (!r) { // first contact: adopt the value the device kept until now
    const l = body.local, v = l && Number.isFinite(+l.v) && Number.isFinite(+l.t) && +l.t <= now ? satOf({v: Math.min(100, +l.v), t: +l.t}, now) : 100;
    r = {user: me, v, t: now}; list.push(r); petRemind(world, me, r, now);
  }
  if (body.action === 'feed') {
    const add = FEED[body.how]; if (!add) return fail('Неизвестный корм.');
    const sat = satOf(r, now); if (sat >= 99) return fail('Питомец сыт и не хочет есть.');
    r.v = Math.min(100, sat + add); r.t = now; petRemind(world, me, r, now);
  }
  return ok(petView(r, now));
}

// ---------- Blood Moon weekend: one bot announcement per weekend to recently active players ----------
function weekendAnnounce(world, now) {
  const w = bloodWeekend(now); if (!w.on) return;
  const flags = rows(world, 'ae_flags'), key = 'bm_weekend_' + w.key;
  if (flags.some(f => f.key === key)) return;
  flags.push({key, at: iso(now)});
  const active = rows(world, 'players').filter(p => p.bot_started && Date.parse(p.last_seen_at || 0) > now - 14 * DAY).slice(0, 2000);
  for (const p of active) schedule(world, p.telegram_id, key, 'announcements',
    '🌕 Выходные Кровавой луны! До конца воскресенья каждый поход в Орду — Кровавая луна с двойной наградой. Лунные чудовища уже у ворот!', now, now);
}

// ---------- invite a friend: the engine grants 3 days of Premium to both when the friend reaches level 10 ----------
const REF_LEVEL = 10;
function refJoinNotice(world, me, now, notify) {
  const p = player(world, me); if (!p?.referred_by) return;
  const flags = rows(world, 'ae_flags'), key = 'ref_joined_' + me;
  if (flags.some(f => f.key === key)) return;
  flags.push({key, at: iso(now)});
  notify?.(world, p.referred_by, `🎉 ${nameOf(p)} пришёл в Аэтельгард по вашей ссылке! Когда герой друга достигнет ${REF_LEVEL} уровня, вы оба получите Premium на 3 дня.`, 'ref-join:' + me, now);
}
async function handleReferrals(world, me, native) {
  const r = await native({path: '/api/referrals', method: 'GET'});
  if (!r || r.status >= 400) return fail(r?.body?.error || 'Не удалось получить ссылку.');
  const rewarded = new Set(rows(world, 'referral_rewards').filter(x => same(x.inviter, me)).map(x => String(x.invitee)));
  const invited = rows(world, 'players').filter(p => same(p.referred_by, me))
    .map(p => ({name: nameOf(p), level: Number(p.level) || 1, classId: p.class_id || null, rewarded: rewarded.has(String(p.telegram_id)), joined: p.created_at}))
    .sort((a, b) => Number(a.rewarded) - Number(b.rewarded) || b.level - a.level).slice(0, 50);
  return ok({url: r.body.url, rewardDays: r.body.rewardDays || 3, requiredLevel: r.body.requiredLevel || REF_LEVEL, count: rewarded.size, invited});
}

// ---------- analytics: section visits from the client + admin report ----------
const dayKey = t => iso(t).slice(0, 10);
function track(world, me, sections, now) {
  const day = dayKey(now), list = rows(world, 'ae_visits');
  for (const s0 of (Array.isArray(sections) ? sections : []).slice(0, 30)) {
    const s = String(s0 || '').trim().slice(0, 40); if (!s) continue;
    let r = list.find(x => x.day === day && x.s === s);
    if (!r) { r = {day, s, n: 0, u: []}; list.push(r); }
    r.n++; if (r.u.length < 5000 && !r.u.includes(String(me))) r.u.push(String(me));
  }
  world.tables.ae_visits = list.filter(x => x.day >= dayKey(now - 35 * DAY));
  return ok({ok: true});
}
function report(world, now) {
  const days = [...Array(14)].map((_, i) => dayKey(now - (13 - i) * DAY));
  const act = rows(world, 'balance_activity'), players = rows(world, 'players');
  const byDay = new Map(); for (const a of act) { if (!byDay.has(a.day)) byDay.set(a.day, new Set()); byDay.get(a.day).add(String(a.telegram_id)); }
  const created = new Map(players.map(p => [String(p.telegram_id), dayKey(Date.parse(p.created_at || 0) || 0)]));
  const newBy = d => players.filter(p => created.get(String(p.telegram_id)) === d).map(p => String(p.telegram_id));
  const shift = (d, n) => dayKey(Date.parse(d + 'T00:00:00Z') + n * DAY);
  const ret = (cohortDays, n) => { let base = 0, back = 0; for (const d of cohortDays) { const t = shift(d, n); if (t > dayKey(now)) continue; const c = newBy(d); base += c.length; const s = byDay.get(t); if (s) back += c.filter(id => s.has(id)).length; } return base ? {pct: Math.round(back * 100 / base), base} : {pct: null, base: 0}; };
  const lastDays = [...Array(30)].map((_, i) => dayKey(now - (i + 1) * DAY));
  const daily = days.map(d => ({day: d, dau: byDay.get(d)?.size || 0, new: newBy(d).length}));
  const visits = rows(world, 'ae_visits').filter(v => v.day >= dayKey(now - 6 * DAY));
  const sec = new Map(); for (const v of visits) { const r = sec.get(v.s) || {s: v.s, n: 0, u: new Set()}; r.n += v.n; v.u.forEach(x => r.u.add(x)); sec.set(v.s, r); }
  const sections = [...sec.values()].map(r => ({s: r.s, n: r.n, users: r.u.size})).sort((a, b) => b.users - a.users).slice(0, 25);
  // Where do players stop: last screen of players who have not been back for 3+ days (seen in the last 30).
  const sess = rows(world, 'balance_sessions'), lastSess = new Map();
  for (const s of sess) { const k = String(s.telegram_id), o = lastSess.get(k); if (!o || String(s.updated_at) > String(o.updated_at)) lastSess.set(k, s); }
  const quit = new Map(); let quitN = 0;
  for (const p of players) { const seen = Date.parse(p.last_seen_at || 0); if (!(seen < now - 3 * DAY && seen > now - 30 * DAY)) continue; quitN++;
    const s = lastSess.get(String(p.telegram_id)), key = `${s?.last_screen || '—'} · ур. ${Math.min(Number(p.level) || 1, 99) <= 5 ? '1–5' : Number(p.level) <= 15 ? '6–15' : '16+'}`; quit.set(key, (quit.get(key) || 0) + 1); }
  const quitList = [...quit.entries()].map(([k, n]) => ({k, n})).sort((a, b) => b.n - a.n).slice(0, 12);
  const total = players.length, wau = new Set(act.filter(a => a.day > dayKey(now - 7 * DAY)).map(a => String(a.telegram_id))).size;
  const mau = new Set(act.filter(a => a.day > dayKey(now - 30 * DAY)).map(a => String(a.telegram_id))).size;
  return ok({total, dau: byDay.get(dayKey(now))?.size || 0, wau, mau, daily, retention: {d1: ret(lastDays, 1), d3: ret(lastDays, 3), d7: ret(lastDays, 7)}, sections, quit: {n: quitN, list: quitList},
    botUsers: players.filter(p => p.bot_started).length, notifyOn: players.filter(p => p.bot_started && p.notification_settings?.enabled === true).length});
}

export async function handleLiveRequest(world, input, user, now, native, notify) {
  try { weekendAnnounce(world, now); refJoinNotice(world, String(user.id), now, notify); } catch (e) { console.warn('live prelude', e?.message); }
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/ae-pet') && path !== '/api/ae-referrals' && path !== '/api/ae-stats' && path !== '/api/ae-track' && path !== '/api/ae-admin/stats') return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  if (path === '/api/ae-pet') { if (!player(world, me)) return fail('Сначала создайте персонажа.', 404); return handlePet(world, body, me, now); }
  if (path === '/api/ae-referrals') { if (!player(world, me)) return fail('Сначала создайте персонажа.', 404); return handleReferrals(world, me, native); }
  if (path === '/api/ae-stats') { const r = saveStats(world, me, body.stats, now); return r ? ok({ok: true}) : fail('Нет данных.'); }
  if (path === '/api/ae-track') return track(world, me, body.s, now);
  if (path === '/api/ae-admin/stats') { if (!user.isAdmin) return fail('Недостаточно прав.', 403); return report(world, now); }
  return null;
}
