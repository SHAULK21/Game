import crypto from 'node:crypto';
const E = await import(process.env.ENGINE || '../tgcloud/lib/gameEngine.js');
export const {NativePool, GameStore, handleProgressRequest, validateNativeWorld, ADMIN_TELEGRAM_ID} = E;
export const uuid = () => crypto.randomUUID();
export const now = Date.UTC(2026, 10, 8, 12);
export async function fixture(ids = [9201, 9202, 9203], {classId = 'warrior', gold = 150000} = {}) {
  const world = {tables: {}}, pool = new NativePool(world, () => now), store = new GameStore(pool.asPool(), {now: () => now});
  const users = [];
  for (const id of ids) {
    const identity = {id, displayName: 'Native ' + id}, token = uuid(); pool.ensurePlayer(identity);
    const session = await store.acquire(identity, token, 0, false);
    await store.create(identity, {sessionToken: token, operationId: uuid(), expectedVersion: session.version, resetVersion: 0, sessionGeneration: session.sessionGeneration}, {name: 'Hero' + id, classId});
    const row = pool.table('players').find(r => Number(r.telegram_id) === id);
    row.progress_json.player.worldPlace = 'settlement'; row.progress_json.player.gold = gold;
    users.push({identity, token});
  }
  const request = async (user, path, body = {}, method = 'POST', extra = {}) => {
    const state = await store.load(user.identity, user.token);
    const input = {path, method, body, headers: {'x-game-session': user.token, 'x-game-generation': String(state.sessionGeneration), 'x-game-reset-version': '0', 'x-game-version': String(state.version), 'x-game-operation': uuid()}, ...extra};
    const response = await handleProgressRequest(world, input, user.identity, {now: () => now, isAdmin: id => id === ADMIN_TELEGRAM_ID});
    return response;
  };
  const player = id => pool.table('players').find(r => Number(r.telegram_id) === id);
  return {world, pool, store, users, request, player};
}
