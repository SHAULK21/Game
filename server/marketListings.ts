import {MAX_TRADE_QUANTITY} from '../src/utils/stackRules';
import type { Pool, PoolClient } from 'pg';
import { calculateMarketSale } from '../src/utils/marketEconomy';
import { queueNotification } from './socialFeatures';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const checkVersion = (player: any, version: number) => {
  if (!player || !Number.isSafeInteger(version) || Number(player.reset_version) !== version) throw new Error('Прогресс изменился. Перезапустите игру.');
};
async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await run(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function createMarketListing(pool: Pool, userId: number, body: any, resetVersion = 0) {
  const { quantity, price_gold: price, operationId, itemId } = body || {};
  if (!uuid(operationId) || !uuid(itemId)) throw new Error('На рынок можно выставлять только предметы из серверного реестра.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TRADE_QUANTITY) throw new Error('Количество: 1–999.');
  if (!Number.isInteger(price) || price < 1 || price > 100000000) throw new Error('Цена: 1–100000000 золота.');
  const request = { itemId, quantity, price, resetVersion };
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operationId]);
    const player = (await client.query('SELECT reset_version FROM players WHERE telegram_id=$1 FOR UPDATE', [userId])).rows[0];
    checkVersion(player, resetVersion);
    const cached = (await client.query('SELECT * FROM market_listing_requests WHERE id=$1', [operationId])).rows[0];
    if (cached) {
      if (String(cached.telegram_id) !== String(userId) || Object.entries(request).some(([k,v]) => cached.request_json[k] !== v)) throw new Error('Параметры повторного запроса не совпадают.');
      return (await client.query('SELECT * FROM market_listings WHERE id=$1', [cached.listing_id])).rows[0];
    }
    const row = (await client.query('SELECT * FROM owned_items WHERE id=$1 AND owner_telegram_id=$2 FOR UPDATE', [itemId,userId])).rows[0];
    if (!row || row.origin === 'legacy_market_return' || row.locked || row.equipped_slot || row.bound_clan_id || Number(row.quantity) < quantity) throw new Error('Предмет недоступен для продажи.');
    const safeItem = { ...row.item_json };
    for (const key of ['id','serverOwned','stackCount','isEquipped','isLocked','boundToClan']) delete safeItem[key];
    if (Number(row.quantity) === quantity) await client.query('DELETE FROM owned_items WHERE id=$1', [row.id]);
    else await client.query('UPDATE owned_items SET quantity=quantity-$1 WHERE id=$2', [quantity,row.id]);
    const listing = (await client.query(`INSERT INTO market_listings (seller_telegram_id,item_json,quantity,price_gold,verified,seller_reset_version)
      VALUES ($1,$2::jsonb,$3,$4,true,$5) RETURNING *`, [userId,JSON.stringify(safeItem),quantity,price,resetVersion])).rows[0];
    await client.query('INSERT INTO market_listing_requests (id,telegram_id,request_json,listing_id) VALUES ($1,$2,$3::jsonb,$4)', [operationId,userId,JSON.stringify(request),listing.id]);
    return listing;
  });
}

