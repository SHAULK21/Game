import {NativePool, GameStore} from '../lib/gameEngine.js';
export default async function () {
  let now = Date.now();
  const world = {tables: {}}, pool = new NativePool(world, () => now), identity = {id: 9601, displayName: 'Synthetic'};
  pool.ensurePlayer(identity).premium_until = new Date(now + 86400000).toISOString();
  const store = new GameStore(pool.asPool(), {now: () => now}), token = crypto.randomUUID();
  let current = await store.acquire(identity, token, 0, false);
  const operation = () => ({sessionToken: token, operationId: crypto.randomUUID(), expectedVersion: current.version,
    resetVersion: current.resetVersion, sessionGeneration: current.sessionGeneration});
  current = await store.create(identity, operation(), {name: 'Synthetic', classId: 'warrior', firstJourney: true});
  current = await store.operation(identity, operation(), {type: 'toggleAutoBattle'});
  const before = current.game.activeMonster.hp, deadlines = [];
  for (let i = 0; i < 8 && !current.game.isCombatEnded; i++) {
    if (!Number.isFinite(current.nextTickAt)) throw new Error('Autobattle deadline missing.');
    deadlines.push(current.nextTickAt - now); now = Math.max(now + 1, current.nextTickAt + 1);
    current = await store.load(identity, token);
  }
  const passed = current.game.isCombatEnded || current.game.activeMonster.hp < before;
  if (!passed) throw new Error('Autobattle failed to advance.');
  return {passed, before, after: current.game.activeMonster.hp, deadlines};
}
