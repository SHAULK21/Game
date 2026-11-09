// Friends list + Telegram notices for friend requests and private messages.
// Private chat itself is served by the engine (/api/chat/private/*).
const ONLINE_MS = 5 * 60 * 1000, MAX_FRIENDS = 100, NOTICE_GAP_MS = 10 * 60 * 1000;
const APP_URL = 'https://app8958621621.tgcloud.ai/';
const same = (a, b) => String(a) === String(b);
const rows = (world, name) => (world.tables[name] ||= []);
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const card = (p, now) => ({id: String(p.telegram_id), name: nameOf(p), level: Number(p.level || 1), classId: p.class_id || null,
  online: Date.parse(p.last_seen_at || 0) >= now - ONLINE_MS, inClan: !!p.clan_id});
const ok = (body, status = 200) => ({status, body});
const fail = (error, status = 400) => ({status, body: {error}});
const pairKey = (a, b) => [String(a), String(b)].sort().join(':');

function link(world, a, b) { return rows(world, 'friendships').find(f => f.pair === pairKey(a, b)); }

export function notify(world, to, text, kind, now) {
  const target = player(world, to);
  if (!target?.bot_started || target.notification_settings?.enabled === false || target.notification_settings?.social === false) return;
  const marks = rows(world, 'social_notice_marks'), key = kind + ':' + to;
  const mark = marks.find(m => m.key === key);
  if (mark && Date.parse(mark.at) > now - NOTICE_GAP_MS) return;
  if (mark) mark.at = new Date(now).toISOString(); else marks.push({key, at: new Date(now).toISOString()});
  rows(world, 'telegram_outbox').push({id: crypto.randomUUID(), method: 'sendMessage', created_at: new Date(now).toISOString(), attempts: 0,
    completed_at: null, delivery_lease_owner: null, delivery_lease_until: null,
    payload: {chat_id: Number(to), text, reply_markup: {inline_keyboard: [[{text: '🎮 Открыть игру', web_app: {url: APP_URL}}]]}}});
}

import {handleCoopRequest} from './coop.js';
import {handleExtras, pushEvent} from './arenaExtras.js';
import {handleHordeRequest} from './horde.js';
import {handleProfileRequest} from './profile.js';
import {handleLiveRequest} from './live.js';

