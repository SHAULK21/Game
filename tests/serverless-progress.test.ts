import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
import {ExpeditionStore} from '../server/expeditions/store';
import {handleProgressRequest} from '../server/native/progressApi';

const now = 1792272000000;
const identity = {id: 9001, displayName: 'Native Player'};
const uuid = () => crypto.randomUUID();
function fixture() {
  const world = {tables: {}};
  const pool = new NativePool(world, () => now); pool.ensurePlayer(identity);
  const store = new GameStore(pool.asPool(), {now: () => now});
  const sessionToken = uuid();
  return {world, pool, store, sessionToken};
}
function operation(envelope: any, sessionToken: string, operationId = uuid()) {
  return {sessionToken, operationId, expectedVersion: envelope.version,
    resetVersion: envelope.resetVersion, sessionGeneration: envelope.sessionGeneration};
}
async function character() {
  const f = fixture();
  const session = await f.store.acquire(identity, f.sessionToken, 0, false);
  const created = await f.store.create(identity, operation(session, f.sessionToken), {name: 'Native', classId: 'warrior'});
  return {...f, created};
}
test('native repository executes real character creation and restores canonical inventory', async () => {
  const {store, pool, sessionToken, created} = await character();
  assert.equal(created.canonical, true); assert.equal(created.save!.player.gold, 120);
  const loaded = await store.load(identity, sessionToken);
  assert.equal(loaded.save!.player.id, created.save!.player.id);
  assert.deepEqual(loaded.save!.player.inventory, created.save!.player.inventory);
  assert.equal(pool.table('game_operations').length, 1);
  assert.equal(pool.table('expedition_accounts').length, 1);
});
test('real purchases are idempotent and changed request IDs are rejected', async () => {
  const {store, pool, sessionToken} = await character();
  const row = pool.table('players')[0]; row.progress_json.player.worldPlace = 'settlement';
  const before = await store.load(identity, sessionToken);
  const request = operation(before, sessionToken);
  const first = await store.operation(identity, request, {type: 'buyBasicConsumable', templateId: 'pot_hp_small'});
  const repeat = await store.operation(identity, request, {type: 'buyBasicConsumable', templateId: 'pot_hp_small'});
  assert.equal(first.save!.player.gold, 85); assert.equal(repeat.save!.player.gold, 85);
  assert.equal(repeat.operation.replayed, true);
  await assert.rejects(store.operation(identity, request, {type: 'buyBasicConsumable', templateId: 'pot_mp_small'}), {code: 'OPERATION_CONFLICT'});
});
test('native sessions fence stale writers and reset epochs', async () => {
  const {store, pool, sessionToken, created} = await character();
  const phone = uuid();
  await assert.rejects(store.acquire(identity, phone, created.sessionGeneration, false), {code: 'SESSION_ACTIVE'});
  await store.acquire(identity, phone, created.sessionGeneration, true);
  await assert.rejects(store.operation(identity, operation(created, sessionToken), {type: 'keepServer'}), {code: 'SESSION_LOST'});
  pool.table('players')[0].reset_version++;
  await assert.rejects(store.operation(identity, operation(created, phone), {type: 'keepServer'}), {code: 'ACCOUNT_RESET'});
});
test('native savepoints retain the pre-action frame and persist rejected operation receipts', async () => {
  const {store, pool, sessionToken, created} = await character();
  const request = operation(created, sessionToken);
  const result = await store.operation(identity, request, {type: 'adminAddGold', amount: 10000});
  assert.equal(result.operation.outcome, 'rejected'); assert.equal(result.save!.player.gold, 120);
  const replay = await store.receipt(identity, sessionToken, request.operationId, request.resetVersion);
  assert.equal(replay.operation?.outcome, 'rejected');
  assert.equal(pool.table('game_operations').filter(row => row.operation_id === request.operationId).length, 1);
});
test('real expedition training runs inside the native candidate without PostgreSQL', async () => {
  const {store, pool, sessionToken} = await character();
  const row = pool.table('players')[0]; row.progress_json.player.worldPlace = 'settlement'; row.progress_json.player.gold = 10000;
  const before = await store.load(identity, sessionToken);
  const request = {...operation(before, sessionToken), ownerId: identity.id};
  const result = await new ExpeditionStore(pool.asPool(), () => now).mutate(request, {type: 'train'});
  assert.equal(result.state.skill, 2); assert.equal(result.replayed, false);
  const repeat = await new ExpeditionStore(pool.asPool(), () => now).mutate(request, {type: 'train'});
  assert.equal(repeat.replayed, true);
});
test('native API uses verified identity, ignores body ownership and preserves HTTP protocol', async () => {
  const world = {tables: {}};
  const sessionToken = uuid();
  const loaded = await handleProgressRequest(world, {path: '/api/progress', method: 'GET'}, identity, {now: () => now});
  assert.equal(loaded.status, 200); assert.equal(loaded.body.ownerId, String(identity.id));
  const session = await handleProgressRequest(world, {path: '/api/progress/session', method: 'POST',
    headers: {'x-game-session': sessionToken}, body: {generation: 0, transfer: false, ownerId: 999}}, identity, {now: () => now});
  assert.equal(session.status, 200); assert.equal(session.body.activeHere, true);
  const denied = await handleProgressRequest(world, {path: '/api/progress'}, {id: 0, displayName: 'Invalid'});
  assert.equal(denied.status, 401);
});

test('native expedition start, completion and warehouse claim preserve exactly-once inventory', async scenario => {
  scenario.mock.method(crypto, 'randomBytes', ((size: number) => Buffer.alloc(size, 1)) as typeof crypto.randomBytes);
  const {pool, sessionToken} = await character();
  let clock = now;
  const row = pool.table('players')[0]; row.progress_json.player.worldPlace = 'settlement'; row.progress_json.player.gold = 10000;
  const store = new ExpeditionStore(pool.asPool(), () => clock);
  const op = () => ({ownerId: identity.id, sessionToken, operationId: uuid(), expectedVersion: Number(row.progress_version), resetVersion: 0, sessionGeneration: Number(row.progress_session_generation)});
  const first = await store.mutate(op(), {type: 'start', selection: {route: 'old-mine', goal: 'balanced', duration: 1, preparation: 'none', crew: 'personal'}});
  const run = first.state.active!; assert.ok(run); assert.equal(pool.table('game_notifications').length, 1);
  clock += 3600001;
  const completed = await store.mutate(op(), {type: 'reconcile'}); assert.ok(completed.state.warehouse);
  const request = op(), claim = await store.mutate(request, {type: 'claim', runId: run.id});
  assert.ok(claim.result.transferred.length); const inventory = JSON.stringify(pool.table('owned_items'));
  const replay = await store.mutate(request, {type: 'claim', runId: run.id});
  assert.equal(replay.replayed, true); assert.equal(JSON.stringify(pool.table('owned_items')), inventory);
});
