import {api} from 'sdk';
import {nativeTransactions} from './nativeAtomicStorage.js';
import {claimDeliveries, acknowledgeDelivery, PRODUCTION_DOCUMENT} from './gameEngine.js';

// Call only after committing gameplay. No Bot API call occurs in a CAS retry.
export async function drainDeliveries(limit = 10) {
  const worker = crypto.randomUUID();
  let batch;
  try {batch = await nativeTransactions.update(PRODUCTION_DOCUMENT, world => claimDeliveries(world, worker, Date.now(), limit));}
  catch (error) {if (error?.code === 'STATE_NOT_INITIALIZED') return {sent: 0, failed: 0, suppressed: 0, initialized: false}; throw error;}
  let sent = 0, failed = 0;
  for (const job of batch.jobs) {
    let ok = false, blocked = false;
    try {
      if (job.method === 'sendMessage') await api.sendMessage(withChannelLink(job.payload));
      else if (job.method === 'setChatMenuButton') await api.setChatMenuButton(job.payload);
      else throw new Error('Unsupported outbox method.');
      ok = true; sent++;
    } catch (error) {failed++; blocked = /blocked|chat not found|deactivated/i.test(String(error?.description || error));}
    await nativeTransactions.update(PRODUCTION_DOCUMENT, world => acknowledgeDelivery(world, job, {ok, blocked}, Date.now()));
  }
  return {sent, failed, suppressed: batch.suppressed, initialized: true};
}

// Every bot message carries a link to the game's channel.
const CHANNEL = 't.me/Aethelgardo';
export function withChannelLink(payload) {
  if (!payload || typeof payload.text !== 'string' || payload.text.includes(CHANNEL)) return payload;
  return {...payload, text: payload.text + '\n\n📣 Новости игры: ' + CHANNEL};
}

// Premium welcome: banner photo sent straight to the player (outside any world transaction).
const APP_URL = 'https://app8958621621.tgcloud.ai/';
export async function sendPremiumWelcome(chatId, days, gift = false) {
  const caption = (gift ? `🎁 Вам подарен игровой Premium на ${days} дн.!` : '👑 Добро пожаловать в Premium!') +
    '\n\nТеперь вам доступны автобой и его настройки, автопродолжение серии, массовая продажа и разбор, офлайн-добыча в шахте, +5 слотов сумки, VIP-метка, скидка 50% на клан и рынок без налога.' +
    '\n\nСпасибо, что поддерживаете Аэтельгард! ⚔️\n\n📣 Новости игры: ' + CHANNEL;
  try {
    await api.sendPhoto({chat_id: chatId, photo: APP_URL + 'assets/premium-welcome-v1.jpg', caption,
      reply_markup: {inline_keyboard: [[{text: '🎮 Открыть игру', web_app: {url: APP_URL}}]]}});
  } catch (error) { console.error('premium welcome failed', error?.code || error?.name); }
}
