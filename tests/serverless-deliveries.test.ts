import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NativePool, type NativeWorld} from '../server/native/pool';
import {handleBotMessage, validCheckout} from '../server/native/bot';
import {claimDeliveries, acknowledgeDelivery} from '../server/native/deliveries';
import {validateNativeWorld} from '../server/native/invariants';
const now = 1792272000000, id = 9301;
function fixture() {
  const world: NativeWorld = {tables: {}}, pool = new NativePool(world, () => now);
  const player = pool.ensurePlayer({id, displayName: 'Test'});
  player.bot_started = true; player.notification_settings = {enabled: true};
  return {world, pool, player};
}
test('checkout binds price, currency and payload to a positive verified payer', () => {
  const query = {from: {id}, currency: 'XTR', total_amount: 150, invoice_payload: 'aethelgard_premium:' + id};
  assert.equal(validCheckout(query), true);
  for (const override of [{from: {id: -1}}, {total_amount: 1}, {currency: 'USD'}, {invoice_payload: 'aethelgard_premium:9302'}]) assert.equal(validCheckout({...query, ...override}), false);
});
test('start is durable and deduplicated; subscription charge replay never extends premium', async () => {
  const {world, pool, player} = fixture();
  const message = {chat: {type: 'private'}, from: {id, first_name: 'Test'}, message_id: 42, text: '/start'};
  await handleBotMessage(world, message, 55, now); await handleBotMessage(world, message, 55, now);
  assert.equal(pool.table('telegram_outbox').length, 2);
  assert.equal(pool.table('telegram_outbox')[1].payload.menu_button.web_app.url, 'https://app8958621621.tgcloud.ai/');
  const payment = {...message, text: undefined, successful_payment: {currency: 'XTR', total_amount: 150, invoice_payload: 'aethelgard_premium:' + id, telegram_payment_charge_id: 'charge-1'}};
  await handleBotMessage(world, payment, 56, now);
  const until = player.premium_until;
  const repeated = await handleBotMessage(world, payment, 56, now + 86400000);
  assert.equal(repeated.replayed, true); assert.equal(player.premium_until, until); assert.equal(pool.table('premium_payments').length, 1);
  await assert.rejects(handleBotMessage(world, {...payment, from: {id: 9302}}, 57, now), /Invalid Telegram payment/);
  validateNativeWorld(world);
});
test('delivery leases fence other workers, retry failed sends and honor opt-out', () => {
  const {world, pool, player} = fixture();
  pool.table('game_notifications').push({id: 1, telegram_id: id, category: 'market', text: 'Test', due_at: new Date(now).toISOString(), attempts: 0});
  const first = claimDeliveries(world, 'worker-1', now);
  assert.equal(first.jobs.length, 1); assert.equal(claimDeliveries(world, 'worker-2', now + 1).jobs.length, 0);
  assert.equal(acknowledgeDelivery(world, {...first.jobs[0], worker: 'worker-2'}, {ok: true}, now).acknowledged, false);
  acknowledgeDelivery(world, first.jobs[0], {ok: false}, now);
  assert.equal(claimDeliveries(world, 'worker-3', now + 299999).jobs.length, 0);
  const retry = claimDeliveries(world, 'worker-3', now + 300000);
  assert.equal(retry.jobs.length, 1); acknowledgeDelivery(world, retry.jobs[0], {ok: true}, now + 300001);
  assert.equal(claimDeliveries(world, 'worker-4', now + 500000).jobs.length, 0);
  player.notification_settings.enabled = false;
  pool.table('game_notifications').push({id: 2, telegram_id: id, category: 'market', text: 'Opt-out', due_at: new Date(now).toISOString()});
  assert.equal(claimDeliveries(world, 'worker-5', now + 500000).suppressed, 1);
});
test('expired leases recover and obsolete premium notifications are suppressed', () => {
  const {world, pool, player} = fixture();
  pool.table('telegram_outbox').push({id: 'menu', method: 'setChatMenuButton', payload: {}, attempts: 0});
  const first = claimDeliveries(world, 'old', now);
  const recovered = claimDeliveries(world, 'new', now + 120001);
  assert.equal(recovered.jobs.length, 1); assert.equal(acknowledgeDelivery(world, first.jobs[0], {ok: true}, now + 120002).acknowledged, false);
  acknowledgeDelivery(world, recovered.jobs[0], {ok: true}, now + 120002);
  player.premium_until = new Date(now + 86400000).toISOString();
  pool.table('game_notifications').push({id: 1, telegram_id: id, category: 'premium', event_key: 'premium_expire_old', text: 'Expired', due_at: new Date(now).toISOString()});
  assert.equal(claimDeliveries(world, 'new', now + 120003).suppressed, 1);
});
test('economic validator rejects duplicate ownership and negative balances', () => {
  const {world, pool, player} = fixture(); validateNativeWorld(world);
  player.market_gold = -1; assert.throws(() => validateNativeWorld(world), /ACCOUNT_VERSION_OR_BALANCE_INVALID/); player.market_gold = 0;
  const item = {id: 'one', owner_telegram_id: id, clan_id: null, quantity: 1, equipped_slot: null};
  pool.table('owned_items').push(item, {...item}); assert.throws(() => validateNativeWorld(world), /ITEM_ID_COLLISION/);
});
