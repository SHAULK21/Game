import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
import {handleProgressRequest} from '../server/native/progressApi';
const uuid = () => crypto.randomUUID();
const now = 1792272000000;
async function fixture() {
  const world = {tables: {}}, pool = new NativePool(world, () => now), store = new GameStore(pool.asPool(), {now: () => now});
  const users: any[] = [];
  for (const id of [9201, 9202, 9203]) {
    const identity = {id, displayName: 'Native ' + id}, token = uuid(); pool.ensurePlayer(identity);
    const session = await store.acquire(identity, token, 0, false);
    await store.create(identity, {sessionToken: token, operationId: uuid(), expectedVersion: session.version,
      resetVersion: 0, sessionGeneration: session.sessionGeneration}, {name: 'Native', classId: 'warrior'});
    const row = pool.table('players').find(row => Number(row.telegram_id) === id)!;
    row.progress_json.player.worldPlace = 'settlement'; row.progress_json.player.gold = 150000;
    users.push({identity, token});
  }
  const request = async (user: any, path: string, body: any = {}, operationId = uuid()) => {
    const state = await store.load(user.identity, user.token);
    const input = {path, method: 'POST', body, headers: {'x-game-session': user.token,
      'x-game-generation': String(state.sessionGeneration), 'x-game-reset-version': '0',
      'x-game-version': String(state.version), 'x-game-operation': operationId}};
    return {input, response: await handleProgressRequest(world, input, user.identity, {now: () => now})};
  };
  const create = await request(users[0], '/api/clan/create', {name: 'Native Clan', tag: 'NTV', description: '', gold: 9999999, expectedPriceGold: 100000, operationId: uuid()});
  assert.equal(create.response.status, 201);
  return {world, pool, store, users, request, create, clanId: create.response.body.clanId};
}
test('native clan creation debits server wallet once and rejects insufficient funds', async () => {
  const {world, pool, users, create, request} = await fixture();
  const owner = pool.table('players').find(row => Number(row.telegram_id) === users[0].identity.id)!;
  assert.equal(owner.progress_json.player.gold, 50000);
  const replay = await handleProgressRequest(world, create.input, users[0].identity, {now: () => now});
  assert.equal(replay.body._operation.replayed, true); assert.equal(owner.progress_json.player.gold, 50000);
  pool.table('players').find(row => Number(row.telegram_id) === users[1].identity.id)!.progress_json.player.gold = 1;
  const denied = await request(users[1], '/api/clan/create', {name: 'Other Clan', tag: 'OTH', expectedPriceGold: 100000, gold: 999999, operationId: uuid()});
  assert.equal(denied.response.status, 400); assert.equal(pool.table('clans').length, 1);
});
test('native clan vault enforces membership and roles without duplicating item quantity', async () => {
  const {pool, users, request, clanId} = await fixture();
  assert.equal((await request(users[1], '/api/clan/' + clanId + '/join')).response.status, 200);
  const id = uuid(); pool.table('owned_items').push({id, owner_telegram_id: users[1].identity.id, clan_id: null,
    bound_clan_id: null, item_json: {name: 'Ore', templateId: 'iron_ore', type: 'ore', rarity: 'common'},
    quantity: 3, locked: false, equipped_slot: null, origin: 'game_command', created_at: new Date(now).toISOString()});
  const deposited = await request(users[1], '/api/clan/storage/' + id + '/deposit', {quantity: 2});
  assert.equal(deposited.response.status, 200);
  const stored = pool.table('owned_items').find(row => row.clan_id === clanId)!;
  assert.equal(stored.quantity, 2); assert.equal(pool.table('owned_items').find(row => row.id === id)!.quantity, 1);
  assert.equal((await request(users[1], '/api/clan/storage/' + stored.id + '/withdraw', {quantity: 1})).response.status, 400);
  assert.equal((await request(users[2], '/api/clan/storage/' + stored.id + '/withdraw', {quantity: 1})).response.status, 400);
  const given = await request(users[0], '/api/clan/storage/' + stored.id + '/give', {targetId: users[1].identity.id});
  assert.equal(given.response.status, 200);
  assert.equal(pool.table('owned_items').filter(row => row.item_json.templateId === 'iron_ore' && Number(row.owner_telegram_id) === users[1].identity.id).reduce((n, row) => n + Number(row.quantity), 0), 3);
});
test('native clan roles and automatic succession retain one owner', async () => {
  const {pool, users, request, clanId} = await fixture();
  await request(users[1], '/api/clan/' + clanId + '/join');
  assert.equal((await request(users[1], '/api/clan/manage', {action: 'role', targetId: users[0].identity.id, role: 'recruit'})).response.status, 400);
  assert.equal((await request(users[0], '/api/clan/manage', {action: 'role', targetId: users[1].identity.id, role: 'officer'})).response.status, 200);
  const left = await request(users[0], '/api/clan/leave'); assert.equal(left.response.status, 200);
  assert.equal(Number(pool.table('clans')[0].owner_telegram_id), users[1].identity.id);
  assert.equal(pool.table('clan_members').filter(row => row.role === 'owner').length, 1);
});
test('native raid attack is limited daily and issues one weekly item', async () => {
  const {pool, users, request} = await fixture();
  const first = await request(users[0], '/api/clan/raid/attack');
  assert.equal(first.response.status, 200); assert.ok(first.response.body.reward?.id);
  assert.equal((await request(users[0], '/api/clan/raid/attack')).response.status, 400);
  assert.equal(pool.table('clan_raid_item_claims').length, 1);
});
