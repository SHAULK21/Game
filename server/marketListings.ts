import type {Pool} from 'pg';
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function createMarketListing(pool:Pool,userId:number,body:any) {
 const {item,quantity,price_gold:price,operationId,itemId}=body||{};
 if(!uuid(operationId)||!item||typeof item!=='object'||Array.isArray(item))throw new Error('Предмет и ID операции обязательны.');
 if(!Number.isInteger(quantity)||quantity<1||quantity>999)throw new Error('Количество: 1–999.');
 if(!Number.isInteger(price)||price<1||price>100000000)throw new Error('Цена: 1–100000000 золота.');
 if(itemId&&!uuid(itemId))throw new Error('Неверный серверный ID предмета.');
 if(item.isEquipped||item.isLocked||item.boundToClan)throw new Error('Надетую, запертую или клановую вещь нельзя продать.');
 const request={itemId:itemId||item.id,quantity,price};
 if(typeof request.itemId!=='string'||request.itemId.length>200)throw new Error('Неверный ID предмета.');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[operationId]);
  const cached=(await client.query('SELECT * FROM market_listing_requests WHERE id=$1',[operationId])).rows[0];
  if(cached){
   if(String(cached.telegram_id)!==String(userId)||cached.request_json.itemId!==request.itemId||cached.request_json.quantity!==quantity||cached.request_json.price!==price)throw new Error('Параметры повторного запроса не совпадают.');
   const existing=await client.query('SELECT * FROM market_listings WHERE id=$1',[cached.listing_id]);
   await client.query('COMMIT');return existing.rows[0];
  }
  let safeItem={...item};
  for(const key of ['id','serverOwned','stackCount','isEquipped','isLocked','boundToClan'])delete safeItem[key];
  if(itemId){
   const row=(await client.query('SELECT * FROM owned_items WHERE id=$1 AND owner_telegram_id=$2 FOR UPDATE',[itemId,userId])).rows[0];
   if(!row||row.locked||row.equipped_slot||row.bound_clan_id||row.quantity<quantity)throw new Error('Предмет недоступен для продажи.');
   safeItem=row.item_json;
   if(row.quantity===quantity)await client.query('DELETE FROM owned_items WHERE id=$1',[row.id]);
   else await client.query('UPDATE owned_items SET quantity=quantity-$1 WHERE id=$2',[quantity,row.id]);
  }else if(item.serverOwned)throw new Error('Укажите серверный ID предмета.');
  const result=await client.query(`INSERT INTO market_listings (seller_telegram_id,item_json,quantity,price_gold) VALUES ($1,$2::jsonb,$3,$4) RETURNING id,item_json,quantity,price_gold,created_at`,[userId,JSON.stringify(safeItem),quantity,price]);
  await client.query('INSERT INTO market_listing_requests (id,telegram_id,request_json,listing_id) VALUES ($1,$2,$3::jsonb,$4)',[operationId,userId,JSON.stringify(request),result.rows[0].id]);
  await client.query('COMMIT');return result.rows[0];
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
