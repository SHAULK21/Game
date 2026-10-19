import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';
import {GameActor} from '../server/gameActor';

async function combatActor(special = false) {
  let now = 1792272000000;
  const options = {user: {id: 9602, first_name: 'Auto'}, locale: 'uk' as const, resetVersion: 0, admin: false,
    premium: {active: true, premiumUntil: new Date(now + 86400000).toISOString(), priceStars: 150, periodDays: 30}, now: () => now};
  let actor = await new GameActor(options).initialize();
  await actor.invoke('createCharacter', 'Auto', 'warrior', true);
  const snapshot = actor.snapshot();
  snapshot.state.activeMonster = {...actor.current.activeMonster!, hp: 1000000, maxHp: 1000000, attack: 1, magicAttack: 0,
    regionId: special ? 'ascension' : 'reg_plains', skills: special ? [{id: 'burst', name: 'Удар', icon: '', manaCost: 0,
      cooldown: 3, currentCooldown: 0, damageMultiplier: 1.5, damageType: 'physical'}] : []};
  snapshot.refs.monsterDecision = null;
  actor = await new GameActor({...options, snapshot}).initialize();
  return {get actor() {return actor;}, setTime(value: number) {now = value;}, now: () => now,
    async restore(automationAllowed = true) {actor = await new GameActor({...options, automationAllowed, snapshot: actor.snapshot()}).initialize(); return actor;}};
}

for (const special of [false, true]) test(`autobattle resolves a complete ${special ? 'special' : 'ordinary'} round without advancing the clock`, async t => {
  t.mock.method(Math, 'random', () => .1);
  const f = await combatActor(special);
  await f.actor.invoke('toggleAutoBattle');
  for (let request = 0; request < 5; request++) {
    const actor = await f.restore(), round = actor.current.combatRound;
    const hp = actor.current.activeMonster!.hp;
    assert.equal(actor.nextTickAt, f.now(), 'autobattle must not add a thinking delay');
    actor.tick();
    assert.equal(actor.current.combatRound, round + 1, 'one request completes exactly one round');
    assert.equal(actor.current.turnPhase, 'player');
    assert.ok(actor.current.activeMonster!.hp < hp);
  }
});

test('manual monster deadlines survive reconstruction and enabling auto removes a pending wait', async () => {
  const f = await combatActor(true);
  await f.actor.invoke('performPlayerAction', 'defend');
  const deadline = f.actor.nextTickAt;
  assert.ok(deadline > f.now());
  f.setTime(deadline - 1);
  const restored = await f.restore();
  restored.tick();
  assert.equal(restored.nextTickAt, deadline);
  assert.equal(restored.current.monsterIntent, null);
  assert.equal(restored.current.turnPhase, 'monster');
  await restored.invoke('toggleAutoBattle');
  assert.equal(restored.nextTickAt, f.now());
  restored.tick();
  assert.ok(restored.current.combatRound >= 2);
});

test('readonly requests cannot drive the automatic player turn', async () => {
  const f = await combatActor();
  await f.actor.invoke('toggleAutoBattle');
  const actor = await f.restore(false), hp = actor.current.activeMonster!.hp;
  actor.tick();
  assert.equal(actor.current.combatRound, 1);
  assert.equal(actor.current.activeMonster!.hp, hp);
});
test('Premium autobattle completes a round across real store requests without a clock delay', async t => {
  t.mock.method(Math, 'random', () => .1);
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
    assert.equal(current.nextTickAt, now);
    const round = current.game!.combatRound;
    current = await store.load(identity, token);
    if (!current.game!.isCombatEnded) assert.equal(current.game!.combatRound, round + 1);
  }
  assert.ok(current.game!.isCombatEnded || current.game!.activeMonster!.hp < before,
    JSON.stringify({before, after: current.game!.activeMonster!.hp, phase: current.game!.turnPhase, nextTickAt: current.nextTickAt, now}));
});
