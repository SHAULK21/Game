import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {NativePool} from '../server/native/pool';
import {GameStore} from '../server/gameStore';

test('native merging commits ownership and receipt once, survives reload and ignores forged client stats', async () => {
  const now = 1792272000000, identity = {id: 9761, displayName: 'Merge'}, sessionToken = crypto.randomUUID();
  const pool = new NativePool({tables:{}}, () => now); pool.ensurePlayer(identity);
  const store = new GameStore(pool.asPool(), {now: () => now});
  let view = await store.acquire(identity, sessionToken, 0, false);
  const op = () => ({sessionToken, operationId:crypto.randomUUID(), expectedVersion:view.version, resetVersion:view.resetVersion, sessionGeneration:view.sessionGeneration});
  view = await store.create(identity, op(), {name:'Кузнец', classId:'warrior'});
  pool.table('players')[0].progress_json.player.worldPlace = 'settlement';
  const issue = (owner: number, equipped: string | null = null) => {
    const row = {id:crypto.randomUUID(), owner_telegram_id:owner, item_json:{templateId:'sword', name:'Меч', type:'weapon', rarity:'rare', level:5, upgradeLevel:7, stats:{attack:100}, sellPrice:10, disassembleYield:{}, icon:'⚔️'}, quantity:1, origin:'game_command', equipped_slot:equipped, locked:false, bound_clan_id:null, created_at:new Date(now).toISOString()};
    pool.table('owned_items').push(row); return row.id;
  };
  const baseId = issue(identity.id), donorId = issue(identity.id), foreignId = issue(9762);
  view = await store.load(identity, sessionToken);
  const request = op(), command = {type:'mergeItems', baseId, donorId, item:{mergeLevel:10, stats:{attack:999999}}, chance:1};
  const merged = await store.operation(identity, request, command);
  assert.equal((merged.operation.result as any).success, true);
  const base = merged.save!.player.inventory.find(i => i.id === baseId)!;
  assert.equal(base.mergeLevel, 1); assert.equal(base.upgradeLevel, 7); assert.equal(base.stats.attack, 100);
  assert.equal(pool.table('owned_items').some(i => i.id === donorId), false);
  const repeat = await store.operation(identity, request, command);
  assert.equal(repeat.operation.replayed, true); assert.equal(repeat.save!.player.inventory.find(i=>i.id===baseId)!.mergeLevel, 1);
  view = await store.load(identity, sessionToken);
  assert.equal(view.save!.player.inventory.find(i=>i.id===baseId)!.mergeLevel, 1);
  const count = pool.table('owned_items').length;
  const denied = await store.operation(identity, op(), {type:'mergeItems', baseId, donorId:foreignId});
  assert.equal(denied.operation.outcome, 'rejected'); assert.equal(pool.table('owned_items').length, count);
  view = denied;
  const absent = await store.operation(identity, op(), {type:'mergeItems', baseId, donorId});
  assert.equal(absent.operation.outcome, 'rejected'); assert.equal(pool.table('owned_items').length, count);
  // Exercise an equipped main item and an actual failed, durable attempt.
  const baseRow = pool.table('owned_items').find(i => i.id === baseId)!;
  for (const row of pool.table('owned_items')) if (row.owner_telegram_id == identity.id) row.equipped_slot = null;
  baseRow.item_json.mergeLevel = 9; baseRow.equipped_slot = 'weapon';
  const nextDonor = issue(identity.id);
  view = await store.load(identity, sessionToken);
  const failureRequest = op(), failureCommand = {type:'mergeItems', baseId, donorId:nextDonor};
  const random = Math.random;
  let failed;
  try {Math.random = () => 0.99; failed = await store.operation(identity, failureRequest, failureCommand);}
  finally {Math.random = random;}
  assert.equal((failed.operation.result as any).success, false);
  assert.equal(failed.save!.player.equipped.weapon!.mergeLevel, 9);
  assert.equal(failed.save!.player.equipped.weapon!.upgradeLevel, 7);
  assert.equal(pool.table('owned_items').some(i => i.id === nextDonor), false);
  const replayFailure = await store.operation(identity, failureRequest, failureCommand);
  assert.equal(replayFailure.operation.replayed, true);
  assert.equal(replayFailure.save!.player.equipped.weapon!.mergeLevel, 9);
});
