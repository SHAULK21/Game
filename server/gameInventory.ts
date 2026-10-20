import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import type {GameItem, ItemType, PlayerCharacter} from '../src/types/game';
import {GameActor} from './gameActor';
import {MAX_STACK_COUNT} from '../src/utils/stackRules';

const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const MAX_RESOURCE_STACK = MAX_STACK_COUNT;
export function canonicalItemJson(item: GameItem) {
  const {id, serverOwned, marketTradable, stackCount, isEquipped, isLocked, boundToClan, ...definition} = item;
  return definition;
}
export async function loadGameInventory(client: Pick<PoolClient, 'query'>, owner: number) {
  const rows = (await client.query('SELECT * FROM owned_items WHERE owner_telegram_id=$1 ORDER BY created_at,id FOR UPDATE', [owner])).rows;
  const inventory: GameItem[] = [], equipped: PlayerCharacter['equipped'] = {};
  for (const row of rows) {
    const item: GameItem = {...row.item_json, id: row.id, stackCount: Number(row.quantity), isLocked: row.locked, isEquipped: !!row.equipped_slot, boundToClan: row.bound_clan_id || undefined,
      // The rules run inside the transaction; no internal HTTP round-trip is
      // needed for equip, consumption or locking. Public projection restores true.
      serverOwned: false, marketTradable: !['legacy_market_return', 'legacy_character'].includes(row.origin)};
    if (row.equipped_slot) equipped[row.equipped_slot as ItemType] = item;
    else inventory.push(item);
  }
  return {inventory, equipped, rows};
}
/** Reconcile only trusted actor output. Incoming HTTP item objects never reach
 * this function. IDs and quantities remain unique in the SQL ownership ledger. */
export async function persistGameInventory(client: PoolClient, owner: number, actor: GameActor, origin: 'game_command' | 'legacy_character' = 'game_command', baseline?: any[]) {
  const player = actor.current.player;
  if (!player) throw new Error('Cannot persist an absent character.');
  const previous = (await client.query('SELECT * FROM owned_items WHERE owner_telegram_id=$1 FOR UPDATE', [owner])).rows;
  const initial = baseline ?? previous;
  const signature = (row: any) => JSON.stringify([row.item_json, Number(row.quantity), row.equipped_slot, row.locked, row.bound_clan_id]);
  for (const row of initial) {
    const current = previous.find(item => item.id === row.id);
    if (!current || signature(current) !== signature(row)) throw new Error('Inventory changed during the game action.');
  }
  await client.query('INSERT INTO game_ledger_ids(telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING', [owner]);
  const items = [...player.inventory.map(item => ({item, slot: null as string | null})), ...Object.entries(player.equipped).filter((entry): entry is [string, GameItem] => !!entry[1]).map(([slot, item]) => ({item, slot}))];
  const ids = new Set<string>(), sourceIds = new Set<string>(), remap = new Map<string, string>();
  // Free unique equipped-slot indexes before exchanging two actual items.
  await client.query('UPDATE owned_items SET equipped_slot=NULL WHERE owner_telegram_id=$1 AND equipped_slot IS NOT NULL', [owner]);
  for (const {item, slot} of items) {
    if (!item.id || sourceIds.has(item.id)) throw new Error('Game rules produced duplicate item identity.');
    sourceIds.add(item.id);
    const sourceId = item.id;
    const quantity = item.stackCount ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_RESOURCE_STACK || slot && slot !== item.type) throw new Error('Game rules produced an invalid inventory state.');
    const old = previous.find(row => row.id === sourceId);
    if (!old && uuid(sourceId)) {
      const known = (await client.query('SELECT 1 FROM game_ledger_ids WHERE telegram_id=$1 AND item_id=$2', [owner, sourceId])).rows[0];
      if (known) throw new Error('A moved or consumed ledger item cannot be minted again.');
    }
    if (old) {
      await client.query('UPDATE owned_items SET item_json=$2::jsonb,quantity=$3,equipped_slot=$4,locked=$5,updated_at=NOW() WHERE id=$1 AND owner_telegram_id=$6', [old.id, JSON.stringify(canonicalItemJson(item)), quantity, slot, !!item.isLocked, owner]);
      ids.add(old.id);
    } else {
      const id = crypto.randomUUID(); remap.set(sourceId, id); ids.add(id);
      await client.query('INSERT INTO owned_items(id,owner_telegram_id,item_json,quantity,equipped_slot,locked,origin,character_id) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8)', [id, owner, JSON.stringify(canonicalItemJson(item)), quantity, slot, !!item.isLocked, item.marketTradable === false ? 'legacy_character' : origin, player.id]);
    }
  }
  for (const old of initial) if (!ids.has(old.id)) await client.query('DELETE FROM owned_items WHERE id=$1 AND owner_telegram_id=$2', [old.id, owner]);
  await client.query('INSERT INTO game_ledger_ids(telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING', [owner]);
  actor.remapItemIds(remap);
}
export function publicPlayer(player: PlayerCharacter) {
  const project = (item: GameItem): GameItem => ({...item, serverOwned: true});
  return {...player, inventory: player.inventory.map(project), equipped: Object.fromEntries(Object.entries(player.equipped).filter(([, item]) => item).map(([slot, item]) => [slot, project(item!)]))};
}
