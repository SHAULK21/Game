import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {ServerProgress,ProgressRequestError} from '../src/utils/serverProgress';
import {registerGameRoutes} from '../server/gameRoutes';
import {verifyTelegramInitData} from '../server/telegramAuth';
import {expeditionDatabase} from './helpers/expeditionDatabase';
import {resetPlayerAccount} from '../server/accountReset';
import type {ProgressEnvelope} from '../src/types/progress';
import {getWriterSession} from '../src/utils/writerSession';
class MemoryStorage {data=new Map<string,string>();getItem(k:string){return this.data.get(k)||null;}setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}}
const token='test-bot-token';
function signed(id:number){const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Игрок'})});const text=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');const key=crypto.createHmac('sha256','WebAppData').update(token).digest();params.set('hash',crypto.createHmac('sha256',key).update(text).digest('hex'));return params.toString();}
test('production HTTP, verified Telegram identity and real SQL progress drive the browser journal',async t=>{
 const db=await expeditionDatabase(),app=express();app.use(express.json({limit:'1mb'}));
 const auth:express.RequestHandler=async(req,res,next)=>{try{req.authUser=verifyTelegramInitData(req.get('X-Telegram-Init-Data')||'',token);await db.query('INSERT INTO players(telegram_id) VALUES($1) ON CONFLICT DO NOTHING',[req.authUser.id]);next();}catch{res.status(401).json({code:'UNAUTHORIZED'});}};
 registerGameRoutes(app,()=>db.pool,auth);
 app.post('/api/clan/donate',auth,(_req,res)=>res.status(501).json({code:'FEATURE_UNAVAILABLE',outcome:'rejected',error:'Недоступно'}));
 const listener=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>listener.once('listening',resolve));const url='http://127.0.0.1:'+(listener.address() as any).port;
 const request=(owner:number)=>async(path:string,init:RequestInit)=>{const response=await fetch(url+path,{...init,headers:{...Object.fromEntries(new Headers(init.headers)), 'Content-Type':'application/json','X-Telegram-Init-Data':signed(owner)}});const data=await response.json();if(!response.ok)throw new ProgressRequestError(data,response.status);return data;};
 const storage=new MemoryStorage(),pc=new ServerProgress('990',getWriterSession('990',storage,new MemoryStorage()),storage,request(990)),phone=new ServerProgress('990',crypto.randomUUID(),new MemoryStorage(),request(990));
 try{
 await t.test('GET confirms absence and a body ID cannot choose another account',async()=>{
  await pc.load();assert.equal(pc.current!.save,null);await pc.acquire();
  await pc.mutate('/api/progress/create',{name:'Рыцарь',classId:'warrior',ownerId:991,telegramId:991});
  assert.equal(pc.current!.save!.player.userId,'990');assert.equal(pc.pending,null);assert.equal((await db.query('SELECT * FROM players WHERE telegram_id=991')).rows.length,0);
 });
 await t.test('reopening with empty session storage remains active without acquiring a new generation',async()=>{
  const reopened=new ServerProgress('990',getWriterSession('990',storage,new MemoryStorage()),storage,request(990));
  await reopened.load();assert.equal(reopened.current!.activeHere,true);assert.equal(reopened.status,'saved');
  assert.equal(reopened.current!.sessionGeneration,pc.current!.sessionGeneration);
 });
 await t.test('second device sees the same hero and cannot silently take the writer',async()=>{
  await phone.load();assert.equal(phone.current!.save!.player.id,pc.current!.save!.player.id);await phone.acquire(false);assert.equal(phone.current!.activeHere,false);
  await phone.acquire(true);assert.equal(phone.current!.activeHere,true);await pc.load();assert.equal(pc.current!.activeHere,false);
  await pc.acquire(true);
 });
 await t.test('lost response keeps the exact operation journal until safe replay',async()=>{
  const owner='992',disk=new MemoryStorage();let lose=true;const real=request(992);
  const first=new ServerProgress(owner,crypto.randomUUID(),disk,async(path,init)=>{const result=await real(path,init);if(path==='/api/progress/create'&&lose){lose=false;throw new Error('lost response');}return result;});
  await first.load();await first.acquire();await assert.rejects(()=>first.mutate('/api/progress/create',{name:'Страж',classId:'mage'}));assert.ok(first.pending);
  const reload=new ServerProgress(owner,first.token,disk,real);await reload.load();await reload.recover();assert.equal(reload.pending,null);assert.equal(reload.current!.save!.player.gold,120);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM game_operations WHERE telegram_id=992')).rows[0].n,1);
 });
 await t.test('501 donation is definitive and clears only its own journal',async()=>{
  await assert.rejects(()=>pc.mutate('/api/clan/donate',{amount:100}));assert.equal(pc.pending,null);assert.equal(pc.status,'saved');
 });
 await t.test('a successful purchase with a lost HTTP reply stays recoverable after closing the app',async()=>{
  const disk=new MemoryStorage(),real=request(994),writer=crypto.randomUUID();let lose=false;
  const client=new ServerProgress('994',writer,disk,async(path,init)=>{const result=await real(path,init);if(lose&&path==='/api/progress/command'){lose=false;throw new Error('lost purchase reply');}return result;});
  await client.load();await client.acquire();await client.mutate('/api/progress/create',{name:'Покупатель',classId:'warrior'});
  const save=(await db.query('SELECT progress_json FROM players WHERE telegram_id=994')).rows[0].progress_json;save.player.worldPlace='settlement';await db.query('UPDATE players SET progress_json=$1::jsonb WHERE telegram_id=994',[JSON.stringify(save)]);await client.load();
  lose=true;await assert.rejects(()=>client.mutate('/api/progress/command',{type:'buyBasicConsumable',templateId:'pot_hp_small'}));assert.ok(client.pending);
  const reload=new ServerProgress('994',writer,disk,real);await reload.load();assert.equal(reload.current!.save!.player.gold,85);await reload.resolveConflict();assert.equal(reload.pending,null);assert.equal(reload.current!.save!.player.gold,85);
 });
 await t.test('session transfer invalidates a GET that finishes later',async()=>{
  const real=request(990);let hold=false,release!:()=>void,captured!:()=>void;const received=new Promise<void>(resolve=>{captured=resolve;});const blocked=new Promise<void>(resolve=>{release=resolve;});
  const device=new ServerProgress('990',pc.token,new MemoryStorage(),async(path,init)=>{const result=await real(path,init);if(hold&&path==='/api/progress'){captured();await blocked;}return result;});
  await device.load();hold=true;const get=device.load();await received;
  await phone.load();await phone.acquire(true);const latest=await real('/api/progress',{headers:{'X-Game-Session':pc.token}});assert.equal(device.accept(latest),true);
  const generation=device.current!.sessionGeneration;release();assert.equal(await get,false);assert.equal(device.current!.sessionGeneration,generation);assert.equal(device.current!.activeHere,false);
 });
 await t.test('account reset during an unfinished response never restores the old character',async()=>{
  const real=request(994),disk=new MemoryStorage();let hold=false,release!:()=>void,captured!:()=>void;const received=new Promise<void>(resolve=>{captured=resolve;});const blocked=new Promise<void>(resolve=>{release=resolve;});
  const device=new ServerProgress('994',crypto.randomUUID(),disk,async(path,init)=>{const result=await real(path,init);if(hold&&path==='/api/progress/command'){captured();await blocked;}return result;});
  await device.load();await device.acquire(true);hold=true;const action=device.mutate('/api/progress/command',{type:'buyBasicConsumable',templateId:'pot_hp_small'});await received;
  await resetPlayerAccount(db.pool,994,994,crypto.randomUUID(),0);const latest=await real('/api/progress',{headers:{'X-Game-Session':device.token}});device.accept(latest);assert.equal(device.current!.resetVersion,1);assert.equal(device.current!.save,null);release();await action;assert.equal(device.current!.save,null);assert.equal(device.pending,null);
 });
 await t.test('migration candidate and backup survive session acquisition and reload',async()=>{
  const owner='993',disk=new MemoryStorage();const old={resetVersion:0,player:{userId:owner,name:'Старый'}};disk.setItem('aethelgard_save_v1_data_'+owner,JSON.stringify(old));
  const first=new ServerProgress(owner,crypto.randomUUID(),disk,request(993));await first.load();await first.acquire();
  const reload=new ServerProgress(owner,first.token,disk,request(993));await reload.load();assert.deepEqual(reload.candidate,old);assert.equal(disk.getItem('aethelgard_server_backup_993_0'),JSON.stringify(old));
  await reload.acquire();await assert.rejects(()=>reload.mutate('/api/progress/migrate',{save:old}));assert.equal(reload.pending,null,'a structurally invalid candidate is a definitive refusal');assert.deepEqual(reload.candidate,old);
  await db.query('UPDATE players SET reset_version=1 WHERE telegram_id=993');await reload.load();assert.equal(reload.candidate,null);assert.ok(disk.getItem('aethelgard_server_backup_993_0'));
 });
 }finally{await new Promise<void>((resolve,reject)=>listener.close(e=>e?reject(e):resolve()));await db.close();}
});
test('delayed responses cannot replace a new version or clear pending changes',async()=>{
 const storage=new MemoryStorage();const client=new ServerProgress('1',crypto.randomUUID(),storage,async()=>{});
 const envelope=(version:number,generation=1,resetVersion=0)=>({protocol:'server-actions-v1',ownerId:'1',resetVersion,version,sessionGeneration:generation,activeHere:true,writerPresent:true,migrationOpen:false,canonical:true,save:null,game:null,expeditions:null,serverTime:Date.now(),nextTickAt:null,cues:[]} as ProgressEnvelope);
 assert.equal(client.accept(envelope(2)),true);client.pending={ownerId:'1',resetVersion:0,sessionToken:client.token,sessionGeneration:1,expectedVersion:2,operationId:crypto.randomUUID(),path:'/api/progress/command',body:{type:'drinkBeer'}};
 const cached=storage.getItem('aethelgard_server_cache_1_0');assert.equal(client.accept(envelope(1)),false);assert.ok(client.pending);assert.equal(storage.getItem('aethelgard_server_cache_1_0'),cached);
 assert.equal(client.accept(envelope(2,2)),true);assert.equal(client.accept(envelope(2,1)),false);
 assert.equal(client.accept(envelope(0,3,1)),true);assert.equal(client.pending,null);assert.equal(client.accept(envelope(5,2,0)),false);
});

