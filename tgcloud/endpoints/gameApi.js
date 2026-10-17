import {api} from 'sdk';
import {nativeTransactions} from '../lib/nativeAtomicStorage.js';
import {handleProgressRequest, validateNativeWorld, ADMIN_TELEGRAM_ID, PRODUCTION_DOCUMENT} from '../lib/gameEngine.js';
import {drainDeliveries} from '../lib/deliveryWorker.js';

export default async function (input, ctx) {
  const user = ctx?.initData?.user;
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) return {status: 401, body: {code: 'UNAUTHORIZED', error: 'Откройте игру из Telegram.'}};
  if (JSON.stringify(input || {}).length > 1126400) return {status: 413, body: {error: 'Слишком большой запрос.'}};
  const at = Date.now();
  try {
    const reply = await nativeTransactions.update(PRODUCTION_DOCUMENT, async world => {
      const response = await handleProgressRequest(world, input, {id: user.id, username: user.username,
        displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Игрок',
        allowsWriteToPm: user.allows_write_to_pm === true}, {now: () => at, isAdmin: id => id === ADMIN_TELEGRAM_ID, startParam: ctx.initData.start_param});
      validateNativeWorld(world); return response;
    });
    if (reply.effect?.method === 'createInvoiceLink') {
      try {return {status: reply.status, body: {...reply.body, invoiceLink: await api.createInvoiceLink(reply.effect.payload)}};}
      catch {return {status: 502, body: {error: 'Не удалось создать счёт Telegram Stars. Попробуйте снова.'}};}
    }
    try {await drainDeliveries(2);} catch {console.warn('Notification delivery deferred.');}
    return {status: reply.status, body: reply.body};
  } catch (error) {
    if (error?.code === 'STATE_NOT_INITIALIZED') return {status: 503, body: {code: 'MAINTENANCE', error: 'Перенос игровых данных ещё не завершён.'}};
    console.error('Native game request failed:', error?.code || error?.name || 'UNKNOWN');
    return {status: 503, body: {code: 'RESULT_UNKNOWN', error: 'Результат пока неизвестен. Восстановите операцию перед следующим действием.'}};
  }
}
