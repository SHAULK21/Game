import {progressDatabase} from './helpers/progressDatabase';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {ProgressStore} from '../server/progressStore';
import {validateProgress,ProgressError} from '../server/progressValidation';
import {resetPlayerAccount} from '../server/accountReset';
import {registerProgress} from '../server/progressRoutes';
import {progressAwarePool,guardProgressTransaction} from '../server/progressTransactions';

const uuid=()=>crypto.randomUUID();
function save(id=1,name='ПК',epoch=0):any {
 return {resetVersion:epoch,player:{userId:String(id),id:'char_'+name,name,classId:'warrior',level:1,gold:120,silver:80,exp:0,energy:60,maxEnergy:60,maxInventorySlots:40,attributes:{strength:5},skills:[],inventory:[],equipped:{},arenaRating:1000},quests:[],achievements:[],activeDungeonRun:null,
 combat:{isInCombat:false,isCombatEnded:false,combatPlayerHp:123,combatPlayerMp:45,usedPotionKinds:[]}};
}
async function database() {
 const {db,base,query}=await progressDatabase();
 await query("INSERT INTO players(telegram_id,display_name) VALUES(1,'A'),(2,'B'),(3,'Admin')");
 return {db,query,base,pool:progressAwarePool(base)};
}
const body=(state:any,version:number,operationId=uuid())=>({save:state,expectedVersion:version,resetVersion:state.resetVersion,operationId});

