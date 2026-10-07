import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createMarketListing,buyMarketListing,returnMarketListing,returnExpiredMarketListings} from '../server/marketListings';
import {gameSaveKey,readAccountSave,applyAccountReset} from '../src/utils/accountReset';

test('PostgreSQL market owns items, debits authoritative funds and persists replayable purchases and returns',async()=>{
 const db=new PGlite();const query=(sql:string,args:any[]=[])=>db.query<any>(sql,args);
 const pool:any={query,connect:async()=>({query,release(){}})};
 const item={templateId:'iron',name:'Железная руда',type:'ore',rarity:'rare',level:1,stats:{},sellPrice:2};
 const op=()=>crypto.randomUUID();
 const issue=async(owner=1)=> (await query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES($1,$2::jsonb,3,'clan_raid') RETURNING id",[owner,JSON.stringify(item)])).rows[0].id;
 const offer=async(price=60)=>createMarketListing(pool,1,{operationId:op(),itemId:await issue(),quantity:2,price_gold:price,item:{attack:999999}});
 try {
  const schema=(await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;','');
  await db.exec(schema);await db.exec(schema);
  await query('INSERT INTO players(telegram_id) VALUES(1),(2),(3)');
  await query('UPDATE players SET market_gold=100 WHERE telegram_id=2');
  await assert.rejects(createMarketListing(pool,1,{operationId:op(),item:{id:'fake',stats:{attack:999999}},quantity:999,price_gold:1}),/серверного реестра/);
  const foreign=await issue(3);
  await assert.rejects(createMarketListing(pool,1,{operationId:op(),itemId:foreign,quantity:1,price_gold:1}),/недоступен/);
  const listing=await offer();assert.deepEqual(listing.item_json,item);
  const second=await offer();const operationId=op();
  const receipt=await buyMarketListing(pool,2,listing.id,{operationId});
  assert.deepEqual(await buyMarketListing(pool,2,listing.id,{operationId}),receipt,'lost response retry has exactly the same durable receipt');
  assert.equal((await query('SELECT market_gold FROM players WHERE telegram_id=2')).rows[0].market_gold,40);
  const bought=(await query('SELECT * FROM owned_items WHERE id=$1',[receipt.itemId])).rows[0];
  assert.equal(Number(bought.owner_telegram_id),2);assert.equal(bought.quantity,2);assert.deepEqual(bought.item_json,item);
  assert.equal((await query('SELECT buyer_telegram_id FROM market_listings WHERE id=$1',[listing.id])).rows[0].buyer_telegram_id,2);
  await assert.rejects(buyMarketListing(pool,3,listing.id,{operationId}),/повторного/);
  await assert.rejects(buyMarketListing(pool,2,second.id,{operationId:op(),gold:999999999}),/Недостаточно/);
  assert.equal((await query('SELECT status FROM market_listings WHERE id=$1',[second.id])).rows[0].status,'active');
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM market_purchase_requests')).rows[0].n,1);
  assert.equal(Number((await query('SELECT market_gold FROM players WHERE telegram_id=1')).rows[0].market_gold),178);
  // Fail after debit and delivery; the entire SQL transaction must roll back.
  await db.exec("CREATE FUNCTION fail_purchase() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt failed'; END $$; CREATE TRIGGER fail_receipt BEFORE INSERT ON market_purchase_requests FOR EACH ROW EXECUTE FUNCTION fail_purchase();");
  await assert.rejects(buyMarketListing(pool,3,second.id,{operationId:op()}),/receipt failed/);
  assert.equal(Number((await query('SELECT market_gold FROM players WHERE telegram_id=3')).rows[0].market_gold),120);
  assert.equal((await query("SELECT COUNT(*)::int AS n FROM owned_items WHERE owner_telegram_id=3 AND origin='market_purchase'")).rows[0].n,0);
  assert.equal((await query('SELECT status FROM market_listings WHERE id=$1',[second.id])).rows[0].status,'active');
  await db.exec('DROP TRIGGER fail_receipt ON market_purchase_requests');
  const returned=await returnMarketListing(pool,1,second.id,0);
  assert.deepEqual(await returnMarketListing(pool,1,second.id,0),returned);
  assert.equal((await query('SELECT quantity FROM owned_items WHERE id=$1',[returned.itemId])).rows[0].quantity,2);
  const expired=await offer();await query("UPDATE market_listings SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[expired.id]);
  await returnExpiredMarketListings(pool,1);await returnExpiredMarketListings(pool,1);
  const expiredItem=(await query('SELECT returned_item_id FROM market_listings WHERE id=$1',[expired.id])).rows[0].returned_item_id;
  assert.equal((await query('SELECT quantity FROM owned_items WHERE id=$1',[expiredItem])).rows[0].quantity,2);
  const legacy=(await query('INSERT INTO market_listings(seller_telegram_id,item_json,quantity,price_gold) VALUES(1,$1::jsonb,1,1) RETURNING id',[JSON.stringify(item)])).rows[0].id;
  await assert.rejects(buyMarketListing(pool,2,legacy,{operationId:op()}),/не подтверждён/);
  const recovered=await returnMarketListing(pool,1,legacy,0);
  assert.equal((await query('SELECT origin FROM owned_items WHERE id=$1',[recovered.itemId])).rows[0].origin,'legacy_market_return');
  await assert.rejects(createMarketListing(pool,1,{operationId:op(),itemId:recovered.itemId,quantity:1,price_gold:1}),/недоступен/);
  await query('UPDATE players SET reset_version=1 WHERE telegram_id=2');
  await assert.rejects(buyMarketListing(pool,2,listing.id,{operationId}),/Прогресс изменился/);
 } finally {await db.close();}
});

test('account saves migrate only for their owner and account reset never removes another account',()=>{
 const entries=new Map<string,string>();const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>entries.set(k,v),removeItem:(k:string)=>entries.delete(k)}});
 try {
  const legacy='aethelgard_save_v1_data';const first=JSON.stringify({player:{userId:1,name:'Первый'}});
  entries.set(legacy,first);assert.equal(readAccountSave(2),null);assert.equal(entries.get(legacy),first);
  assert.equal(readAccountSave(1),first);assert.equal(entries.get(gameSaveKey(1)),first);assert.equal(entries.has(legacy),false);
  const second=JSON.stringify({player:{userId:2,name:'Второй'}});entries.set(gameSaveKey(2),second);
  assert.equal(readAccountSave(2),second);assert.equal(readAccountSave(1),first);
  entries.set(legacy,first);assert.equal(applyAccountReset(2,1),true);
  assert.equal(entries.get(legacy),first);assert.equal(entries.get(gameSaveKey(1)),first);assert.equal(entries.has(gameSaveKey(2)),false);
  entries.set(gameSaveKey(2),JSON.stringify({player:{userId:1}}));assert.equal(readAccountSave(2),null);
  entries.set(gameSaveKey(2),JSON.stringify({resetVersion:3,player:{userId:1}}));assert.equal(applyAccountReset(2,3),true,'another account cannot acknowledge a reset');
 } finally {if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete (globalThis as any).localStorage;}
});
