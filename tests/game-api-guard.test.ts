import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import crypto from 'node:crypto';
import {expeditionDatabase} from './helpers/expeditionDatabase';import {GameStore} from '../server/gameStore';import {registerGameApiGuard} from '../server/gameApiGuard';import {gameTransactionPool} from '../server/gameTransactions';import {sellToResidents} from '../server/localMarket';
test('real legacy market handler participates in the canonical transaction and durable receipts',async()=>{
 const db=await expeditionDatabase(),pool=gameTransactionPool(db.pool),app=express();app.use(express.json());const owner={id:5001,displayName:'Торговец'},token=crypto.randomUUID(),store=new GameStore(pool);
 const auth:express.RequestHandler=(req,_res,next)=>{req.authUser=owner;next();};registerGameApiGuard(app,()=>pool,auth);
 app.post('/api/market/residents',auth,async(req,res)=>{try{res.json(await sellToResidents(pool,owner.id,0,req.body));}catch(error){res.status(400).json({error:(error as Error).message});}});
 const listener=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>listener.once('listening',resolve));const url='http://127.0.0.1:'+(listener.address() as any).port;
 try{
  await db.query('INSERT INTO players(telegram_id) VALUES($1)',[owner.id]);let view=await store.acquire(owner,token,0,false);
  const op=()=>({operationId:crypto.randomUUID(),sessionToken:token,sessionGeneration:view.sessionGeneration,resetVersion:0,expectedVersion:view.version});view=await store.create(owner,op(),{name:'Торговец',classId:'warrior'});view=await store.operation(owner,op(),{type:'returnToSettlement'});
  await db.query("UPDATE players SET progress_json=jsonb_set(jsonb_set(progress_json,'{player,worldJourney}','null'),'{player,worldPlace}','\"settlement\"') WHERE telegram_id=$1",[owner.id]);
  // Incoming ownership is reflected even when a different account granted it.
  const material={templateId:'test_ore',type:'ore',rarity:'common',name:'Уголь',level:1,upgradeLevel:0,sellPrice:12,disassembleYield:{ore:1},stats:{},icon:'ore'};
  const item=(await db.query("INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES($1,$2::jsonb,1000,'game_command') RETURNING id",[owner.id,JSON.stringify(material)])).rows[0].id;
  const before=view.version;view=await store.load(owner,token);assert.ok(view.version>before);assert.equal(view.save!.player.inventory.find(i=>i.id===item)!.stackCount,1000);
  const operation=op(),body={operationId:crypto.randomUUID(),itemId:item,item:{id:item,sellPrice:99999999},quantity:2};
  const headers={'Content-Type':'application/json','X-Game-Session':token,'X-Game-Generation':String(view.sessionGeneration),'X-Game-Version':String(view.version),'X-Game-Reset-Version':'0','X-Game-Operation':operation.operationId};
  const firstResponse=await fetch(url+'/api/market/residents',{method:'POST',headers,body:JSON.stringify(body)});const first:any=await firstResponse.json();assert.equal(firstResponse.status,200,JSON.stringify(first));assert.ok(first.gold<99999);assert.equal(first._operation.outcome,'applied');
  const repeated:any=await (await fetch(url+'/api/market/residents',{method:'POST',headers,body:JSON.stringify(body)})).json();assert.equal(repeated._operation.replayed,true);assert.equal(repeated._progress.save.player.gold,first._progress.save.player.gold);
  assert.equal(Number((await db.query('SELECT quantity FROM owned_items WHERE id=$1',[item])).rows[0].quantity),998);
  const rejectedHeaders={...headers,'X-Game-Version':String(first._progress.version),'X-Game-Operation':crypto.randomUUID()};const refused:any=await (await fetch(url+'/api/market/residents',{method:'POST',headers:rejectedHeaders,body:JSON.stringify({...body,itemId:crypto.randomUUID()})})).json();assert.equal(refused._operation.outcome,'rejected');assert.equal(refused._progress.save.player.gold,first._progress.save.player.gold);
 }finally{await new Promise<void>((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));await db.close();}
});
