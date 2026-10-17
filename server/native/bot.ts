import {NativePool, type NativeWorld} from './pool';
import {queueNotification} from '../socialFeatures';
import {messageLanguage} from '../telegramGameMessages';
import {gameMessagePayload, gameMenuButton} from './messages';
import {APP_URL} from './config';
export function validCheckout(query: any) {
  return Number.isSafeInteger(query?.from?.id) && query.from.id > 0 && query.currency === 'XTR' && query.total_amount === 150 &&
    query.invoice_payload === 'aethelgard_premium:' + query.from.id;
}
export async function handleBotMessage(world: NativeWorld, message: any, updateId?: number, at = Date.now()) {
  if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message?.from?.id) || message.from.id <= 0) return {handled: false};
  const start = /^\/start(?:@\w+)?(?:\s|$)/.test(String(message.text || ''));
  if (!start && !message.write_access_allowed && !message.successful_payment) return {handled: false};
  const pool = new NativePool(world, () => at), id = message.from.id;
  const existed = pool.table('players').some(row => String(row.telegram_id) === String(id));
  const row = pool.ensurePlayer({id, username: message.from.username, displayName: [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || 'Игрок'});
  if (!existed) row.preferred_language = messageLanguage(null, message.from.language_code);
  const language = messageLanguage(row.preferred_language, message.from.language_code), stamp = new Date(at).toISOString();
  if (message.write_access_allowed) row.bot_started = true;
  if (start) {
    row.bot_started = true;
    const referral = String(message.text).match(/^\/start(?:@\w+)?\s+ref_(\d+)$/);
    if (referral && Number(referral[1]) !== id && !row.referred_by && new Date(row.created_at).getTime() > at - 600000) {
      const inviter = pool.table('players').find(row => String(row.telegram_id) === referral[1]);
      if (inviter && new Date(inviter.created_at).getTime() < new Date(row.created_at).getTime()) row.referred_by = referral[1];
    }
    const event = 'start:' + id + ':' + String(updateId ?? message.message_id);
    if (!pool.table('telegram_outbox').some(row => row.id === event + ':message')) {
      pool.table('telegram_outbox').push({id: event + ':message', method: 'sendMessage',
        payload: gameMessagePayload(id, '⚔️ Добро пожаловать в Аэтельгард!\n\nНажмите «Играть», чтобы открыть игру. Уведомления об энергии, шахте и других событиях можно включить в разделе «Оповещения» в игре.\n\nПриведите нового друга: когда он достигнет 10 уровня, вы оба получите игровой Premium на 3 дня.', APP_URL, language), created_at: stamp, attempts: 0, completed_at: null});
      pool.table('telegram_outbox').push({id: event + ':menu', method: 'setChatMenuButton', payload: {chat_id: id, menu_button: gameMenuButton(APP_URL, language)}, created_at: stamp, attempts: 0, completed_at: null});
    }
  }
  const payment = message.successful_payment;
  if (payment) {
    if (payment.invoice_payload !== 'aethelgard_premium:' + id || payment.currency !== 'XTR' || Number(payment.total_amount) !== 150 || typeof payment.telegram_payment_charge_id !== 'string' || !payment.telegram_payment_charge_id) throw new Error('Invalid Telegram payment.');
    const charge = payment.telegram_payment_charge_id, previous = pool.table('premium_payments').find(row => row.telegram_payment_charge_id === charge);
    if (previous) {if (Number(previous.telegram_id) !== id || Number(previous.amount_stars) !== 150) throw new Error('Payment owner mismatch.'); return {handled: true, payment: true, replayed: true};}
    const expires = Number(payment.subscription_expiration_date || 0) > 0 ? Number(payment.subscription_expiration_date) * 1000 : at + 30 * 86400000;
    if (!Number.isFinite(expires) || !Number.isFinite(new Date(expires).getTime())) throw new Error('Invalid payment expiration.');
    const expiration = new Date(expires).toISOString();
    row.premium_until = new Date(Math.max(new Date(row.premium_until || 0).getTime(), expires)).toISOString(); row.premium_charge_id = charge; row.updated_at = stamp;
    pool.table('premium_payments').push({id: pool.table('premium_payments').reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1, telegram_id: id, telegram_payment_charge_id: charge, amount_stars: 150, subscription_expiration_date: expiration, is_recurring: !!payment.is_recurring, is_first_recurring: !!payment.is_first_recurring, created_at: stamp});
    await queueNotification(pool.asPool(), id, 'premium_' + charge, 'premium', '👑 Оплата принята. Игровой Premium активирован.', new Date(at));
    await queueNotification(pool.asPool(), id, 'premium_expire_' + row.premium_until, 'premium', '👑 Срок игрового Premium истёк.', new Date(row.premium_until));
  }
  return {handled: true, ...(payment ? {payment: true, replayed: false} : {})};
}
