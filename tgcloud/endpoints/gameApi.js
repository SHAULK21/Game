import {api} from 'sdk';
import {nativeTransactions} from '../lib/nativeAtomicStorage.js';
import {handleProgressRequest, validateNativeWorld, compactGameReply, ADMIN_TELEGRAM_ID, PRODUCTION_DOCUMENT} from '../lib/gameEngine.js';
import {pruneWorld, clampProfileSync, syncCanonicalProfile} from '../lib/maintenance.js';
import {drainDeliveries, sendPremiumWelcome} from '../lib/deliveryWorker.js';
import {handleSocialRequest} from '../lib/social.js';

// Telegram Serverless has no scheduler: deliver due notifications after player requests (throttled per isolate).
let lastDrain = 0;
async function maybeDrain(now) {
  if (now - lastDrain < 30000) return;
  lastDrain = now;
  try { await drainDeliveries(5); } catch (error) { console.error('drain failed', error?.code || error?.name); }
}

export default async function (input, ctx) {
  try { return await handle(input, ctx); } finally { await maybeDrain(Date.now()); }
}

async function handle(input, ctx) {
  const user = ctx?.initData?.user;
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) return {status: 401, body: {code: 'UNAUTHORIZED', error: 'Откройте игру из Telegram.'}};
  if (JSON.stringify(input || {}).length > 1126400) return {status: 413, body: {error: 'Слишком большой запрос.'}};
  const at = Date.now();
  try {
    const reply = await nativeTransactions.update(PRODUCTION_DOCUMENT, async world => {
      if (Math.random() < 0.01) pruneWorld(world, at);
      const engineUser = {id: user.id, username: user.username, displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Игрок', allowsWriteToPm: user.allows_write_to_pm === true};
      const native = sub => handleProgressRequest(world, sub, engineUser, {now: () => at, isAdmin: id => id === ADMIN_TELEGRAM_ID, startParam: ctx.initData.start_param});
      const social = await handleSocialRequest(world, input, {...user, isAdmin: user.id === ADMIN_TELEGRAM_ID}, at, native);
      if (social) return social;
      if (input.path === '/api/profile/sync' && input.body) {
        const synced = syncCanonicalProfile(world, user.id, input.body, at);
        if (synced) { validateNativeWorld(world); return synced; }
        input = {...input, body: clampProfileSync(world, user.id, input.body, at)};
      }
      const response = await handleProgressRequest(world, input, {id: user.id, username: user.username,
        displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Игрок',
        allowsWriteToPm: user.allows_write_to_pm === true}, {now: () => at, isAdmin: id => id === ADMIN_TELEGRAM_ID, startParam: ctx.initData.start_param});
      validateNativeWorld(world); return response;
    }, {maxAttempts: input.path === '/api/admin/broadcasts' && String(input.method).toUpperCase() === 'POST' ? 32 : 8});
    if (input.path === '/api/admin/news' && reply.status < 300) reply.body.channel = await syncChannel(input, reply.body);
    if (input.path === '/api/admin/premium/grant' && reply.status === 200 && !reply.body?.replayed)
      await sendPremiumWelcome(Number(input.body.targetId), Number(input.body.days), true);
    if (reply.effect?.method === 'createInvoiceLink') {
      try {return {status: reply.status, body: {...reply.body, invoiceLink: await api.createInvoiceLink(reply.effect.payload)}};}
      catch {return {status: 502, body: {error: 'Не удалось создать счёт Telegram Stars. Попробуйте снова.'}};}
    }
    const response = {status: reply.status, body: reply.body};
    return input.projectionProtocol === 1 ? compactGameReply(response) : response;
  } catch (error) {
    if (error?.code === 'STATE_BUSY') return {status: 503, body: {code: 'STATE_BUSY', retryable: true, error: 'Сервер занят. Повторите запрос через несколько секунд.'}};
    if (error?.code === 'STATE_NOT_INITIALIZED') return {status: 503, body: {code: 'MAINTENANCE', error: 'Перенос игровых данных ещё не завершён.'}};
    console.error('Native game request failed:', error?.code || error?.name || 'UNKNOWN');
    return {status: 503, body: {code: 'RESULT_UNKNOWN', error: 'Результат пока неизвестен. Восстановите операцию перед следующим действием.'}};
  }
}

// ---------- news → the game's Telegram channel: send, edit and delete the channel copy of a post ----------
const CHANNEL = '@Aethelgardo';
const escHtml = t => String(t).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
const channelText = post => `<b>${escHtml(post.title)}</b>\n\n${escHtml(post.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`\n]{1,60})`/g, '<code>$1</code>')}`.slice(0, 4096);
async function rememberChannelMsg(postId, msgId) {
  await nativeTransactions.update(PRODUCTION_DOCUMENT, world => {
    const post = (world.tables.ae_news || []).find(x => x.id === postId); if (post) post.channel = msgId ? {chat: CHANNEL, id: msgId} : undefined;
    validateNativeWorld(world); return null;
  });
}
async function syncChannel(input, body) {
  const method = String(input.method || 'GET').toUpperCase();
  try {
    if (method === 'DELETE' || input.body?.delete) {
      const msg = body.removed?.channel; if (!msg) return body.removed ? 'not-in-channel' : undefined;
      await api.deleteMessage({chat_id: msg.chat, message_id: msg.id}); return 'deleted';
    }
    if (method !== 'POST' || !body.post || body.replayed) return undefined;
    const post = body.post, payload = {text: channelText(post), parse_mode: 'HTML', link_preview_options: {is_disabled: true}};
    if (body.edited && post.channel) {
      try { await api.editMessageText({chat_id: post.channel.chat, message_id: post.channel.id, ...payload}); return 'edited'; }
      catch (e) { if (/not modified/i.test(e?.description || '')) return 'edited'; throw e; }
    }
    if (!input.body?.toChannel) return body.edited ? 'not-in-channel' : undefined;
    const sent = await api.sendMessage({chat_id: CHANNEL, ...payload});
    await rememberChannelMsg(post.id, sent?.message_id); return 'sent';
  } catch (e) { return 'failed: ' + (e?.description || e?.message || 'ошибка'); }
}
