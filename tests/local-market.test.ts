import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {sellToResidents} from '../server/localMarket';
import {localBuyoutGold,residentDemand,residentMarketDay,residentUnitGold} from '../src/utils/localMarket';
test('daily demand rotates by Kyiv date, prices useful resources above one and totals exactly',()=>{
 const day='2026-10-13',next='2026-10-14';
 assert.equal(residentMarketDay(new Date('2026-10-13T20:59:59Z')),day);
 assert.equal(residentMarketDay(new Date('2026-10-13T21:00:00Z')),next);
 assert.notDeepEqual(residentDemand(day).categories.map(c=>c.percent),residentDemand(next).categories.map(c=>c.percent));
 for(let i=0;i<5;i++){const date=`2026-10-${13+i}`;for(const type of ['material','ore','potion','weapon']){const item={sellPrice:1,type,level:1,rarity:'common'};assert(residentUnitGold(item,date)>=5);assert.equal(localBuyoutGold(item,999,date),residentUnitGold(item,date)*999);}}
 const item={sellPrice:100,type:'weapon'};assert.equal(localBuyoutGold(item,3,day),residentUnitGold(item,day)*3);
 assert.equal(localBuyoutGold({sellPrice:0},5,day),0);assert.equal(localBuyoutGold({sellPrice:NaN},1,day),0);
 assert.throws(()=>residentDemand('2026-02-30'));
 assert(residentUnitGold({sellPrice:1,type:'ore',rarity:'epic',level:80},day)>residentUnitGold({sellPrice:1,type:'ore',rarity:'common',level:1},day));
});
test('PostgreSQL buyout consumes selected quantity, uses canonical price, retries once and rejects protected gear and reset epochs',async()=>{
 const db=new PGlite();const query=(sql:string,args:any[]=[])=>db.query<any>(sql,args);const pool:any={connect:async()=>({query,release(){}})};
 const now=new Date('2026-10-13T10:00:00Z'),tomorrow=new Date('2026-10-14T10:00:00Z');
 const id='11111111-1111-4111-8111-111111111111';const op='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec('CREATE TABLE players(telegram_id bigint primary key,reset_version integer); CREATE TABLE owned_items(id uuid primary key,owner_telegram_id bigint,item_json jsonb,quantity integer,locked boolean,equipped_slot text,bound_clan_id text); CREATE TABLE inventory_bulk_disposals(id uuid primary key,telegram_id bigint,request_json jsonb,result_json jsonb); INSERT INTO players VALUES(7,0),(8,0);');
  await query('INSERT INTO owned_items VALUES($1,7,$2,4,false,null,null)',[id,JSON.stringify({sellPrice:100})]);
  const body={operationId:op,itemId:id,item:{id,sellPrice:99999},quantity:2,demandDay:'2026-10-13'};
  assert.equal((await sellToResidents(pool,7,0,body,now)).gold,localBuyoutGold({sellPrice:100},2,'2026-10-13'));assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
  assert.equal((await sellToResidents(pool,7,0,body,tomorrow)).gold,localBuyoutGold({sellPrice:100},2,'2026-10-13'));assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
  await assert.rejects(sellToResidents(pool,7,0,{...body,operationId:crypto.randomUUID()},tomorrow),/Спрос/);assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
  await assert.rejects(sellToResidents(pool,8,0,body),/повторного/);await assert.rejects(sellToResidents(pool,7,0,{...body,quantity:1}),/повторного/);
  for(const column of ['locked','equipped_slot','bound_clan_id']){
   await query(`UPDATE owned_items SET ${column}=$1`,[column==='locked'?true:'protected']);await assert.rejects(sellToResidents(pool,7,0,{...body,operationId:crypto.randomUUID()},now),/недоступен/);await query(`UPDATE owned_items SET ${column}=$1`,[column==='locked'?false:null]);
  }
  await query('UPDATE owned_items SET item_json=$1',[JSON.stringify({sellPrice:0})]);await assert.rejects(sellToResidents(pool,7,0,{...body,operationId:crypto.randomUUID()},now),/нельзя продать/);assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
  await query('UPDATE players SET reset_version=1 WHERE telegram_id=7');await assert.rejects(sellToResidents(pool,7,0,body),/Прогресс/);assert.equal((await query('SELECT quantity FROM owned_items')).rows[0].quantity,2);
 } finally {await db.close();}
});
