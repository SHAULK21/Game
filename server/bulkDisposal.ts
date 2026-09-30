import type { Pool } from 'pg';
import { BULK_EQUIPMENT_TYPES, BULK_RARITIES, bulkReward, matchesBulkItem } from '../src/utils/bulkInventory';
import type { BulkAction, BulkFilters, BulkReceipt } from '../src/utils/bulkInventory';
import type { GameItem } from '../src/types/game';

export class BulkDisposalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function disposeBulkItems(pool: Pool, userId: number, body: any): Promise<BulkReceipt> {
  const { operationId, action, filters } = body || {};
  if (typeof operationId !== 'string' || !UUID.test(operationId) || !['sell','disassemble'].includes(action) ||
      !Array.isArray(body.itemIds) || body.itemIds.length > 500 || body.itemIds.some((id:unknown) => typeof id !== 'string' || !UUID.test(id)) ||
      !filters || !Array.isArray(filters.rarities) || !filters.rarities.length || filters.rarities.length > 8 ||
      filters.rarities.some((rarity:any) => !BULK_RARITIES.includes(rarity)) ||
      !['all', ...BULK_EQUIPMENT_TYPES].includes(filters.type) || typeof filters.keepUpgraded !== 'boolean') {
    throw new BulkDisposalError(400, 'Неверные параметры массовой обработки.');
  }
  const itemIds = [...new Set(body.itemIds as string[])].sort();
  const rules: BulkFilters = {type:filters.type,rarities:[...new Set(filters.rarities)].sort() as BulkFilters['rarities'],keepUpgraded:filters.keepUpgraded};
  const request = JSON.stringify({action,itemIds,filters:rules});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize retries of the same operation; a lost response never consumes twice.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [operationId]);
    const cached = await client.query('SELECT telegram_id, request_json, result_json FROM inventory_bulk_disposals WHERE id = $1', [operationId]);
    if (cached.rows[0]) {
      const previous = cached.rows[0];
      const normalized = previous.request_json;
      const previousRequest = JSON.stringify({action:normalized.action,itemIds:normalized.itemIds,filters:{type:normalized.filters.type,rarities:normalized.filters.rarities,keepUpgraded:normalized.filters.keepUpgraded}});
      if (String(previous.telegram_id) !== String(userId) || previousRequest !== request)
        throw new BulkDisposalError(409, 'Параметры повторного запроса не совпадают.');
      await client.query('COMMIT');
      return previous.result_json;
    }
    const premium = await client.query('SELECT (premium_until > NOW()) AS active FROM players WHERE telegram_id = $1', [userId]);
    if (!premium.rows[0]?.active) throw new BulkDisposalError(403, 'Массовая обработка доступна только с активным Premium.');
    const found = await client.query('SELECT * FROM owned_items WHERE id = ANY($1::uuid[]) AND owner_telegram_id = $2 ORDER BY id FOR UPDATE', [itemIds,userId]);
    if (found.rows.length !== itemIds.length) throw new BulkDisposalError(409, 'Состав инвентаря изменился. Обновите его и повторите.');
    const items: GameItem[] = found.rows.map(row => ({...row.item_json,id:row.id,stackCount:Number(row.quantity),isLocked:row.locked,isEquipped:Boolean(row.equipped_slot),boundToClan:row.bound_clan_id || undefined}));
    if (items.some(item => !matchesBulkItem(item, rules))) throw new BulkDisposalError(409, 'Выбранные предметы изменились или защищены от обработки.');
    const result: BulkReceipt = {...bulkReward(items,action as BulkAction),operationId,itemIds};
    await client.query('DELETE FROM owned_items WHERE id = ANY($1::uuid[]) AND owner_telegram_id = $2', [itemIds,userId]);
    await client.query('INSERT INTO inventory_bulk_disposals (id, telegram_id, request_json, result_json) VALUES ($1,$2,$3::jsonb,$4::jsonb)',[operationId,userId,request,JSON.stringify(result)]);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
