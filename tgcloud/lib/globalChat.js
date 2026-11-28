// Global (tavern) chat on top of the engine's /api/chat/global: replies, @mentions, the author's level,
// a flood guard, soft deletion and a bounded history. Rows of global_chat_messages keep the engine's shape;
// everything extra lives in ae_chat_meta (keyed by message id).
import {npcChatTick, npcOnPlayerMessage, onlineNow} from './npc.js';
const rows = (world, n) => (world.tables[n] ||= []);
const same = (a, b) => String(a) === String(b);
const ok = (body, status = 200) => ({status, body}), fail = (error, status = 400) => ({status, body: {error}});
const player = (world, id) => rows(world, 'players').find(p => same(p.telegram_id, id));
const nameOf = p => String(p?.character_name || p?.display_name || 'Игрок').trim() || 'Игрок';
const ADMIN = '437290420';
const KEEP = 300;            // messages kept; ids keep growing (max+1), so clients' afterId cursors stay valid
const COOLDOWN = 2500;       // ms between two messages of one player
const PER_MINUTE = 8;
const DELETED = '· сообщение удалено ·';

const metaOf = world => rows(world, 'ae_chat_meta');
const metaMap = world => new Map(metaOf(world).map(m => [String(m.id), m]));

export function chatLastId(world) { return rows(world, 'global_chat_messages').reduce((a, m) => Math.max(a, Number(m.id) || 0), 0); }

function prune(world, now) {
  const list = rows(world, 'global_chat_messages');
  if (list.length > KEEP + 20) {  // drop the oldest by id, never the newest (it carries the id counter)
    const sorted = list.slice().sort((a, b) => Number(a.id) - Number(b.id));
    world.tables.global_chat_messages = sorted.slice(-KEEP);
  }
  const alive = new Set(rows(world, 'global_chat_messages').map(m => String(m.id)));
  world.tables.ae_chat_meta = metaOf(world).filter(m => alive.has(String(m.id)));
  world.tables.ae_chat_flood = rows(world, 'ae_chat_flood').filter(f => now - f.t < 120e3).slice(-400);
}

function enrich(world, list, now) {
  const meta = metaMap(world);
  return list.map(m => {
    const x = meta.get(String(m.id)), p = player(world, m.telegram_id);
    const ae = {lvl: Math.max(1, Number(p?.level) || 1)};
    if (x?.reply) ae.reply = x.reply;
    if (x?.del) ae.del = 1;
    return x?.del ? {...m, text: DELETED, ae} : {...m, ae};
  });
}

