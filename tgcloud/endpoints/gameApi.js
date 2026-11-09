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
      const social = await handleSocialRequest(world, input, {...user, isAdmin: user.id === ADMIN_TELEGRAM_ID}, at);
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
    if (input.path === '/api/admin/news' && reply.status === 201 && input.body?.toChannel) {
      try { await api.sendMessage({chat_id: '@Aethelgardo', text: `${reply.body.post.title}\n\n${reply.body.post.text}`.slice(0, 4096), link_preview_options: {is_disabled: true}}); reply.body.channel = 'sent'; }
      catch (e) { reply.body.channel = 'failed: ' + (e?.description || e?.message || 'ошибка'); }
    }
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
