import test from 'node:test';
import assert from 'node:assert/strict';
import {GameActor, type ActorOptions} from '../server/gameActor';

const premium = {active: false, premiumUntil: null, priceStars: 150, periodDays: 30};
const options = (id = 900): ActorOptions => ({user: {id, first_name: 'Игрок'}, locale: 'ru', resetVersion: 0, admin: false, premium});
test('shared production actor creates isolated real characters without a browser', async () => {
  const first = await new GameActor(options()).initialize(), second = await new GameActor(options(901)).initialize();
  await first.invoke('createCharacter', 'Север', 'warrior');
  await second.invoke('createCharacter', 'Лес', 'mage');
  assert.equal(first.current.player!.gold, 120); assert.equal(second.current.player!.gold, 120);
  await first.invoke('allocateAttribute', 'strength');
  assert.equal(first.current.player!.userId, '900'); assert.equal(second.current.player!.userId, '901');
  await first.invoke('adminAddGold', 1000000);
  assert.equal(first.current.player!.gold, 120, 'admin rights are supplied by the server, never the action payload');
  assert.equal(second.current.player!.classId, 'mage');
  assert.equal(first.publicView().createCharacter, undefined);
  assert.equal('monsterPlan' in first.publicView(), false);
});
test('combat HP, turn, rewards and private decisions survive a new actor instance', async () => {
  let now = Date.now();
  const config = {...options(), now: () => now};
  let actor = await new GameActor(config).initialize();
  await actor.invoke('createCharacter', 'Щит', 'warrior', true);
  assert.equal(actor.current.isInCombat, true);
  for (let turn = 0; turn < 4 && !actor.current.isCombatEnded; turn++) {
    await actor.invoke('performPlayerAction', 'defend'); now += 5000; actor.tick(); now += 5000; actor.tick();
  }
  const before = {hp: actor.current.combatPlayerHp, mp: actor.current.combatPlayerMp, monster: actor.current.activeMonster, phase: actor.current.turnPhase, gold: actor.current.player!.gold};
  actor = await new GameActor({...config, snapshot: actor.snapshot()}).initialize();
  assert.equal(actor.current.combatPlayerHp, before.hp); assert.equal(actor.current.combatPlayerMp, before.mp);
  assert.deepEqual(actor.current.activeMonster, before.monster); assert.equal(actor.current.turnPhase, before.phase);
  for (let turn = 0; turn < 100 && !actor.current.isCombatEnded; turn++) {
    if (actor.current.turnPhase === 'player') await actor.invoke('performPlayerAction', 'attack');
    now += 5000; actor.tick();
  }
  assert.equal(actor.current.combatOutcome, 'victory');
  const gold = actor.current.player!.gold, exp = actor.current.player!.exp, items = actor.current.player!.inventory;
  assert.ok(gold > before.gold);
  for (let reload = 0; reload < 3; reload++) {actor = await new GameActor({...config, snapshot: actor.snapshot()}).initialize(); now += 5000; actor.tick();}
  assert.equal(actor.current.player!.gold, gold); assert.equal(actor.current.player!.exp, exp); assert.deepEqual(actor.current.player!.inventory, items);
});
test('travel uses the same paid handler and resumes once after reload', async () => {
  let now = Date.now(); const config = {...options(), now: () => now};
  let actor = await new GameActor(config).initialize(); await actor.invoke('createCharacter', 'Путь', 'warrior');
  assert.equal((await actor.invoke('returnToSettlement')).success, true);
  const travelId = actor.current.player!.worldJourney!.id;
  actor = await new GameActor({...config, snapshot: actor.snapshot()}).initialize();
  assert.equal(actor.current.player!.worldJourney!.id, travelId);
  now += 10000; actor.tick(); assert.equal(actor.current.player!.worldPlace, 'settlement');
  const energy = actor.current.player!.energy, region = actor.catalog.REGIONS[0];
  await actor.invoke('startTravel', region.id, region.defaultModId);
  assert.equal(actor.current.player!.energy, energy - 5);
  actor = await new GameActor({...config, snapshot: actor.snapshot()}).initialize(); now += 10000; actor.tick();
  assert.equal(actor.current.player!.worldPlace, 'field'); assert.equal(actor.current.player!.energy, energy - 5);
  actor.tick(); assert.equal(actor.current.player!.energy, energy - 5);
});
test('the old Premium browser effect never issues a second actor reward during migration', async () => {
  const actor = await new GameActor(options()).initialize(); await actor.invoke('createCharacter', 'Шахтёр', 'warrior');
  const save = {player: {...actor.current.player!, lastActiveTimestamp: Date.now() - 8 * 3600000}, quests: actor.current.quests, achievements: actor.current.achievements, resetVersion: 0};
  const migrated = await new GameActor({...options(), premium: {...premium, active: true, premiumUntil: new Date(Date.now() + 3600000).toISOString()}, migrationSave: JSON.stringify(save)}).initialize();
  assert.equal(migrated.current.player!.gold, save.player.gold);
  assert.deepEqual(migrated.current.player!.inventory, save.player.inventory);
  assert.equal(migrated.current.offlineReport, null);
  assert.ok((migrated.snapshot().state.pendingOfflineMinutes as number) >= 30);
});
