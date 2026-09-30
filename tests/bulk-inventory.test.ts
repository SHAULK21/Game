import test from 'node:test';
import assert from 'node:assert/strict';
import {selectBulkItems,bulkReward,applyBulkDisposal,type BulkFilters,type PendingBulkDisposal} from '../src/utils/bulkInventory';
import {disposeBulkItems} from '../server/bulkDisposal';
import type {GameItem,PlayerCharacter} from '../src/types/game';
import type {Pool} from 'pg';
const filters:BulkFilters={rarities:['common','uncommon','rare'],type:'all',keepUpgraded:true};
const item=(id:string,changes:Partial<GameItem>={}):GameItem=>({id,templateId:'gear',name:'Рукавицы',type:'gloves',rarity:'common',level:1,upgradeLevel:0,icon:'',stats:{},sellPrice:10,disassembleYield:{silver:4,ore:2},...changes});
const player=(inventory:GameItem[]):PlayerCharacter=>({inventory,equipped:{},gold:100,silver:20,maxInventorySlots:1} as PlayerCharacter);
const operation=(localIds:string[],action:'sell'|'disassemble'='disassemble'):PendingBulkDisposal=>({operationId:'11111111-1111-4111-8111-111111111111',action,filters,localIds,serverIds:[]});
test('rarity and equipment type intersect; protected and resource items never enter',()=>{
 const p=player([item('a'),item('b',{rarity:'rare',type:'pants'}),item('c',{isLocked:true}),item('d',{isEquipped:true}),item('e',{boundToClan:'clan'}),item('f',{upgradeLevel:1}),item('g',{rarity:'legendary'}),item('h',{type:'potion'}),item('i',{type:'material'}),item('j',{type:'ore'}),item('k')]);
 p.equipped.gloves=item('k');
 assert.deepEqual(selectBulkItems(p,filters).map(i=>i.id),['a','b']);
 assert.deepEqual(selectBulkItems(p,{...filters,type:'pants'}).map(i=>i.id),['b']);
 assert.deepEqual(selectBulkItems(p,{...filters,rarities:[]}),[]);
 assert.ok(selectBulkItems(p,{...filters,keepUpgraded:false}).some(i=>i.id==='f'));
});
test('quantities multiply rewards; zero prices and invalid yields do not produce phantom currency',()=>{
 assert.deepEqual(bulkReward([item('a',{stackCount:3})],'sell'),{count:3,gold:30,silver:0,ore:0});
 assert.deepEqual(bulkReward([item('a',{stackCount:3})],'disassemble'),{count:3,gold:0,silver:12,ore:6});
 assert.equal(bulkReward([item('zero',{sellPrice:0})],'sell').gold,0);
 assert.equal(bulkReward([item('bad',{sellPrice:NaN,disassembleYield:{silver:Infinity,ore:-5}})],'disassemble').silver,0);
});
test('one state update removes precisely confirmed IDs, preserves new/locked items and credits all resources',()=>{
 const p=player([item('a'),item('new'),item('locked',{isLocked:true})]);
 const op=operation(['a','locked']);
 const receipt={operationId:op.operationId,itemIds:[],gold:0,silver:0,ore:0,count:0};
 const next=applyBulkDisposal(p,op,receipt);
 assert.equal(next.silver,24);assert.equal(next.gold,100);
 assert.ok(next.inventory.some(i=>i.id==='new'));assert.ok(next.inventory.some(i=>i.id==='locked'));
 assert.equal(next.inventory.find(i=>i.type==='ore')!.stackCount,2,'ore is retained even when legacy inventory exceeds its slot cap');
 assert.equal(applyBulkDisposal(next,op,receipt),next,'replayed receipts cannot credit twice');
 assert.equal(p.inventory.length,3,'original state is not mutated');
});
class Database {
 active=true; rows:any[]=[]; receipts=new Map<string,any>();deleted=0;rollbacks=0;
 async connect(){return{query:this.query.bind(this),release(){}};}
 async query(sql:string,params:any[]=[]):Promise<any>{
  if(sql==='ROLLBACK'){this.rollbacks++;return{rows:[]};}
  if(sql.includes('SELECT telegram_id, request_json'))return{rows:this.receipts.has(params[0])?[this.receipts.get(params[0])]:[]};
  if(sql.includes('SELECT (premium_until'))return{rows:[{active:this.active}]};
  if(sql.includes('SELECT * FROM owned_items'))return{rows:this.rows.filter(r=>params[0].includes(r.id)&&r.owner_telegram_id===params[1])};
  if(sql.startsWith('DELETE FROM owned_items')){this.deleted++;this.rows=this.rows.filter(r=>!params[0].includes(r.id));return{rows:[]};}
  if(sql.startsWith('INSERT INTO inventory_bulk_disposals')){this.receipts.set(params[0],{telegram_id:params[1],request_json:JSON.parse(params[2]),result_json:JSON.parse(params[3])});return{rows:[]};}
  return{rows:[]};
 }
}
const serverId='22222222-2222-4222-8222-222222222222';
const body=()=>({operationId:operation([]).operationId,action:'sell',filters,itemIds:[serverId]});
const database=()=>{const db=new Database();db.rows=[{id:serverId,owner_telegram_id:7,item_json:item(serverId),quantity:3,locked:false,equipped_slot:null,bound_clan_id:null}];return db;};
test('server checks Premium before touching any items, including local-only operations',async()=>{
 const db=database();db.active=false;
 await assert.rejects(disposeBulkItems(db as unknown as Pool,7,body()),/Premium/);
 await assert.rejects(disposeBulkItems(db as unknown as Pool,7,{...body(),itemIds:[]}),/Premium/);
 assert.equal(db.deleted,0);assert.equal(db.rows.length,1);
});
test('server uses owned quantities and canonical rewards; retry recovers a receipt even after Premium expires',async()=>{
 const db=database();const request=body();
 const first=await disposeBulkItems(db as unknown as Pool,7,request);
 assert.equal(first.gold,30);assert.equal(first.count,3);assert.equal(db.rows.length,0);
 db.active=false;
 assert.deepEqual(await disposeBulkItems(db as unknown as Pool,7,request),first);
 assert.equal(db.deleted,1);
 await assert.rejects(disposeBulkItems(db as unknown as Pool,8,request),/повторного/);
 await assert.rejects(disposeBulkItems(db as unknown as Pool,7,{...request,action:'disassemble'}),/повторного/);
});
test('server rejects changed ownership, protected gear and invalid filters atomically',async()=>{
 for(const change of [{locked:true},{equipped_slot:'gloves'},{bound_clan_id:'clan'},{owner_telegram_id:8},{item_json:item(serverId,{upgradeLevel:2})},{item_json:item(serverId,{type:'ore'})}]){
  const db=database();Object.assign(db.rows[0],change);
  await assert.rejects(disposeBulkItems(db as unknown as Pool,7,body()));
  assert.equal(db.deleted,0);assert.equal(db.rollbacks,1);
 }
 const db=database();
 await assert.rejects(disposeBulkItems(db as unknown as Pool,7,{...body(),filters:{...filters,type:'potion'}}),/параметры/);
 assert.equal(db.deleted,0);
});
