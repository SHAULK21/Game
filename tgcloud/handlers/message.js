import {api} from 'sdk';
import {nativeTransactions} from '../lib/nativeAtomicStorage.js';
import {handleBotMessage, validateNativeWorld, PRODUCTION_DOCUMENT, ADMIN_TELEGRAM_ID} from '../lib/gameEngine.js';
import {drainDeliveries, withChannelLink, sendPremiumWelcome} from '../lib/deliveryWorker.js';
export default async function (message, ctx) {
  const at = Date.now();
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
