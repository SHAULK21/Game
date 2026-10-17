import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
test('Premium autobattle survives reconstruction between every server request', async () => {
  let now = 1792272000000;
  const world = {tables: {}}, pool = new NativePool(world, () => now), identity = {id: 9601, displayName: 'Auto test'};
  const account = pool.ensurePlayer(identity); account.premium_until = new Date(now + 86400000).toISOString();
  const store = new GameStore(pool.asPool(), {now: () => now}), token = crypto.randomUUID();
  let current = await store.acquire(identity, token, 0, false);
  const operation = () => ({sessionToken: token, operationId: crypto.randomUUID(), expectedVersion: current.version,
    resetVersion: current.resetVersion, sessionGeneration: current.sessionGeneration});
  current = await store.create(identity, operation(), {name: 'Auto', classId: 'warrior', firstJourney: true});
  current = await store.operation(identity, operation(), {type: 'toggleAutoBattle'});
  assert.equal(current.game!.autoBattle.enabled, true);
  const before = current.game!.activeMonster!.hp;
  for (let i = 0; i < 8 && !current.game!.isCombatEnded; i++) {
    now = Math.max(now + 1, current.nextTickAt! + 1);
    current = await store.load(identity, token);
  }
  assert.ok(current.game!.isCombatEnded || current.game!.activeMonster!.hp < before,
    JSON.stringify({before, after: current.game!.activeMonster!.hp, phase: current.game!.turnPhase, nextTickAt: current.nextTickAt, now}));
});
