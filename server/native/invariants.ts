import type {NativeWorld} from './pool';
export class EconomyInvariantError extends Error {constructor(public code: string) {super(code);}}
const validAmount = (value: any) => Number.isSafeInteger(Number(value)) && Number(value) >= 0;
export function validateNativeWorld(world: NativeWorld) {
  const table = (name: string) => world.tables[name] || [];
  const players = new Map(table('players').map(row => [String(row.telegram_id), row]));
  const clans = new Set(table('clans').map(row => row.id));
  const ids = new Set<string>(), slots = new Set<string>();
  for (const row of table('owned_items')) {
    if (!row.id || ids.has(row.id)) throw new EconomyInvariantError('ITEM_ID_COLLISION'); ids.add(row.id);
    if ((row.owner_telegram_id != null) === (row.clan_id != null)) throw new EconomyInvariantError('ITEM_HOLDER_INVALID');
    if (row.owner_telegram_id != null && !players.has(String(row.owner_telegram_id)) || row.clan_id != null && !clans.has(row.clan_id) || row.bound_clan_id != null && !clans.has(row.bound_clan_id)) throw new EconomyInvariantError('ITEM_OWNER_MISSING');
    if (!Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 1 || Number(row.quantity) > 2147483647) throw new EconomyInvariantError('ITEM_QUANTITY_INVALID');
    if (row.equipped_slot != null) {
      const key = String(row.owner_telegram_id) + ':' + row.equipped_slot;
      if (row.owner_telegram_id == null || slots.has(key) || row.item_json?.type !== row.equipped_slot) throw new EconomyInvariantError('EQUIPMENT_SLOT_INVALID'); slots.add(key);
    }
  }
  for (const row of table('players')) {
    if (!validAmount(row.market_gold || 0) || !validAmount(row.progress_version) || !validAmount(row.reset_version) || !validAmount(row.progress_session_generation)) throw new EconomyInvariantError('ACCOUNT_VERSION_OR_BALANCE_INVALID');
    if (row.character_authority === 'server-actions-v1') {
      const save = row.progress_json;
      if (!save?.player || String(save.player.userId) !== String(row.telegram_id) || Number(save.resetVersion) !== Number(row.reset_version)) throw new EconomyInvariantError('CHARACTER_OWNER_INVALID');
      if (!Number.isSafeInteger(save.player.gold) || save.player.gold < 0 || !Number.isSafeInteger(save.player.silver) || save.player.silver < 0) throw new EconomyInvariantError('CHARACTER_WALLET_INVALID');
      if (save.player.inventory.length || Object.values(save.player.equipped || {}).some(Boolean)) throw new EconomyInvariantError('DUPLICATE_INVENTORY_AUTHORITY');
    }
  }
  for (const row of table('clans')) if (![row.treasury_gold, row.treasury_silver, row.treasury_ore].every(validAmount)) throw new EconomyInvariantError('CLAN_BALANCE_INVALID');
}
