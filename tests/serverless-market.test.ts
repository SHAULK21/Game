import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
import {handleProgressRequest} from '../server/native/progressApi';
import {createMarketListing, buyMarketListing, returnMarketListing} from '../server/marketListings';
const uuid = () => crypto.randomUUID();
const now = 1792272000000;
const item = {templateId: 'iron_ore', name: 'Железная руда', type: 'ore', rarity: 'common', level: 1, stats: {}, sellPrice: 12};
async function fixture() {
  const world = {tables: {}}, pool = new NativePool(world, () => now), store = new GameStore(pool.asPool(), {now: () => now});
  const users = [];
  for (const id of [9101, 9102, 9103]) {
    const identity = {id, displayName: 'Native ' + id}, token = uuid(); pool.ensurePlayer(identity);
    const session = await store.acquire(identity, token, 0, false);
    const created = await store.create(identity, {sessionToken: token, operationId: uuid(), expectedVersion: session.version,
      resetVersion: session.resetVersion, sessionGeneration: session.sessionGeneration}, {name: 'Native', classId: 'warrior'});
    pool.table('players').find(row => Number(row.telegram_id) === id)!.progress_json.player.worldPlace = 'settlement';
    users.push({identity, token, created});
  }
  const issue = (owner: number, extra: any = {}) => {
    const row = {id: uuid(), owner_telegram_id: owner, item_json: item, quantity: 3, origin: 'game_command',
      equipped_slot: null, locked: false, bound_clan_id: null, created_at: new Date(now).toISOString(), ...extra};
    pool.table('owned_items').push(row); return row.id;
  };
  return {world, pool, store, users, issue};
}
test('native market debits buyer, credits seller after tax and replays exactly once', async () => {
  const {pool, issue} = await fixture();
  pool.table('players')[1].market_gold = 100;
  const listing = await createMarketListing(pool.asPool(), 9101, {itemId: issue(9101), operationId: uuid(), quantity: 2, price_gold: 60});
  const request = {operationId: uuid()};
  const result = await buyMarketListing(pool.asPool(), 9102, listing.id, request);
  assert.deepEqual(await buyMarketListing(pool.asPool(), 9102, listing.id, request), result);
  assert.equal(pool.table('players')[1].market_gold, 40);
  assert.equal(pool.table('players')[0].market_gold, result.sellerGold);
  assert.equal(pool.table('owned_items').filter(row => row.id === result.itemId).length, 1);
  assert.equal(Number(pool.table('owned_items').find(row => row.id === result.itemId)!.owner_telegram_id), 9102);
  assert.equal(pool.table('market_purchase_requests').length, 1);
});
test('native market rejects foreign, protected and stale-epoch inventory without partial writes', async () => {
  const {pool, issue} = await fixture();
  for (const itemId of [issue(9103), issue(9101, {locked: true}), issue(9101, {origin: 'legacy_character'})]) {
    await assert.rejects(createMarketListing(pool.asPool(), 9101, {itemId, operationId: uuid(), quantity: 1, price_gold: 5}));
  }
  const itemId = issue(9101);
  await assert.rejects(createMarketListing(pool.asPool(), 9101, {itemId, operationId: uuid(), quantity: 1, price_gold: 5}, 1));
  assert.equal(pool.table('market_listings').length, 0);
  assert.ok(pool.table('owned_items').some(row => row.id === itemId));
});
test('native market return has a durable item receipt', async () => {
  const {pool, issue} = await fixture();
  const listing = await createMarketListing(pool.asPool(), 9101, {itemId: issue(9101), operationId: uuid(), quantity: 2, price_gold: 60});
  const first = await returnMarketListing(pool.asPool(), 9101, listing.id, 0);
  assert.deepEqual(await returnMarketListing(pool.asPool(), 9101, listing.id, 0), first);
  assert.equal(pool.table('owned_items').filter(row => row.id === first.itemId).length, 1);
});
test('native HTTP-compatible market guard returns current progress and replay receipts', async () => {
  const {world, pool, store, users, issue} = await fixture();
  const user = users[0], current = await store.load(user.identity, user.token), id = uuid();
  const body = {itemId: issue(user.identity.id), quantity: 1, price_gold: 25, operationId: uuid()};
  // Refresh after a server-issued item is added so the version fence is current.
  const latest = await store.load(user.identity, user.token);
  const input = {path: '/api/market/list', method: 'POST', body, headers: {
    'x-game-session': user.token, 'x-game-generation': String(current.sessionGeneration),
    'x-game-reset-version': '0', 'x-game-version': String(latest.version), 'x-game-operation': id}};
  const first = await handleProgressRequest(world, input, user.identity, {now: () => now});
  assert.equal(first.status, 201); assert.equal(first.body._operation.outcome, 'applied');
  assert.equal(first.body._progress.ownerId, String(user.identity.id));
  const repeated = await handleProgressRequest(world, input, user.identity, {now: () => now});
  assert.equal(repeated.status, 201); assert.equal(repeated.body._operation.replayed, true);
  assert.equal(pool.table('market_listings').length, 1);
  const receipt = await store.receipt(user.identity, user.token, id, 0);
  assert.equal(receipt.operation?.outcome, 'applied');
});
