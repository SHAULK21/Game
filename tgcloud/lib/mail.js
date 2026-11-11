// 🔔 Inbox: the notification history (ae_events, also what happened while the player was offline) and the
// administration's mail — letters to one player or to everyone, optionally with gifts claimed from the letter.
// Gold, silver, energy, fragments and arena tickets live on the device, so the server only hands them out once
// per player (by operation id); Premium days are applied here.
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const iso = t => new Date(t).toISOString();
const DAY = 864e5, KEEP = 30 * DAY, UUID = /^[0-9a-f-]{36}$/i;
const GIFT_MAX = {gold: 10000000, silver: 1000000, energy: 500, fragments: 500, arenaTickets: 100, premiumDays: 365};
function cleanGifts(g) {
  const out = {}; for (const [k, max] of Object.entries(GIFT_MAX)) { const v = Math.floor(Number(g?.[k]) || 0); if (v > 0) out[k] = Math.min(v, max); }
  return out;
}
const hasGifts = g => Object.keys(g || {}).length > 0;
const created = p => Date.parse(p?.created_at || 0) || 0;
// a letter to everyone reaches players who already had a hero when it was sent
const visible = (m, me, p, now) => Date.parse(m.at) > now - KEEP && (m.to === 'all' ? (!created(p) || created(p) <= Date.parse(m.at) + 60e3) : same(m.to, me));
function prune(world, now) {
  const live = rows(world, 'ae_mail').filter(m => Date.parse(m.at) > now - KEEP); world.tables.ae_mail = live;
  const ids = new Set(live.map(m => m.id)); world.tables.ae_mail_state = rows(world, 'ae_mail_state').filter(s => ids.has(s.m));
}
const stateOf = (world, m, me) => rows(world, 'ae_mail_state').find(s => s.m === m.id && same(s.u, me));
const mailView = (world, m, me) => { const s = stateOf(world, m, me); return {id: m.id, title: m.title, text: m.text, gifts: m.gifts || {}, at: m.at, toAll: m.to === 'all', read: !!s?.read, claimed: !!s?.claimed}; };
function findPlayer(world, who) {
  const s = String(who || '').trim().replace(/^@/, ''); if (!s) return null;
  return player(world, s) || rows(world, 'players').find(p => nameOf(p).toLocaleLowerCase() === s.toLocaleLowerCase()) || null;
}
function inbox(world, me, now) {
  const p = player(world, me), seen = rows(world, 'ae_inbox_seen').find(r => same(r.u, me))?.at || '';
  const events = rows(world, 'ae_events').filter(e => same(e.to, me)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40).map(e => ({id: e.id, icon: e.icon, text: e.text, kind: e.kind, at: e.at, isNew: e.at > seen}));
  const mail = rows(world, 'ae_mail').filter(m => visible(m, me, p, now)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30).map(m => mailView(world, m, me));
  const pm = rows(world, 'private_chat_messages').filter(m => same(m.recipient_id, me) && !m.read_at).length;
  const friendReq = rows(world, 'friendships').filter(f => f.status === 'pending' && (same(f.a, me) || same(f.b, me)) && !same(f.requester, me)).length;
  const unread = events.filter(e => e.isNew).length + mail.filter(m => !m.read || (hasGifts(m.gifts) && !m.claimed)).length;
  return ok({events, mail, pm, friendReq, unread, seenAt: seen || null});
}
export function handleMail(world, input, user, now, notify) {
  const path = String(input?.path || '').split('?')[0];
  if (!path.startsWith('/api/ae-inbox') && path !== '/api/admin/mail') return null;
  const method = String(input?.method || 'GET').toUpperCase(), body = input?.body || {}, me = String(user.id);
  prune(world, now);
  if (path === '/api/ae-inbox' && method === 'GET') return inbox(world, me, now);
  if (path === '/api/ae-inbox/seen' && method === 'POST') { // the bell was opened: history seen, letters on screen read
    const r = rows(world, 'ae_inbox_seen').find(x => same(x.u, me)); if (r) r.at = iso(now); else rows(world, 'ae_inbox_seen').push({u: me, at: iso(now)});
    const p = player(world, me);
    for (const id of (Array.isArray(body.mail) ? body.mail : []).slice(0, 50)) {
      const m = rows(world, 'ae_mail').find(x => x.id === id); if (!m || !visible(m, me, p, now)) continue;
      const s = stateOf(world, m, me); if (s) s.read = true; else rows(world, 'ae_mail_state').push({m: m.id, u: me, read: true, claimed: false, at: iso(now)});
    }
    return ok({ok: true});
  }
  if (path === '/api/ae-inbox/claim' && method === 'POST') {
    const p = player(world, me); if (!p) return fail('Сначала создайте персонажа.', 404);
    const op = String(body.operationId || ''); if (!UUID.test(op)) return fail('Нет идентификатора операции.');
    const m = rows(world, 'ae_mail').find(x => x.id === body.id); if (!m || !visible(m, me, p, now)) return fail('Письмо не найдено.', 404);
    if (!hasGifts(m.gifts)) return fail('В письме нет подарков.');
    let s = stateOf(world, m, me);
    if (s?.claimed) return s.op === op ? ok({gifts: m.gifts, replayed: true}) : fail('Подарок уже получен.');
    if (!s) { s = {m: m.id, u: me, read: true, claimed: false, at: iso(now)}; rows(world, 'ae_mail_state').push(s); }
    Object.assign(s, {read: true, claimed: true, op, at: iso(now)});
    if (m.gifts.premiumDays) p.premium_until = iso(Math.max(now, Date.parse(p.premium_until || 0) || 0) + m.gifts.premiumDays * DAY);
    return ok({gifts: m.gifts});
  }
  if (path === '/api/admin/mail') {
    if (!user.isAdmin) return fail('Недостаточно прав.', 403);
    const list = rows(world, 'ae_mail');
    if (method === 'GET') return ok({mail: list.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20).map(m => ({id: m.id, title: m.title, at: m.at, gifts: m.gifts || {},
      to: m.to === 'all' ? 'Всем игрокам' : nameOf(player(world, m.to)), claimed: rows(world, 'ae_mail_state').filter(s => s.m === m.id && s.claimed).length,
      read: rows(world, 'ae_mail_state').filter(s => s.m === m.id && s.read).length}))});
    if (method === 'POST' && body.delete) { world.tables.ae_mail = list.filter(m => m.id !== body.id); world.tables.ae_mail_state = rows(world, 'ae_mail_state').filter(s => s.m !== body.id); return ok({ok: true}); }
    if (method !== 'POST') return fail('Метод не поддерживается.', 405);
    const op = String(body.operationId || ''); if (!UUID.test(op)) return fail('Нет идентификатора операции.');
    const dup = list.find(m => m.op === op); if (dup) return ok({id: dup.id, replayed: true});
    const title = String(body.title || '').trim().slice(0, 80), text = String(body.text || '').trim().slice(0, 2000), gifts = cleanGifts(body.gifts);
    if (!title) return fail('Нужна тема письма.');
    if (!text && !hasGifts(gifts)) return fail('Напишите текст или добавьте подарок.');
    let to = 'all';
    if (body.to !== 'all') { const target = findPlayer(world, body.to); if (!target) return fail('Игрок не найден: укажите ник героя или Telegram ID.', 404); to = String(target.telegram_id); }
    const m = {id: crypto.randomUUID(), op, to, title, text, gifts, at: iso(now)}; list.push(m);
    if (to !== 'all') notify?.(world, to, `✉️ Письмо от администрации: «${title}»${hasGifts(gifts) ? ' 🎁 с подарком' : ''}. Откройте игру → 🔔 в шапке.`, 'mail:' + m.id, now);
    return ok({id: m.id, to: to === 'all' ? 'Всем игрокам' : nameOf(player(world, to))}, 201);
  }
  return fail('API не найден.', 404);
}
