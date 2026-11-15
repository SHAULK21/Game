import {api} from 'sdk';
import {nativeTransactions} from '../lib/nativeAtomicStorage.js';
import {handleBotMessage, validateNativeWorld, PRODUCTION_DOCUMENT, ADMIN_TELEGRAM_ID} from '../lib/gameEngine.js';
import {drainDeliveries, withChannelLink, sendPremiumWelcome} from '../lib/deliveryWorker.js';
const GAME_URL = 'https://app8958621621.tgcloud.ai/';
export default async function (message, ctx) {
  const at = Date.now();
  // The Android app asks to refresh its Telegram login: one button opens the game, which hands a fresh login back to the app.
  if (/^\/start(@\w+)?\s+apklink\b/.test(message?.text || '') && message.chat?.type === 'private') {
    try { await api.sendMessage({chat_id: message.chat.id, text: '📱 Обновление входа в приложение Android\n\nНажмите кнопку ниже — игра откроется на секунду и сама вернёт вас в приложение с новым входом.',
      reply_markup: {inline_keyboard: [[{text: '🔄 Обновить вход в приложении', web_app: {url: GAME_URL + '?apklink=1'}}]]}}); }
    catch (error) { console.error('apklink reply failed', error?.code); }
    return {ok: true};
  }
  const result = await nativeTransactions.update(PRODUCTION_DOCUMENT, async world => {
    const result = await handleBotMessage(world, message, ctx?.update?.update_id, at);
    validateNativeWorld(world); return result;
  });
  if (message?.successful_payment && !result?.replayed) {
    await sendPremiumWelcome(message.from?.id || message.chat?.id, 30);
    await notifyAdminAboutPayment(message);
  }
  await drainDeliveries(3);
  return result;
}

async function notifyAdminAboutPayment(message) {
  const p = message.successful_payment, u = message.from || {};
  const who = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Игрок';
  const text = `💎 Новая покупка Premium\n\nИгрок: ${who}${u.username ? ' (@' + u.username + ')' : ''}\nID: ${u.id}\nСумма: ${p.total_amount} ${p.currency === 'XTR' ? '⭐' : p.currency}\nПлатёж: ${p.telegram_payment_charge_id}`;
  try { await api.sendMessage(withChannelLink({chat_id: ADMIN_TELEGRAM_ID, text})); }
  catch (error) { console.error('admin payment notice failed', error?.code); }
}