export async function buyMarketListing(pool: Pool, buyerId: number, listingId: string, body: any, resetVersion = 0) {
  const { operationId } = body || {};
  if (!uuid(operationId) || !uuid(listingId)) throw new Error('Неверный ID покупки.');
  return transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operationId]);
    // Lock account rows before listing rows; reset and return use the same order.
    const hint = (await client.query('SELECT seller_telegram_id FROM market_listings WHERE id=$1', [listingId])).rows[0];
    if (!hint) throw new Error('Лот не найден.');
    const sellerId = Number(hint.seller_telegram_id);
    if (sellerId === buyerId) throw new Error('Нельзя купить собственный лот.');
    const players = (await client.query('SELECT telegram_id,reset_version,market_gold,premium_until > NOW() AS is_premium FROM players WHERE telegram_id IN ($1,$2) ORDER BY telegram_id FOR UPDATE', [buyerId,sellerId])).rows;
    const buyer = players.find(p => Number(p.telegram_id) === buyerId);
    const seller = players.find(p => Number(p.telegram_id) === sellerId);
    checkVersion(buyer, resetVersion);
    const cached = (await client.query('SELECT * FROM market_purchase_requests WHERE id=$1', [operationId])).rows[0];
    if (cached) {
      if (Number(cached.telegram_id) !== buyerId || cached.listing_id !== listingId || Number(cached.reset_version) !== resetVersion) throw new Error('Параметры повторного запроса не совпадают.');
      return cached.result_json;
    }
    const listing = (await client.query('SELECT *, expires_at > NOW() AS unexpired FROM market_listings WHERE id=$1 FOR UPDATE', [listingId])).rows[0];
    if (!listing?.verified || listing.status !== 'active' || !listing.unexpired || Number(listing.seller_reset_version) !== Number(seller?.reset_version)) throw new Error('Лот уже продан, снят или не подтверждён сервером.');
    const price = Number(listing.price_gold);
    if (Number(buyer.market_gold) < price) throw new Error('Недостаточно золота в кошельке рынка.');
    const sale = calculateMarketSale(price, Boolean(seller.is_premium));
    const item = (await client.query(`INSERT INTO owned_items (owner_telegram_id,item_json,quantity,origin) VALUES ($1,$2::jsonb,$3,'market_purchase') RETURNING id`, [buyerId,JSON.stringify(listing.item_json),listing.quantity])).rows[0];
    await client.query('UPDATE players SET market_gold=market_gold-$2 WHERE telegram_id=$1', [buyerId,price]);
    await client.query('UPDATE players SET market_gold=market_gold+$2 WHERE telegram_id=$1', [sellerId,sale.sellerGold]);
    await client.query(`UPDATE market_listings SET status='sold',buyer_telegram_id=$2,purchased_item_id=$3,sale_tax_gold=$4,seller_net_gold=$5,sold_at=NOW() WHERE id=$1`, [listingId,buyerId,item.id,sale.taxGold,sale.sellerGold]);
    const result = { ok:true, operationId, listingId, itemId:item.id, priceGold:price, quantity:Number(listing.quantity), ...sale };
    await client.query('INSERT INTO market_purchase_requests (id,telegram_id,listing_id,reset_version,result_json) VALUES ($1,$2,$3,$4,$5::jsonb)', [operationId,buyerId,listingId,resetVersion,JSON.stringify(result)]);
    await queueNotification(client,sellerId,'market_'+listingId,'market',`На рынке купили ${listing.item_json.name} ×${listing.quantity}. В кошелёк рынка поступило ${sale.sellerGold} золота.`);
    return result;
  });
}

/** Listing status and the issued item ID form a durable, idempotent return receipt. */
export async function returnMarketListing(pool: Pool, userId: number, listingId: string, resetVersion: number, expiredOnly = false) {
  if (!uuid(listingId)) throw new Error('Неверный ID лота.');
  return transaction(pool, async client => {
    const player = (await client.query('SELECT reset_version FROM players WHERE telegram_id=$1 FOR UPDATE', [userId])).rows[0];
    checkVersion(player, resetVersion);
    const listing = (await client.query('SELECT *, expires_at <= NOW() AS expired FROM market_listings WHERE id=$1 AND seller_telegram_id=$2 FOR UPDATE', [listingId,userId])).rows[0];
    if (!listing) throw new Error('Лот не найден.');
    if (listing.returned_item_id) return { ok:true, itemId:listing.returned_item_id };
    if (listing.status !== 'active' || expiredOnly && !listing.expired || listing.verified && Number(listing.seller_reset_version) !== resetVersion) throw new Error('Лот недоступен для возврата.');
    // Old client-authored lots are recoverable, but never gain trading provenance.
    const item = (await client.query('INSERT INTO owned_items (owner_telegram_id,item_json,quantity,origin) VALUES ($1,$2::jsonb,$3,$4) RETURNING id', [userId,JSON.stringify(listing.item_json),listing.quantity,listing.verified?'market_return':'legacy_market_return'])).rows[0];
    await client.query("UPDATE market_listings SET status='cancelled',returned_item_id=$2 WHERE id=$1", [listingId,item.id]);
    return { ok:true, itemId:item.id };
  });
}
export async function returnExpiredMarketListings(pool: Pool, userId: number) {
  const player = (await pool.query('SELECT reset_version FROM players WHERE telegram_id=$1', [userId])).rows[0];
  if (!player) return;
  const listings = (await pool.query("SELECT id FROM market_listings WHERE seller_telegram_id=$1 AND status='active' AND expires_at <= NOW() ORDER BY created_at", [userId])).rows;
  for (const listing of listings) {
    try { await returnMarketListing(pool,userId,listing.id,Number(player.reset_version),true); }
    catch(error) { if (!(error instanceof Error) || !/Лот недоступен|Прогресс изменился/.test(error.message)) throw error; }
  }
}
