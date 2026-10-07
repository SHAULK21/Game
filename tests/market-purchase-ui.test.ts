import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('real purchase callback serializes clicks, recovers lost receipt and keeps server items with a full bag',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import{GameProvider,useGame}from'./src/context/GameContext';function Probe(){window.game=useGame();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[localProgressPlugin,{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();
 let owned:any[]=[],balance=100,lost=true,calls=0;let operation:any=null;
 const item={templateId:'iron',name:'Железная руда',type:'ore',rarity:'rare',level:1,upgradeLevel:0,stats:{},sellPrice:2,disassembleYield:{}};
 w.fetch=async(path:string,options:any)=>{
  let result:any={ok:true,active:false};let status=200;
  if(path==='/api/items/owned')result={items:owned};
  if(path==='/api/market/income')result={balanceGold:balance};
  if(path.endsWith('/buy')){
   calls++;const request=JSON.parse(options.body);
   if(path.includes('/first/')){
    if(operation)assert.equal(request.operationId,operation.operationId);
    else {operation=request;balance-=60;owned=[{id:'00000000-0000-4000-8000-000000000001',item_json:item,quantity:1,locked:false,origin:'market_purchase'}];}
    if(lost){lost=false;throw Error('response lost');}
    result={ok:true,itemId:owned[0].id,operationId:request.operationId};
   }else {status=400;result={error:'Недостаточно золота в кошельке рынка.'};}
  }
  return {ok:status===200,status,text:async()=>JSON.stringify(result)};
 };
 w.eval(bundle.outputFiles[0].text);
 try {
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Покупатель','warrior'));
  const key='aethelgard_save_v1_data_749219401';const seed=JSON.parse(w.localStorage.getItem(key));
  seed.player.gold=100;seed.player.maxInventorySlots=1;seed.player.inventory=[{...item,id:'local',rarity:'common',stackCount:1}];seed.player.equipped={};
  await w.act(async()=>w.root.unmount());w.localStorage.setItem(key,JSON.stringify(seed));await w.act(async()=>w.mount());
  let results:any[]=[];
  await w.act(async()=>{results=await Promise.all([w.game.buyMarketListing('first',60),w.game.buyMarketListing('second',60)]);});
  assert.equal(calls,1,'second click never sends a request');assert(results.every(r=>!r.success));
  assert.equal(balance,40);assert.equal(w.game.player.gold,100);
  assert(w.localStorage.getItem('aethelgard_market_purchase_pending_749219401'));
  assert(w.game.player.inventory.some((i:any)=>i.id===owned[0].id),'durable server item recovers despite the lost receipt and full bag');
  assert(w.game.player.inventory.some((i:any)=>i.id==='local'),'existing different-rarity stack remains intact');
  let retry:any;await w.act(async()=>{retry=await w.game.buyMarketListing('first',60);});assert(retry.success);assert.equal(balance,40);assert.equal(calls,2);
  assert.equal(w.localStorage.getItem('aethelgard_market_purchase_pending_749219401'),null);
  await w.act(async()=>{retry=await w.game.buyMarketListing('second',60);});assert(!retry.success);assert.match(retry.message,/Недостаточно/);
  assert.equal(balance,40);assert.equal(w.game.player.gold,100);assert.equal(w.game.player.inventory.filter((i:any)=>i.id===owned[0].id).length,1);
  // Loading a different Telegram identity must not migrate or mutate the first account.
  await w.act(async()=>w.root.unmount());const first=w.localStorage.getItem(key);
  w.localStorage.setItem('aethelgard_save_v1_data',first);w.Telegram={WebApp:{initDataUnsafe:{user:{id:2,first_name:'Другой'}}}};
  await w.act(async()=>w.mount());assert.equal(w.game.player,null);assert.equal(w.localStorage.getItem(key),first);assert.equal(w.localStorage.getItem('aethelgard_save_v1_data'),first);
 } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
