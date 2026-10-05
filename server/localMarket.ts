import type { Pool } from 'pg';
import { localBuyoutGold } from '../src/utils/localMarket';
export async function sellToResidents(pool: Pool, userId: number, resetVersion: number, body: any) {
  const { operationId, item, itemId, quantity } = body || {};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId || '') ||
      !item || typeof item.id !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Проверьте предмет и количество.');
  const request = { action: 'residents', itemId: itemId || item.id, quantity, resetVersion };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const player = (await client.query('SELECT reset_version FROM players WHERE telegram_id=$1 FOR UPDATE', [userId])).rows[0];
    if (!player || Number(player.reset_version) !== resetVersion) throw new Error('Прогресс изменился. Перезапустите игру.');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operationId]);
    const old = (await client.query('SELECT * FROM inventory_bulk_disposals WHERE id=$1', [operationId])).rows[0];
    if (old) {
      if (String(old.telegram_id) !== String(userId) || Object.entries(request).some(([k,v]) => old.request_json[k] !== v)) throw new Error('Параметры повторного запроса не совпадают.');
      await client.query('COMMIT'); return old.result_json;
    }
    let current = item;
    if (itemId) {
      const row = (await client.query('SELECT * FROM owned_items WHERE id=$1 AND owner_telegram_id=$2 FOR UPDATE', [itemId,userId])).rows[0];
      if (!row || row.locked || row.equipped_slot || row.bound_clan_id || Number(row.quantity) < quantity) throw new Error('Предмет недоступен для продажи.');
      current = row.item_json;
      if (Number(row.quantity) === quantity) await client.query('DELETE FROM owned_items WHERE id=$1', [itemId]);
      else await client.query('UPDATE owned_items SET quantity=quantity-$1 WHERE id=$2', [quantity,itemId]);
    } else if (item.serverOwned || item.isEquipped || item.isLocked || item.boundToClan || quantity > (item.stackCount || 1)) throw new Error('Предмет недоступен для продажи.');
    const result = { gold: localBuyoutGold(current.sellPrice, quantity), quantity, operationId };
    await client.query('INSERT INTO inventory_bulk_disposals (id,telegram_id,request_json,result_json) VALUES ($1,$2,$3::jsonb,$4::jsonb)', [operationId,userId,JSON.stringify(request),JSON.stringify(result)]);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