export async function handleSocialRequest(world, input, user, now, native) {
  const live = await handleLiveRequest(world, input, user, now, native, notify);
  if (live) return live;
  const horde = handleHordeRequest(world, input, user, now);
  if (horde) return horde;
  const profile = handleProfileRequest(world, input, user, now);
  if (profile) return profile;
  const coop = await handleCoopRequest(world, input, user, now, notify);
  if (coop) return coop;
  const extra = await handleExtras(world, input, user, now, notify);
  if (extra) return extra;
  if (String(input?.path || '').split('?')[0] === '/api/admin/premium/grant') return grantPremium(world, input, user, now);
  const path = String(input?.path || '').split('?')[0], method = String(input?.method || 'GET').toUpperCase();
  const me = user.id, body = input?.body || {};
  if (method === 'POST' && /^\/api\/chat\/private\/\d+$/.test(path)) { postDmNotice(world, me, path.split('/').pop(), body, now); return null; }
  if (!path.startsWith('/api/friends')) return null;
  if (!player(world, me)) return fail('Сначала создайте персонажа.', 404);
  const list = rows(world, 'friendships');

  if (method === 'GET' && path === '/api/friends') {
    const mine = list.filter(f => same(f.a, me) || same(f.b, me));
    const other = f => (same(f.a, me) ? f.b : f.a);
    const view = f => { const p = player(world, other(f)); return p ? {...card(p, now), since: f.updated_at} : null; };
    return ok({
      friends: mine.filter(f => f.status === 'accepted').map(view).filter(Boolean).sort((x, y) => Number(y.online) - Number(x.online) || x.name.localeCompare(y.name)),
      incoming: mine.filter(f => f.status === 'pending' && !same(f.requester, me)).map(view).filter(Boolean),
      outgoing: mine.filter(f => f.status === 'pending' && same(f.requester, me)).map(view).filter(Boolean),
    });
  }
  if (method === 'GET' && path === '/api/friends/search') {
    const q = String(new URLSearchParams(String(input.path).split('?')[1] || '').get('q') || '').trim().toLocaleLowerCase().slice(0, 40);
    if (q.length < 2) return ok({players: []});
    const found = rows(world, 'players').filter(p => !same(p.telegram_id, me) && (nameOf(p).toLocaleLowerCase().includes(q) || String(p.telegram_id) === q || String(p.username || '').toLocaleLowerCase() === q.replace(/^@/, '')))
      .slice(0, 20).map(p => ({...card(p, now), relation: link(world, me, p.telegram_id)?.status || null}));
    return ok({players: found});
  }
  if (method !== 'POST') return fail('Метод не поддерживается.', 405);
  const target = String(body.targetId || '');
  if (!/^\d{1,19}$/.test(target) || same(target, me)) return fail('Выберите другого игрока.');
  const other = player(world, target);
  if (!other) return fail('Игрок не найден.', 404);
  const existing = link(world, me, target), stamp = new Date(now).toISOString();

  if (path === '/api/friends/request') {
    if (existing?.status === 'accepted') return ok({status: 'accepted'});
    if (existing && !same(existing.requester, me)) { existing.status = 'accepted'; existing.updated_at = stamp; notify(world, target, `🤝 ${nameOf(player(world, me))} принял(а) вашу заявку в друзья.`, 'friend', now); return ok({status: 'accepted'}); }
    if (existing) return ok({status: 'pending'});
    if (list.filter(f => same(f.a, me) || same(f.b, me)).length >= MAX_FRIENDS) return fail(`Не больше ${MAX_FRIENDS} друзей и заявок.`);
    const [a, b] = [String(me), target].sort();
    list.push({pair: pairKey(me, target), a, b, requester: String(me), status: 'pending', created_at: stamp, updated_at: stamp});
    notify(world, target, `👋 ${nameOf(player(world, me))} хочет добавить вас в друзья в Аэтельгарде.`, 'friend', now);
    return ok({status: 'pending'}, 201);
  }
  if (path === '/api/friends/accept') {
    if (!existing || existing.status !== 'pending' || same(existing.requester, me)) return fail('Заявка не найдена.', 404);
    existing.status = 'accepted'; existing.updated_at = stamp;
    notify(world, target, `🤝 ${nameOf(player(world, me))} принял(а) вашу заявку в друзья.`, 'friend', now);
    pushEvent(world, target, '🤝', `${nameOf(player(world, me))} теперь ваш друг`, 'friend-accepted', {id: String(me)}, now);
    return ok({status: 'accepted'});
  }
  if (path === '/api/friends/decline' || path === '/api/friends/remove') {
    if (existing) world.tables.friendships = list.filter(f => f !== existing);
    return ok({status: null});
  }
  return fail('API не найден.', 404);
}

function postDmNotice(world, me, peer, body, now) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 500 || !player(world, peer)) return;
  const preview = text.length > 120 ? text.slice(0, 117) + '…' : text;
  notify(world, peer, `✉️ ${nameOf(player(world, me))} пишет вам:\n«${preview}»`, 'dm:' + me, now);
}

// Admin: grant game Premium to any player (idempotent by operationId).
function grantPremium(world, input, user, now) {
  if (!user.isAdmin) return fail('Недостаточно прав.', 403);
  if (String(input.method || '').toUpperCase() !== 'POST') return fail('Метод не поддерживается.', 405);
  const {targetId, days: rawDays, operationId} = input.body || {}, days = Number(rawDays);
  if (!/^\d{1,19}$/.test(String(targetId || '')) || !Number.isInteger(days) || days < 1 || days > 365 || typeof operationId !== 'string' || operationId.length < 8 || operationId.length > 64)
    return fail('Выберите игрока и укажите 1–365 дней.');
  const target = player(world, targetId);
  if (!target) return fail('Игрок не найден.', 404);
  const grants = rows(world, 'admin_premium_grants'), done = grants.find(g => g.id === operationId);
  if (done) {
    if (!same(done.telegram_id, targetId) || Number(done.days) !== days) return fail('ID операции уже использован.', 409);
    return ok({premiumUntil: target.premium_until, replayed: true});
  }
  grants.push({id: operationId, telegram_id: Number(targetId), days, granted_by: Number(user.id), created_at: new Date(now).toISOString()});
  target.premium_until = new Date(Math.max(now, Date.parse(target.premium_until || 0) || 0) + days * 864e5).toISOString();
  notify(world, targetId, `👑 Вам выдан игровой Premium на ${days} дн. Спасибо, что играете в Аэтельгард!`, 'premium-gift', now);
  pushEvent(world, targetId, '👑', `Вам подарен Premium на ${days} дн.!`, 'premium', {days}, now);
  return ok({premiumUntil: target.premium_until, name: nameOf(target)});
}
