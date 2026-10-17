import {NativePool, GameStore, ExpeditionStore, handleProgressRequest, validateNativeWorld, handleBotMessage, claimDeliveries, acknowledgeDelivery, ADMIN_TELEGRAM_ID} from '../lib/gameEngine.js';
// Synthetic isolated world only: no DB writes or Telegram API effects.
export default async function () {
  const world = {tables: {}}, now = Date.now(), pool = new NativePool(world, () => now);
  const store = new GameStore(pool.asPool(), {now: () => now}), users = [];
  function check(condition, stage) {if (!condition) throw new Error('CHECK_FAILED:' + stage);}
  for (const id of [ADMIN_TELEGRAM_ID, 9501, 9502]) {
    const identity = {id, displayName: 'Synthetic', allowsWriteToPm: true}, token = crypto.randomUUID(); pool.ensurePlayer(identity);
    const session = await store.acquire(identity, token, 0, false);
    await store.create(identity, {sessionToken: token, operationId: crypto.randomUUID(), expectedVersion: session.version, resetVersion: 0, sessionGeneration: session.sessionGeneration}, {name: 'Synthetic', classId: 'warrior'});
    const account = pool.table('players').find(row => Number(row.telegram_id) === id);
    account.progress_json.player.worldPlace = 'settlement'; account.progress_json.player.gold = 150000;
    users.push({identity, token});
  }
  const call = async (user, path, method = 'GET', body = {}) => {
    const state = await store.load(user.identity, user.token);
    const result = await handleProgressRequest(world, {path, method, body, headers: {'x-game-session': user.token,
      'x-game-generation': String(state.sessionGeneration), 'x-game-version': String(state.version), 'x-game-reset-version': '0', 'x-game-operation': crypto.randomUUID()}}, user.identity, {now: () => now, isAdmin: id => id === ADMIN_TELEGRAM_ID});
    validateNativeWorld(world); return result;
  };
  const clan = await call(users[1], '/api/clan/create', 'POST', {name: 'Synthetic clan', tag: 'STG', gold: 150000, expectedPriceGold: 100000, operationId: crypto.randomUUID()});
  check(clan.status === 201, 'clan');
  check((await call(users[2], '/api/clan/' + clan.body.clanId + '/join', 'POST')).status === 200, 'join');
  const itemId = crypto.randomUUID(); pool.table('owned_items').push({id: itemId, owner_telegram_id: 9501, clan_id: null, bound_clan_id: null,
    item_json: {templateId: 'iron_ore', name: 'Ore', type: 'ore', rarity: 'common', level: 1, stats: {}, sellPrice: 12}, quantity: 3, locked: false, equipped_slot: null, origin: 'game_command', created_at: new Date(now).toISOString()});
  const listed = await call(users[1], '/api/market/list', 'POST', {itemId, quantity: 1, price_gold: 25, operationId: crypto.randomUUID()});
  check(listed.status === 201, 'market-list');
  const expedition = new ExpeditionStore(pool.asPool(), () => now);
  const account = pool.table('players').find(row => Number(row.telegram_id) === 9502);
  const launched = await expedition.mutate({ownerId: 9502, sessionToken: users[2].token, operationId: crypto.randomUUID(),
    expectedVersion: Number(account.progress_version), resetVersion: 0, sessionGeneration: Number(account.progress_session_generation)},
    {type: 'start', selection: {route: 'old-mine', goal: 'balanced', duration: 1, preparation: 'none', crew: 'personal'}});
  check(!!launched.state.active, 'expedition');
  check((await call(users[0], '/api/admin/premium/self', 'POST', {days: 3, operationId: crypto.randomUUID()})).status === 200, 'premium-admin');
  check((await call(users[2], '/api/admin/players')).status === 403, 'admin-deny');
  check((await call(users[0], '/api/admin/balance')).status === 200, 'analytics');
  const message = {chat: {type: 'private'}, from: {id: 9501, first_name: 'Synthetic'}, text: '/start', message_id: 1};
  await handleBotMessage(world, message, 1, now); await handleBotMessage(world, message, 1, now);
  const jobs = claimDeliveries(world, 'synthetic', now, 10);
  check(jobs.jobs.length === 2, 'start-outbox');
  for (const job of jobs.jobs) acknowledgeDelivery(world, job, {ok: true}, now);
  check(claimDeliveries(world, 'synthetic-2', now, 10).jobs.length === 0, 'outbox-replay');
  validateNativeWorld(world);
  return {passed: true, characters: users.length, clan: clan.status, market: listed.status, menuJobs: jobs.jobs.length, economyValid: true};
}