test('two devices: server-first read, CAS conflicts, lost response replay, explicit writer transfer and account isolation',async()=>{
 const {db,pool}=await database();const store=new ProgressStore(pool);const pc=uuid(),phone=uuid();
 try{
  const absent=await store.load(1,pc);assert.equal(absent.save,null);
  await store.acquire(1,pc,0,false);
  const created=await store.write(1,pc,body(save(),0),'create');assert.equal(created.version,1);
  const onPhone=await store.load(1,phone);assert.deepEqual(onPhone.save,created.save);assert.equal(onPhone.activeHere,false);
  await assert.rejects(store.acquire(1,phone,1,false),(e:any)=>e.code==='SESSION_ACTIVE');
  const mine=structuredClone(created.save)!;mine.player.gold=151;
  const request=body(mine,1);
  const saved=await store.write(1,pc,request,'checkpoint');assert.equal(saved.version,2);
  assert.equal((await store.load(1,phone)).save!.player.gold,151);
  assert.equal((await store.write(1,pc,request,'checkpoint')).version,2,'lost response retries do not reapply');
  await assert.rejects(store.write(1,pc,body(save(),1),'checkpoint'),(e:any)=>e.code==='VERSION_CONFLICT');
  await assert.rejects(store.write(1,pc,{...request,save:{...mine,player:{...mine.player,gold:999}}},'checkpoint'),(e:any)=>e.code==='OPERATION_CONFLICT');
  const newer=structuredClone(saved.save)!;newer.player.gold=170;
  await store.write(1,pc,body(newer,2),'checkpoint');
  assert.equal((await store.write(1,pc,request,'checkpoint')).save!.player.gold,170,'an old replay returns latest, not its historical receipt');
  await store.acquire(1,phone,1,true);
  await assert.rejects(store.write(1,pc,body(newer,3),'checkpoint'),(e:any)=>e.code==='SESSION_LOST');
  const fresh=await store.load(1,phone);fresh.save!.player.gold=180;
  await store.write(1,phone,body(fresh.save,3),'checkpoint');
  assert.equal((await store.load(1,pc)).save!.player.gold,180);
  assert.equal((await store.load(2,phone)).save,null);
  await store.acquire(2,phone,0,false);
  await assert.rejects(store.write(2,phone,body(save(1),0),'migrate'),(e:any)=>e.code==='WRONG_OWNER');
  const results=await Promise.allSettled([store.write(1,phone,body(fresh.save,4),'checkpoint'),store.write(1,phone,body(fresh.save,4),'checkpoint')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'two simultaneous expected versions have one winner');
 }finally{await db.close();}
});

test('migration validates epoch and owner, backs up both explicit choices, excludes SQL items and never merges currencies',async()=>{
 const {db,pool,query}=await database();const store=new ProgressStore(pool),token=uuid();
 try{
  await store.acquire(1,token,0,false);
  const item={id:'ledger',name:'Клинок',type:'weapon',level:1,stats:{},serverOwned:true};
  const row=(await query("INSERT INTO owned_items(owner_telegram_id,item_json,origin) VALUES(1,$1::jsonb,'test') RETURNING id",[JSON.stringify(item)])).rows[0];
  const local=save();local.player.gold=321;local.player.inventory=[{...item,id:row.id}];
  const migrated=await store.write(1,token,body(local,0),'migrate');
  assert.equal(migrated.save!.player.gold,321);assert.equal(migrated.save!.player.inventory.length,1);
  assert.equal((await query('SELECT progress_json FROM players WHERE telegram_id=1')).rows[0].progress_json.player.inventory.length,0);
  const replacement=save(1,'Телефон');replacement.player.gold=42;
  await assert.rejects(store.write(1,token,body(replacement,1),'migrate'),(e:any)=>e.code==='MIGRATION_CLOSED');
  const chosen=await store.write(1,token,{...body(replacement,1),replaceExisting:true},'migrate');
  assert.equal(chosen.save!.player.gold,42,'the selected wallet replaces, never sums');
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM progress_backups')).rows[0].n,3);
  await store.write(1,token,body(chosen.save,2),'checkpoint');
  await assert.rejects(store.write(1,token,{...body(local,3),replaceExisting:true},'migrate'),(e:any)=>e.code==='MIGRATION_CLOSED');
  await resetPlayerAccount(pool,3,1,uuid(),0);
  const reset=await store.load(1,token);assert.equal(reset.save,null);assert.equal(reset.resetVersion,1);assert.equal(reset.activeHere,false);
  await store.acquire(1,token,reset.sessionGeneration,false);
  await assert.rejects(store.write(1,token,body(local,reset.version),'migrate'),(e:any)=>e.code==='ACCOUNT_RESET');
  const newHero=save(1,'Новый',1);await store.write(1,token,body(newHero,reset.version),'create');
  assert.equal((await store.load(1,token)).save!.player.name,'Новый');
 }finally{await db.close();}
});

test('legacy economic route uses one transaction: deletion, reward and receipt survive response loss; failures roll back',async()=>{
 const {db,pool,query}=await database();const store=new ProgressStore(pool);const token=uuid();
 await store.acquire(1,token,0,false);await store.write(1,token,body(save(),0),'create');
 const itemId=(await query("INSERT INTO owned_items(owner_telegram_id,item_json,origin) VALUES(1,'{}','test') RETURNING id")).rows[0].id;
 const app=express();app.use(express.json());
 app.post('/api/items/:id/dispose',async(req,res,next)=>{req.authUser={id:1,displayName:'A'};try{await guardProgressTransaction(pool,req,res,next);}catch(e){next(e);}},async(req,res,next)=>{
  const client=await pool.connect();try{
   await client.query('BEGIN');await client.query('DELETE FROM owned_items WHERE id=$1',[req.params.id]);
   if(req.body.fail)throw new Error('forced rollback');
   await client.query('COMMIT');res.json({ok:true,gold:25});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:String(e)});}finally{client.release();}
 });
 app.use((error:any,_req:any,res:any,_next:any)=>res.status(error.status||500).json({code:error.code,error:error.message}));
 const server=app.listen(0);await new Promise<void>(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+(server.address() as any).port;
 const op=uuid(),headers={'Content-Type':'application/json','X-Game-Session':token,'X-Game-Save-Version':'1','X-Game-Reset-Version':'0','X-Game-Operation':op};
 try{
  const call=()=>fetch(url+'/api/items/'+itemId+'/dispose',{method:'POST',headers,body:'{}'});
  const first=await (await call()).json();assert.equal(first._progress.save.player.gold,145);
  const replay=await (await call()).json();assert.equal(replay._progress.save.player.gold,145);assert.equal(replay._progress.version,2);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM progress_api_operations')).rows[0].n,1);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM owned_items WHERE id=$1',[itemId])).rows[0].n,0);
  const next=(await query("INSERT INTO owned_items(owner_telegram_id,item_json,origin) VALUES(1,'{}','test') RETURNING id")).rows[0].id;
  const failed=await fetch(url+'/api/items/'+next+'/dispose',{method:'POST',headers:{...headers,'X-Game-Save-Version':'2','X-Game-Operation':uuid()},body:'{"fail":true}'});
  assert.equal(failed.status,400);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM owned_items WHERE id=$1',[next])).rows[0].n,1);
  assert.equal((await store.load(1,token)).save!.player.gold,145);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});