export async function handleGlobalChat(world, input, user, now, native, notify) {
  const path = String(input?.path || '').split('?')[0], method = String(input?.method || 'GET').toUpperCase();
  const me = String(user.id), body = input?.body || {};
  if (path === '/api/chat/global' && method === 'GET') {
    try { npcChatTick(world, now); } catch (e) { console.error('npc chat', e?.message); }   // NPC lines and replies land before the engine reads the chat
    const r = await native(input);
    if (!(r?.status < 300) || !Array.isArray(r.body?.messages)) return r;
    // a poll only asks for newer ids: messages deleted lately are sent again, so open chats replace them too
    const after = String(input.path || '').match(/[?&]afterId=(\d{1,19})/)?.[1], extra = [];
    if (after) {
      const fresh = new Set(metaOf(world).filter(x => x.del && now - (x.delAt || 0) < 15 * 60e3).map(x => String(x.id)));
      for (const m of rows(world, 'global_chat_messages')) if (fresh.has(String(m.id)) && Number(m.id) <= Number(after)) {
        const p = player(world, m.telegram_id); if (!p) continue;
        extra.push({id: m.id, telegram_id: m.telegram_id, text: m.text, created_at: m.created_at, display_name: nameOf(p), is_premium: Date.parse(p.premium_until || '') > now});
      }
    }
    r.body = {...r.body, messages: enrich(world, [...extra, ...r.body.messages], now), last: chatLastId(world), online: onlineNow(world, now)};
    return r;
  }
  if (path === '/api/chat/global' && method === 'POST') {
    const text = String(body.text || '').trim();
    if (!text || text.length > 500) return fail('Сообщение: 1–500 символов.');
    const flood = rows(world, 'ae_chat_flood'), mine = flood.filter(f => same(f.u, me) && now - f.t < 60e3);
    const service = /⟦ae:[a-z]:/.test(text);   // the game's own posts (item, lot, co-op, clan cards): only the per-minute cap
    if (!user.isAdmin) {
      if (!service && mine.length && now - mine[mine.length - 1].t < COOLDOWN) return fail('Не так быстро — подождите пару секунд.', 429);
      if (mine.length >= PER_MINUTE) return fail('Слишком много сообщений подряд. Передохните минутку.', 429);
      const last = rows(world, 'global_chat_messages').filter(m => same(m.telegram_id, me)).sort((a, b) => Number(b.id) - Number(a.id))[0];
      if (!service && last && last.text === text && now - (Date.parse(last.created_at) || 0) < 120e3) return fail('Это сообщение уже отправлено.', 429);
    }
    // the replied message: a snapshot, so the quote survives the original being pruned or deleted
    let reply = null;
    if (body.replyTo != null && /^\d{1,19}$/.test(String(body.replyTo))) {
      const src = rows(world, 'global_chat_messages').find(m => same(m.id, body.replyTo));
      const srcMeta = src && metaMap(world).get(String(src.id));
      if (src && !srcMeta?.del) reply = {id: String(src.id), uid: String(src.telegram_id), name: nameOf(player(world, src.telegram_id)), text: String(src.text).replace(/⟦ae:[^⟧]*⟧/g, '📦').slice(0, 90)};
    }
    const r = await native({...input, body: {text}});
    if (!(r?.status < 300) || !r.body?.message) return r;
    const msg = r.body.message, author = nameOf(player(world, me));
    flood.push({u: me, t: now});
    try { npcOnPlayerMessage(world, me, text, now); } catch {}
    if (reply) metaOf(world).push({id: String(msg.id), reply});
    // who should hear about it: the replied author and @mentioned players (a bot note, rate-limited by notify)
    const to = new Set(); if (reply && !same(reply.uid, me)) to.add(reply.uid);
    const names = new Map(rows(world, 'players').filter(p => p.character_name).map(p => [nameOf(p).toLowerCase(), String(p.telegram_id)]));
    for (const m of text.matchAll(/@([^\s@,.!?;:]{2,24}(?: [^\s@,.!?;:]{2,24})?)/g)) {
      const words = m[1]; const id = names.get(words.toLowerCase()) || names.get(words.split(' ')[0].toLowerCase());
      if (id && !same(id, me)) to.add(id);
    }
    // no player text in the bot's message: only who and where
    for (const id of [...to].slice(0, 5)) notify?.(world, id, `💬 ${author} ${reply && same(reply.uid, id) ? 'ответил(а) вам' : 'упомянул(а) вас'} в общем чате таверны.`, 'chat-mention', now);
    prune(world, now);
    return ok({...r.body, message: enrich(world, [msg], now)[0]}, r.status);
  }
  if (path === '/api/ae-chat/delete' && method === 'POST') {
    const msg = rows(world, 'global_chat_messages').find(m => same(m.id, body.id));
    if (!msg) return fail('Сообщение не найдено.', 404);
    if (!user.isAdmin && me !== ADMIN && !same(msg.telegram_id, me)) return fail('Удалить можно только своё сообщение.', 403);
    const map = metaMap(world); let x = map.get(String(msg.id));
    if (!x) { x = {id: String(msg.id)}; metaOf(world).push(x); }
    x.del = 1; x.by = me; x.delAt = now; msg.text = DELETED;   // the row stays: its id holds the counter and clients' cursors
    return ok({ok: true, id: String(msg.id)});
  }
  return null;
}
