import {progressDatabase} from './helpers/progressDatabase';
import {ProgressStore} from '../server/progressStore';
import crypto from 'node:crypto';
import {unavailableClanDonation} from '../server/clanDonation';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {registerProgress} from '../server/progressRoutes';

// The real browser coordinator and gate, with no local persistence test adapter.
const bundle=build({stdin:{contents:`import * as progress from './src/utils/serverProgress';import * as migration from './src/utils/migrationCandidate';import {apiRequest} from './src/utils/api';window.progress=progress;window.migration=migration;window.apiRequest=apiRequest;import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {AccountSessionGate} from './src/components/layout/AccountSessionGate';function Probe(){window.game=useGame();return <p data-character>{window.game.player?.name||'registration'}</p>;}window.act=act;window.mountGate=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<AccountSessionGate><p>ready</p></AccountSessionGate>);};window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<AccountSessionGate><GameProvider><Probe/></GameProvider></AccountSessionGate>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
async function browser(fetcher:any) {
 const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test',runScripts:'outside-only',pretendToBeVisual:true});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.AbortSignal=AbortSignal;w.AbortController=AbortController;w.structuredClone=structuredClone;w.fetch=fetcher;
 w.eval((await bundle).outputFiles[0].text);
 const wait=async(predicate:()=>boolean)=>{for(let n=0;n<250;n++){if(predicate())return;await w.act(async()=>{await new Promise(r=>setTimeout(r,20));});}assert(predicate(),'browser did not settle');};
 return {dom,w,wait,close:async()=>{await w.act(async()=>w.root?.unmount?.());dom.window.close();}};
}

test('two actual browser instances share one character after explicit transfer; stale writer cannot change it',async()=>{
 const {db,base:pool,query}=await progressDatabase();
 await query("INSERT INTO players(telegram_id,display_name) VALUES(749219401,'Signed user')");
 const app=express();app.use(express.json({limit:'1100kb'}));
 registerProgress(app,()=>pool,(req,_res,next)=>{req.authUser={id:749219401,displayName:'Signed user'};next();});
 app.get('/api/items/owned',(_req,res)=>res.json({items:[]}));
 app.use((_req,res)=>res.json({ok:true,active:false,items:[],rewarded:false,balanceGold:120}));
 const server=app.listen(0);await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port;
 const bridge=(path:string,options:any)=>fetch(url+path,options);
 const pc=await browser(bridge),phone=await browser(bridge);
 try{
  await pc.w.act(async()=>pc.w.mount());await pc.wait(()=>Boolean(pc.w.game));
  await pc.w.act(async()=>pc.w.game.createCharacter('Серверный герой','warrior'));
  await pc.wait(()=>pc.w.document.body.textContent.includes('Сохранено на сервере') && pc.w.localStorage.getItem('aethelgard_save_v1_data_749219401'));
  const stored=(await query('SELECT progress_json,progress_version FROM players WHERE telegram_id=749219401')).rows[0];assert.equal(stored.progress_json.player.name,'Серверный герой');
  await phone.w.act(async()=>phone.w.mount());await phone.wait(()=>phone.w.document.body.textContent.includes('Перенести активную сессию сюда'));
  assert.equal(phone.w.game,undefined,'creation stays inaccessible while another device owns the session');
  const transfer=[...phone.w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Перенести активную сессию сюда') as any;
  await phone.w.act(async()=>transfer.click());await phone.wait(()=>phone.w.game?.player?.id===stored.progress_json.player.id && phone.w.document.body.textContent.includes('Сохранено на сервере'));
  assert.equal(phone.w.game.player.gold,pc.w.game.player.gold);assert.deepEqual(JSON.parse(JSON.stringify(phone.w.game.player.inventory)),JSON.parse(JSON.stringify(pc.w.game.player.inventory)));
  const oldStrength=phone.w.game.player.attributes.strength;
  await phone.w.act(async()=>phone.w.game.allocateAttribute('strength'));
  await phone.wait(()=>phone.w.document.body.textContent.includes('Сохранено на сервере') && JSON.parse(phone.w.localStorage.getItem('aethelgard_save_v1_data_749219401')).player.attributes.strength===oldStrength+1);
  await pc.w.act(async()=>pc.w.game.allocateAttribute('strength'));
  await pc.wait(()=>pc.w.document.body.textContent.includes('Перенести активную сессию сюда') || pc.w.document.body.textContent.includes('Продолжение остановлено'));
  assert.equal((await query('SELECT progress_json FROM players WHERE telegram_id=749219401')).rows[0].progress_json.player.attributes.strength,oldStrength+1);
 }finally{await pc.close();await phone.close();await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});

test('failed initial server read never shows registration or loads a local hero',async()=>{
 const b=await browser(async()=>{throw new Error('offline');});
 b.w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify({player:{id:'old',userId:'749219401',name:'Локальный'}}));
 try{await b.w.act(async()=>b.w.mount());await b.wait(()=>b.w.document.body.textContent.includes('Повторить загрузку'));assert.equal(b.w.game,undefined);assert(!b.w.document.querySelector('[data-character]'));assert(b.w.localStorage.getItem('aethelgard_save_v1_data_749219401'));}
 finally{await b.close();}
});

const owner='749219401',cacheKey='aethelgard_save_v1_data_'+owner,journalKey='aethelgard_rpc_pending_'+owner;
const state=(name='Кандидат',epoch=0):any=>({resetVersion:epoch,player:{userId:owner,id:'char_'+name,name,classId:'warrior',level:1,gold:120,silver:80,exp:0,energy:60,maxEnergy:60,maxInventorySlots:40,attributes:{strength:5},skills:[],inventory:[],equipped:{},arenaRating:1000},quests:[],achievements:[],activeDungeonRun:null});
const envelope=(version=1,generation=1,epoch=0):any=>({ownerId:owner,resetVersion:epoch,version,sessionGeneration:generation,activeHere:true,migrationOpen:true,save:state('Сервер',epoch)});
const response=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve!:(r:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};};
const stored=(w:any)=>JSON.parse(w.localStorage.getItem(cacheKey));
const snapshot=(w:any)=>({local:Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];}),session:Array.from({length:w.sessionStorage.length},(_,i)=>{const k=w.sessionStorage.key(i);return [k,w.sessionStorage.getItem(k)];})});
const restore=(w:any,s:any)=>{for(const [k,v] of s.local)w.localStorage.setItem(k,v);for(const [k,v] of s.session)w.sessionStorage.setItem(k,v);};
const click=async(b:any,label:string)=>{const button=[...b.w.document.querySelectorAll('button')].find((x:any)=>x.textContent===label) as any;assert(button,label);await b.w.act(async()=>button.click());};

test('monotonic responses: v2 then v1, equal version preserves queue, old owner and generation do nothing',async()=>{
 const sent:any[]=[];const write=deferred();
 const b=await browser(async(path:any,opts:any)=>{sent.push(JSON.parse(opts.body));return write.promise;});
 try{
  let reloads=0;b.w.addEventListener('aethelgard-progress-reload',()=>reloads++);
  const p=b.w.progress;p.acceptProgress(envelope(2));
  const save=state('Сервер');save.player.gold=121;p.queueProgress(save);
  await b.wait(()=>sent.length===1);
  const queued=state('Сервер');queued.player.gold=122;p.queueProgress(queued);
  const unchanged=b.w.localStorage.getItem(cacheKey);
  assert.equal(p.acceptProgress(envelope(1),true),false);
  assert.equal(p.acceptProgress({...envelope(3),ownerId:'99'},true),false);
  assert.equal(p.acceptProgress(envelope(3,0),true),false);
  assert.equal(b.w.localStorage.getItem(cacheKey),unchanged);assert.equal(reloads,0);
  assert.equal(p.acceptProgress(envelope(2)),true);
  write.resolve(response({...envelope(3),save}));
  await b.wait(()=>sent.length>=2);
  assert.equal(sent[1].save.player.gold,122,'same-version response did not erase queued descendant');
 }finally{await b.close();}
});

test('pending background GET is invalid after transfer; pending save is invalid after reset',async()=>{
 const write=deferred();const b=await browser(async()=>write.promise);
 try{
  const p=b.w.progress;p.acceptProgress(envelope(2));
  const get=p.captureProgressRequest();p.acceptProgress(envelope(2,2));
  assert.equal(p.isProgressRequestCurrent(get),false);assert.equal(p.acceptProgress(envelope(2,1),true),false);
  const save=state('Сервер');save.player.gold=121;p.queueProgress(save);
  await b.wait(()=>p.progressStatus()==='saving');
  p.acceptProgress({...envelope(0,3,1),save:null},true);
  write.resolve(response({...envelope(3,2),save}));
  await new Promise(r=>setTimeout(r,60));
  assert.equal(p.confirmedProgress().resetVersion,1);assert.equal(p.confirmedProgress().save,null);assert.equal(b.w.localStorage.getItem(cacheKey),null);assert.equal(p.progressStatus(),'ready');
 }finally{await b.close();}
});

test('migration choice survives session acquisition, page restart, offline import and lost committed response',async()=>{
 const {db,base:pool,query}=await progressDatabase();await query("INSERT INTO players(telegram_id,display_name) VALUES(749219401,'User')");
 const store=new ProgressStore(pool);let lose=false,offline=false;
 const app=express();app.use(express.json());registerProgress(app,()=>pool,(req,_res,next)=>{req.authUser={id:Number(owner),displayName:'User'};next();});
 const server=app.listen(0);await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port;
 const bridge=async(path:string,options:any)=>{if(offline)throw new Error('offline');const result=await fetch(url+path,options);if(lose&&path==='/api/progress/migrate'){lose=false;await result.text();throw new Error('response lost');}return result;};
 let b=await browser(bridge);
 try{
  const local=state();local.player.gold=333;local.player.inventory=[{id:'ore',templateId:'iron_ore',name:'Железная руда',type:'ore',level:1,stats:{},stackCount:1000000}];
  b.w.localStorage.setItem(cacheKey,JSON.stringify(local));await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Перенести персонажа устройства'));
  assert.equal(b.w.localStorage.getItem(cacheKey),null,'session acquired, cache absent');
  const candidateKey=b.w.migration.migrationCandidateKey(owner,0);assert(b.w.localStorage.getItem(candidateKey));
  let saved=snapshot(b.w);await b.close();b=await browser(bridge);restore(b.w,saved);
  await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Перенести персонажа устройства'));
  offline=true;await click(b,'Перенести персонажа устройства');assert(b.w.localStorage.getItem(candidateKey));
  saved=snapshot(b.w);await b.close();offline=false;b=await browser(bridge);restore(b.w,saved);
  await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Перенести персонажа устройства'));
  lose=true;await click(b,'Перенести персонажа устройства');await b.wait(()=>b.w.document.body.textContent.includes('Нет соединения'));
  assert(b.w.localStorage.getItem(candidateKey));assert.equal((await store.load(Number(owner),b.w.progress.progressSessionToken())).version,1);
  saved=snapshot(b.w);await b.close();b=await browser(bridge);restore(b.w,saved);
  await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Перенести персонажа устройства'));
  await click(b,'Перенести персонажа устройства');await b.wait(()=>!b.w.localStorage.getItem(candidateKey));
  const final=await store.load(Number(owner),b.w.progress.progressSessionToken());assert.equal(final.version,1);assert.equal(final.save!.player.gold,333);assert.equal(final.save!.player.inventory[0].stackCount,1000000);
 }finally{await b.close();await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});

test('explicit server choice deletes only candidate; owner and reset isolation reject old candidates',async()=>{
 const b=await browser(async()=>response(envelope()));
 try{
  b.w.localStorage.setItem(cacheKey,JSON.stringify(state()));await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Оставить серверного персонажа'));
  const key=b.w.migration.migrationCandidateKey(owner,0);assert(b.w.localStorage.getItem(key));
  await click(b,'Оставить серверного персонажа');await b.wait(()=>!b.w.localStorage.getItem(key));assert.equal(stored(b.w).player.name,'Сервер');
  assert(Array.from({length:b.w.localStorage.length},(_,i)=>b.w.localStorage.key(i)).some(k=>k.startsWith('aethelgard_migration_backup_')));
  b.w.localStorage.setItem(cacheKey,JSON.stringify({...state(),player:{...state().player,userId:'99'}}));assert.equal(b.w.migration.preserveMigrationCandidate(owner,0),null);
  b.w.localStorage.setItem(cacheKey,JSON.stringify(state()));assert.equal(b.w.migration.preserveMigrationCandidate(owner,1),null);
  b.w.localStorage.setItem(cacheKey,JSON.stringify({...state(),resetVersion:undefined}));assert.equal(b.w.migration.preserveMigrationCandidate(owner,1),null);
 }finally{await b.close();}
});

test('unavailable donation never sends; old retry gets final refusal; unknown purchase survives 503 and lost success',async()=>{
 let calls=0;let mode='donate';let purchased=false;
 const b=await browser(async(path:string)=>{
  calls++;
  if(path.startsWith('/api/progress/operations/'))return response({completed:purchased,latest:envelope(purchased?2:1)});
  if(path==='/api/clan/donate')return response({code:'FEATURE_UNAVAILABLE',outcome:'rejected',error:'Пожертвования недоступны'},501);
  if(mode==='temporary')return response({error:'temporary'},503);
  purchased=true;throw new Error('lost successful response');
 });
 try{
  const p=b.w.progress;p.acceptProgress(envelope());
  await assert.rejects(b.w.apiRequest('/api/clan/donate',{method:'POST',body:'{"amount":100}'}),/недоступны/);assert.equal(calls,0);assert.equal(p.progressStatus(),'ready');
  b.w.localStorage.setItem(journalKey,JSON.stringify({operationId:crypto.randomUUID(),request:JSON.stringify({path:'/api/clan/donate',body:'{"amount":100}',resetVersion:0})}));
  p.setProgressStatus('offline');await assert.rejects(p.recoverProgress(),/HTTP 501/);assert.equal(b.w.localStorage.getItem(journalKey),null);assert.equal(p.progressStatus(),'ready');
  mode='temporary';await assert.rejects(b.w.apiRequest('/api/market/buy',{method:'POST',body:'{}'}),/HTTP 503/);
  const original=b.w.localStorage.getItem(journalKey);assert(original);assert.equal(p.progressStatus(),'offline');
  mode='lost';await assert.rejects(p.recoverProgress(),/Нет соединения/);assert.equal(b.w.localStorage.getItem(journalKey),original);assert.equal(p.progressStatus(),'offline');
  await p.recoverProgress();assert.equal(b.w.localStorage.getItem(journalKey),null);assert.equal(p.confirmedProgress().version,2);assert.equal(p.progressStatus(),'ready');
 }finally{await b.close();}
});

test('gate rechecks a background GET after it resolves; transfer and an in-flight save invalidate it',async()=>{
 for(const action of ['transfer','save']){
  const get=deferred(),write=deferred();let reads=0;
  const b=await browser(async(path:string)=>path==='/api/progress'?(++reads===1?response(envelope()):get.promise):write.promise);
  try{
   await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Сохранено на сервере'));
   b.w.dispatchEvent(new b.w.Event('focus'));await b.wait(()=>reads===2);
   const p=b.w.progress;const newer=state('Сервер');newer.player.gold=140;
   if(action==='transfer')p.acceptProgress(envelope(1,2),true);else p.queueProgress(newer);
   const before=b.w.localStorage.getItem(cacheKey);let reloads=0;b.w.addEventListener('aethelgard-progress-reload',()=>reloads++);
   get.resolve(response(envelope(2,1)));await new Promise(r=>setTimeout(r,60));
   assert.equal(b.w.localStorage.getItem(cacheKey),before);assert.equal(reloads,0);assert.equal(p.progressStatus(),action==='save'?'saving':'ready');
   if(action==='save'){write.resolve(response({...envelope(2),save:newer}));await b.wait(()=>p.progressStatus()==='ready');assert.equal(stored(b.w).player.gold,140);}
  }finally{await b.close();}
 }
});

test('closing the app loses its writer token but preserves a divergent candidate through explicit transfer and network failure',async()=>{
 const {db,base:pool,query}=await progressDatabase();await query("INSERT INTO players(telegram_id,display_name) VALUES(749219401,'User')");
 const store=new ProgressStore(pool),other=crypto.randomUUID();await store.acquire(Number(owner),other,0,false);
 const serverHero=state('Другой герой');serverHero.player.gold=777;
 await store.write(Number(owner),other,{operationId:crypto.randomUUID(),expectedVersion:0,resetVersion:0,save:serverHero},'migrate');
 const app=express();app.use(express.json());registerProgress(app,()=>pool,(req,_res,next)=>{req.authUser={id:Number(owner),displayName:'User'};next();});
 const server=app.listen(0);await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port;
 let offline=false;const bridge=(path:string,opts:any)=>{if(offline)return Promise.reject(new Error('offline'));return fetch(url+path,opts);};
 let b=await browser(bridge);
 try{
  const local=state();local.player.gold=333;b.w.localStorage.setItem(cacheKey,JSON.stringify(local));
  await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Перенести активную сессию сюда'));
  const key=b.w.migration.migrationCandidateKey(owner,0);assert(b.w.localStorage.getItem(key));
  const saved=snapshot(b.w);await b.close();b=await browser(bridge);restore(b.w,{...saved,session:[]});
  await b.w.act(async()=>b.w.mountGate());await b.wait(()=>b.w.document.body.textContent.includes('Перенести активную сессию сюда'));
  offline=true;await click(b,'Перенести активную сессию сюда');assert(b.w.localStorage.getItem(key));
  offline=false;await click(b,'Перенести активную сессию сюда');await b.wait(()=>b.w.document.body.textContent.includes('Перенести персонажа устройства'));
  assert(b.w.document.body.textContent.includes('Другой герой'));assert.equal(stored(b.w).player.gold,777,'cache replaced, candidate survives');
  offline=true;await click(b,'Оставить серверного персонажа');assert(b.w.localStorage.getItem(key),'failed read cannot finalize the choice');
  offline=false;await click(b,'Перенести персонажа устройства');await b.wait(()=>!b.w.localStorage.getItem(key));
  const final=await store.load(Number(owner),b.w.progress.progressSessionToken());assert.equal(final.save!.player.name,'Кандидат');assert.equal(final.save!.player.gold,333);
  const copies=(await query("SELECT save_json FROM progress_backups WHERE source='server_before_selection'")).rows;assert.equal(copies[0].save_json.player.gold,777);
 }finally{await b.close();await new Promise<void>(r=>server.close(()=>r()));await db.close();}
});

test('stale write response retains the exact request and queued descendant for safe retry',async()=>{
 const first=deferred();const requests:any[]=[];
 const b=await browser(async(_path:string,opts:any)=>{
  const request=JSON.parse(opts.body);requests.push(request);
  return requests.length===1?first.promise:response({...envelope(request.expectedVersion+1),save:request.save});
 });
 try{
  const p=b.w.progress;p.acceptProgress(envelope(2));
  const one=state('Сервер');one.player.gold=121;p.queueProgress(one);await b.wait(()=>requests.length===1);
  const two=state('Сервер');two.player.gold=122;p.queueProgress(two);
  first.resolve(response(envelope(1)));await b.wait(()=>p.progressStatus()==='offline');assert.equal(stored(b.w).confirmedVersion,2);
  await p.retryProgress();assert.equal(requests[0].operationId,requests[1].operationId);assert.equal(requests[2].save.player.gold,122);assert.equal(stored(b.w).player.gold,122);assert.equal(p.progressStatus(),'ready');
 }finally{await b.close();}
});