test('HTTP API uses authenticated ID even when body specifies another account',async()=>{
 const {db,pool}=await database();const app=express();app.use(express.json());
 registerProgress(app,()=>pool,(req,_res,next)=>{req.authUser={id:1,displayName:'signed identity'};next();});
 const server=app.listen(0);await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port;const token=uuid();
 try{
  const headers={'Content-Type':'application/json','X-Game-Session':token};
  await fetch(url+'/api/progress/session',{method:'POST',headers,body:JSON.stringify({telegramId:2,expectedGeneration:0})});
  const response=await fetch(url+'/api/progress/migrate',{method:'POST',headers,body:JSON.stringify({...body(save(2),0),telegramId:2})});
  assert.equal(response.status,400);assert.equal((await response.json()).code,'WRONG_OWNER');
  assert.equal((await new ProgressStore(pool).load(2,token)).save,null);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});

test('invalid data, negative values and repeated IDs are rejected before migration',()=>{
 const state=save();state.player.gold=-1;assert.throws(()=>validateProgress(state,1,0,true),/gold/);
 state.player.gold=120;state.player.energy=Infinity;assert.throws(()=>validateProgress(state,1,0,true));
 state.player.energy=60;state.player.inventory=[{id:'x',stats:{},level:1},{id:'x',stats:{},level:1}];assert.throws(()=>validateProgress(state,1,0,true),/повторяется/);
 assert.throws(()=>validateProgress(save(2),1,0,true),(e:any)=>e instanceof ProgressError&&e.code==='WRONG_OWNER');
});

test('claimed rewards cannot be rolled back by a newer checkpoint',async()=>{
 const {db,pool}=await database();const store=new ProgressStore(pool),token=uuid();
 try{
  await store.acquire(1,token,0,false);const initial=save();initial.quests=[{id:'q',claimed:true}];initial.achievements=[{id:'a',claimed:true}];
  await store.write(1,token,body(initial,0),'migrate');
  const rollback=structuredClone(initial);rollback.quests[0].claimed=false;
  await assert.rejects(store.write(1,token,body(rollback,1),'checkpoint'),(e:any)=>e.code==='PROGRESS_REGRESSION');
  rollback.quests[0].claimed=true;rollback.achievements[0].claimed=false;
  await assert.rejects(store.write(1,token,body(rollback,1),'checkpoint'),(e:any)=>e.code==='PROGRESS_REGRESSION');
  assert.equal((await store.load(1,token)).save!.player.gold,120);
 }finally{await db.close();}
});

test('998, 999, 1000 and a large stock survive create/checkpoint/load/migrate and ledger projection exactly',async()=>{
 const {db,pool,query}=await database();const store=new ProgressStore(pool),token=uuid();
 try{
  await store.acquire(1,token,0,false);
  const item=(count:number,id='resource')=>({id,templateId:'iron_ore',name:'Железная руда',type:'ore',rarity:'common',level:1,upgradeLevel:0,stats:{},stackCount:count});
  let latest:any;
  for(const quantity of [998,999,1000,1000000]){
   const data=save();data.player.inventory=[item(quantity)];
   latest=await store.write(1,token,body(data,latest?.version??0),latest?'checkpoint':'create');
   assert.equal((await store.load(1,token)).save!.player.inventory[0].stackCount,quantity);
   assert.equal(latest.save.player.inventory.reduce((n:number,i:any)=>n+i.stackCount,0),quantity);
  }
  await query("INSERT INTO owned_items(owner_telegram_id,item_json,origin,quantity) VALUES(1,$1::jsonb,'test',1000000)",[JSON.stringify(item(1,'ignored'))]);
  assert.equal((await store.load(1,token)).save!.player.inventory.filter(i=>i.serverOwned)[0].stackCount,1000000);
  const second=uuid();await store.acquire(2,second,0,false);
  const legacy=save(2);legacy.player.inventory=[item(1000000)];
  const migrated=await store.write(2,second,body(legacy,0),'migrate');assert.equal(migrated.save!.player.inventory[0].stackCount,1000000);
  assert.equal((await store.write(2,second,body(legacy,1),'checkpoint')).save!.player.inventory[0].stackCount,1000000);
 }finally{await db.close();}
});

test('unavailable donation returns a machine-readable final refusal and rolls back without a receipt or wallet debit',async()=>{
 const {unavailableClanDonation}=await import('../server/clanDonation');
 const {db,pool,query}=await database();const store=new ProgressStore(pool),token=uuid();
 await store.acquire(1,token,0,false);await store.write(1,token,body(save(),0),'create');
 const app=express();app.use(express.json());
 app.use(async(req,res,next)=>{req.authUser={id:1,displayName:'User'};try{await guardProgressTransaction(pool,req,res,next);}catch(e){next(e);}});
 app.post('/api/clan/donate',unavailableClanDonation);
 const server=app.listen(0);await new Promise<void>(r=>server.once('listening',r));
 try{
  const r=await fetch('http://127.0.0.1:'+(server.address() as any).port+'/api/clan/donate',{method:'POST',headers:{'Content-Type':'application/json','X-Game-Session':token,'X-Game-Save-Version':'1','X-Game-Reset-Version':'0','X-Game-Operation':uuid()},body:'{"amount":100}'});
  assert.equal(r.status,501);const denied:any=await r.json();assert.equal(denied.code,'FEATURE_UNAVAILABLE');assert.equal(denied.outcome,'rejected');
  const latest=await store.load(1,token);assert.equal(latest.version,1);assert.equal(latest.save!.player.gold,120);
  assert.equal((await query('SELECT count(*)::int AS n FROM progress_api_operations')).rows[0].n,0);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});
