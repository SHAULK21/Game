import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('character wallet reserves clan payment once, resumes a lost response and refunds a rejected creation',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {LocalGameProvider as GameProvider,useGame} from './src/context/GameContext';function Probe(){window.game=useGame();return null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 let calls:any[]=[];let mode='lost';let premium=false;
 w.fetch=async(path:string,options:any)=>{
  if(path==='/api/clan/create') {calls.push(JSON.parse(options.body));if(mode==='lost')throw new Error('Lost response');if(mode==='rejected')return {ok:false,status:400,text:async()=>JSON.stringify({error:'Такой тег уже занят.'})};return {ok:true,status:201,text:async()=>JSON.stringify({ok:true,clanId:'clan',priceGold:premium?50000:100000})};}
  return {ok:true,status:200,text:async()=>JSON.stringify({active:premium,items:[],ok:true,totalGold:0})};
 };
 w.eval(bundle.outputFiles[0].text);
 try {
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Страж','warrior'));
  await w.act(async()=>{await assert.rejects(()=>w.game.createClan({name:'Стражи',tag:'GRD',description:''}),/100/);});assert.equal(calls.length,0);
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));seed.player.gold=120000;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await w.act(async()=>w.mount());
  await w.act(async()=>{await assert.rejects(()=>w.game.createClan({name:'Стражи',tag:'GRD',description:''}),/Нет соединения/);});
  assert.equal(w.game.player.gold,20000);assert.equal(JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401')).player.gold,20000);
  const operation=calls[0].operationId;mode='ok';
  await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());
  assert.equal(calls.length,2);assert.equal(calls[1].operationId,operation);assert.equal(w.game.player.gold,20000);assert.equal(w.game.player.lastClanCreationOperation,operation);
  assert.equal(w.localStorage.getItem('aethelgard_clan_creation_pending_'+w.game.player.userId),null);
  premium=true;mode='rejected';await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await w.act(async()=>w.mount());
  await w.act(async()=>{await assert.rejects(()=>w.game.createClan({name:'Стражи',tag:'GRD',description:''}),/занят/);});assert.equal(calls[2].expectedPriceGold,50000);assert.equal(w.game.player.gold,120000);
  mode='ok';await w.act(async()=>w.game.createClan({name:'Следопыты',tag:'RNG',description:''}));assert.equal(w.game.player.gold,70000);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
