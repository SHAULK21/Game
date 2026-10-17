import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
import {handleProgressRequest} from '../server/native/progressApi';
const uuid = () => crypto.randomUUID(), now = 1792272000000, adminId = 437290420;
async function fixture() {
  const world = {tables: {}}, pool = new NativePool(world, () => now), store = new GameStore(pool.asPool(), {now: () => now});
  const users: any[] = [];
  for (const id of [adminId, 9301, 9302]) {
    const identity = {id, displayName: 'Native ' + id, allowsWriteToPm: true}, token = uuid(); pool.ensurePlayer(identity);
    const session = await store.acquire(identity, token, 0, false);
    await store.create(identity, {sessionToken: token, operationId: uuid(), expectedVersion: session.version, resetVersion: 0, sessionGeneration: session.sessionGeneration}, {name: 'Native', classId: 'warrior'});
    pool.table('players').find(row => Number(row.telegram_id) === id)!.progress_json.player.worldPlace = 'settlement';
    users.push({identity, token});
  }
  const call = async (user: any, path: string, method = 'GET', body = {}, extra: any = {}) => {
    const state = await store.load(user.identity, user.token);
    const input = {path, method, body, headers: {'x-game-session': user.token, 'x-game-generation': String(state.sessionGeneration), 'x-game-version': String(state.version), 'x-game-reset-version': String(state.resetVersion), 'x-game-operation': uuid()}};
    return handleProgressRequest(world, input, user.identity, {now: () => now, isAdmin: id => id === adminId, ...extra});
  };
  return {world, pool, store, users, call};
}
test('all existing HTTP routes are registered natively except the replaced bot webhook', async () => {
  let routes: {method: string; pattern: string}[] = [];
  await handleProgressRequest({tables: {}}, {path: '/api/health'}, {id: 1, displayName: 'Test'}, {onRoutes: value => {routes = value;}});
  const source = JSON.parse(await fs.readFile('docs/legacy-api-routes.json', 'utf8'));
  const actual = new Set(routes.map(row => row.method + ' ' + row.pattern));
  for (const route of source.routes) if (route.path !== '/api/telegram/webhook') assert.ok(actual.has(route.method + ' ' + route.path), route.method + ' ' + route.path);
});
test('native admin grants are authorized and idempotent; account reset clears only target progress', async () => {
  const {pool, users, call} = await fixture();
  const body = {days: 3, operationId: uuid()};
  assert.equal((await call(users[1], '/api/admin/premium/self', 'POST', body)).status, 403);
  const first = await call(users[0], '/api/admin/premium/self', 'POST', body), repeat = await call(users[0], '/api/admin/premium/self', 'POST', body);
  assert.equal(first.status, 200); assert.deepEqual(first.body, repeat.body); assert.equal(pool.table('admin_premium_grants').length, 1);
  const target = users[1].identity.id, beforeOther = JSON.stringify(pool.table('players').find(row => Number(row.telegram_id) === users[2].identity.id)!.progress_json);
  const resetBody = {operationId: uuid(), expectedVersion: 0, confirmTargetId: target};
  const reset = await call(users[0], '/api/admin/players/' + target + '/reset', 'POST', resetBody);
  assert.equal(reset.status, 200); assert.equal(reset.body.resetVersion, 1);
  assert.equal(pool.table('players').find(row => Number(row.telegram_id) === target)!.progress_json, null);
  assert.equal(JSON.stringify(pool.table('players').find(row => Number(row.telegram_id) === users[2].identity.id)!.progress_json), beforeOther);
  assert.deepEqual((await call(users[0], '/api/admin/players/' + target + '/reset', 'POST', resetBody)).body, reset.body);
});
test('native notification permission and daily schedules preserve settings and deduplication', async () => {
  const {pool, users, call} = await fixture();
  const user = users[1];
  assert.equal((await call(user, '/api/notifications/settings', 'POST', {enabled: true, market: false})).status, 200);
  const row = pool.table('players').find(row => Number(row.telegram_id) === user.identity.id)!;
  assert.equal(row.bot_started, true); assert.equal(row.notification_settings.market, false);
  const body = {energy: 10, maxEnergy: 20, regenAt: now - 5000};
  await call(user, '/api/notifications/schedule', 'POST', body); await call(user, '/api/notifications/schedule', 'POST', body);
  assert.equal(pool.table('game_notifications').filter(row => Number(row.telegram_id) === user.identity.id).length, 2);
});
test('native PvP enrolls, applies one result and fences repeat opponents', async () => {
  const {pool, users, call} = await fixture();
  for (const user of users.slice(1)) assert.equal((await call(user, '/api/pvp/enroll', 'POST', {stance: 'balanced', enrolled: true})).status, 200);
  const body = {matchId: uuid(), targetId: users[2].identity.id};
  const first = await call(users[1], '/api/pvp/challenge', 'POST', body);
  assert.equal(first.status, 200); assert.equal(pool.table('pvp_matches').length, 1);
  const again = await call(users[1], '/api/pvp/challenge', 'POST', body);
  assert.equal(again.status, 200); assert.equal(pool.table('pvp_matches').length, 1);
  assert.equal(pool.table('pvp_profiles').find(row => Number(row.telegram_id) === users[1].identity.id)!.tickets, 4);
  assert.equal((await call(users[2], '/api/pvp/challenge', 'POST', {matchId: uuid(), targetId: users[1].identity.id})).status, 400);
});
test('native broadcasts keep in-game delivery and enqueue Telegram only for consented recipients', async () => {
  const {pool, users, call} = await fixture();
  const account = pool.table('players').find(row => Number(row.telegram_id) === users[1].identity.id)!;
  account.bot_started = true; account.notification_settings = {enabled: true};
  const body = {operationId: uuid(), templateId: 'update', audience: 'all'};
  const first = await call(users[0], '/api/admin/broadcasts', 'POST', body);
  assert.equal(first.status, 200); assert.equal(first.body.players, 3); assert.equal(first.body.telegram, 1);
  const repeated = await call(users[0], '/api/admin/broadcasts', 'POST', body);
  assert.equal(repeated.body.replayed, true); assert.equal(pool.table('admin_broadcasts').length, 1);
});
