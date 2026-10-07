import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {registerProgress} from '../server/progressRoutes';

// The real browser coordinator and gate, with no local persistence test adapter.
const bundle=build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {AccountSessionGate} from './src/components/layout/AccountSessionGate';function Probe(){window.game=useGame();return <p data-character>{window.game.player?.name||'registration'}</p>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<AccountSessionGate><GameProvider><Probe/></GameProvider></AccountSessionGate>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
async function browser(fetcher:any) {
 const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test',runScripts:'outside-only',pretendToBeVisual:true});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.AbortSignal=AbortSignal;w.AbortController=AbortController;w.structuredClone=structuredClone;w.fetch=fetcher;
 w.eval((await bundle).outputFiles[0].text);
 const wait=async(predicate:()=>boolean)=>{for(let n=0;n<250;n++){if(predicate())return;await w.act(async()=>{await new Promise(r=>setTimeout(r,20));});}assert(predicate(),'browser did not settle');};
 return {dom,w,wait,close:async()=>{await w.act(async()=>w.root?.unmount());dom.window.close();}};
}

test('two actual browser instances share one character after explicit transfer; stale writer cannot change it',async()=>{
 const db=new PGlite();const query=async(sql:string,args:any[]=[])=>{const r=await db.query<any>(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
 let tail=Promise.resolve();const pool:any={query,connect:async()=>{const before=tail;let unlock!:()=>void;tail=new Promise<void>(r=>unlock=r);await before;return {query,release:unlock};}};
 await db.exec((await fs.readFile('server/schema.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
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
