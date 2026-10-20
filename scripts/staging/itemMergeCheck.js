import {NativePool, GameStore} from '../lib/gameEngine.js';
export default async function () {
  const now = Date.now(), identity = {id: 9761, displayName: 'Synthetic merge'};
  const pool = new NativePool({tables: {}}, () => now); pool.ensurePlayer(identity);
  const store = new GameStore(pool.asPool(), {now: () => now}), sessionToken = crypto.randomUUID();
  let view = await store.acquire(identity, sessionToken, 0, false);
  const op = () => ({sessionToken, operationId: crypto.randomUUID(), expectedVersion: view.version, resetVersion: view.resetVersion, sessionGeneration: view.sessionGeneration});
  view = await store.create(identity, op(), {name: 'Synthetic', classId: 'warrior'});
  pool.table('players')[0].progress_json.player.worldPlace = 'settlement';
  const issue = () => {
    const id = crypto.randomUUID();
    pool.table('owned_items').push({id, owner_telegram_id: identity.id,
      item_json: {templateId: 'synthetic_sword', name: 'Меч', type: 'weapon', rarity: 'rare', level: 5, upgradeLevel: 7, stats: {attack: 100}, sellPrice: 10, disassembleYield: {}, icon: '⚔️'},
      quantity: 1, equipped_slot: null, locked: false, bound_clan_id: null, origin: 'game_command', created_at: new Date(now).toISOString()});
    return id;
  };
  const baseId = issue(), donorId = issue(); view = await store.load(identity, sessionToken);
  const request = op(), command = {type: 'mergeItems', baseId, donorId};
  const first = await store.operation(identity, request, command);
  const repeated = await store.operation(identity, request, command);
  const base = repeated.save.player.inventory.find(i => i.id === baseId);
  const passed = first.operation.result.success && repeated.operation.replayed && base.mergeLevel === 1 && base.upgradeLevel === 7
    && !pool.table('owned_items').some(i => i.id === donorId);
  if (!passed) throw new Error('Synthetic item merging failed.');
  return {passed, mergeLevel: base.mergeLevel, sharpening: base.upgradeLevel, replayed: repeated.operation.replayed, isolated: true};
}