test('old unavailable donation journal recovers without replaying an unknown purchase',async()=>{
 const disk=new MemoryStorage();disk.setItem('aethelgard_rpc_pending_7',JSON.stringify({operationId:crypto.randomUUID(),request:JSON.stringify({path:'/api/clan/donate',body:'{"amount":100}',resetVersion:0})}));
 const calls:string[]=[];const client=new ServerProgress('7',crypto.randomUUID(),disk,async path=>{calls.push(path);throw new ProgressRequestError({code:'FEATURE_UNAVAILABLE',outcome:'rejected',error:'Недоступно'},501);});
 await client.resolveConflict();assert.equal(client.pending,null);assert.equal(disk.getItem('aethelgard_rpc_pending_7'),null);assert.deepEqual(calls,['/api/clan/donate']);
 const unknown=new ServerProgress('8',crypto.randomUUID(),new MemoryStorage(),async()=>{throw new ProgressRequestError({code:'RESULT_UNKNOWN',error:'Временная ошибка'},503);});
 unknown.accept({protocol:'server-actions-v1',ownerId:'8',resetVersion:0,version:1,sessionGeneration:1,activeHere:true,writerPresent:true,migrationOpen:false,canonical:true,save:null,game:null,expeditions:null,serverTime:Date.now(),nextTickAt:null,cues:[]});
 await assert.rejects(()=>unknown.mutate('/api/market/a/buy',{}));assert.ok(unknown.pending);assert.equal(unknown.status,'offline');
});
