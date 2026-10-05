import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {sellToResidents} from '../server/localMarket';
import {localBuyoutGold} from '../src/utils/localMarket';
test('resident buyout is cheaper, rounds per item and handles invalid prices',()=>{
 assert.equal(localBuyoutGold(100,3),90);assert.equal(localBuyoutGold(10,2),6);assert.equal(localBuyoutGold(1,1),1);assert.equal(localBuyoutGold(0,5),0);assert.equal(localBuyoutGold(NaN,1),0);
});
test('PostgreSQL buyout consumes selected quantity, uses canonical price, retries once and rejects protected gear and reset epochs',async()=>{
 const db=new PGlite();const query=(sql:string,args:any[]=[])=>db.query<any>(sql,args);const pool:any={connect:async()=>({query,release(){}})};
 const id='11111111-1111-4111-8111-111111111111';const op='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec('CREATE TABLE players(telegram_id bigint primary key,reset_version integer); CREATE TABLE owned_items(id uuid primary key,owner_telegram_id bigint,item_json jsonb,quantity integer,locked boolean,equipped_slot text,bound_clan_id text); CREATE TABLE inventory_bulk_disposals(id uuid primary key,telegram_id bigint,request_json jsonb,result_json jsonb); INSERT INTO players VALUES(7,0),(8,0);');
  await query('INSERT INTO owned_items VALUES($1,7,$2,4,false,null,null)',[id,JSON.stringify({sellPrice:100})]);
  const body={operationId:op,itemId:id,item:{id,sellPrice:99999},quantity:2};
  assert.equal((await sellToResidents(pool,7,0,body)).gold,60);assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
  assert.equal((await sellToResidents(pool,7,0,body)).gold,60);assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
  await assert.rejects(sellToResidents(pool,8,0,body),/повторного/);await assert.rejects(sellToResidents(pool,7,0,{...body,quantity:1}),/повторного/);
  for(const column of ['locked','equipped_slot','bound_clan_id']){
   await query(`UPDATE owned_items SET ${column}=$1`,[column==='locked'?true:'protected']);await assert.rejects(sellToResidents(pool,7,0,{...body,operationId:crypto.randomUUID()}),/недоступен/);await query(`UPDATE owned_items SET ${column}=$1`,[column==='locked'?false:null]);
  }
  await query('UPDATE players SET reset_version=1 WHERE telegram_id=7');await assert.rejects(sellToResidents(pool,7,0,body),/Прогресс/);assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
 } finally {await db.close();}
});
