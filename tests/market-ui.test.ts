import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
test('market picker excludes local loot, includes server gear, sells the complete stack and recovers a lost listing response',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import{GameProvider,useGame}from'./src/context/GameContext';import{MarketScreen}from'./src/components/market/MarketScreen';function Probe(){window.game=useGame();return window.game.player?<MarketScreen/>:null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[localProgressPlugin,{name:'artwork',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as null|(()=>void)};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();
 let residentRequest:any=null;let residentLost=true;
 let request:any=null,lost=false,calls=0,serverPresent=true,orePresent=true;const gear=(id:string,type:string,name:string,extra:any={})=>({id,templateId:id,name,type,rarity:'common',level:1,upgradeLevel:0,icon:'',stats:{},sellPrice:10,disassembleYield:{silver:3,ore:1},...extra});
 const oreId='00000000-0000-4000-8000-000000000004';
 const serverId='00000000-0000-4000-8000-000000000003';
 w.fetch=async(path:string,options:any)=>{
  let result:any={ok:true,active:true};
  if(path==='/api/items/owned')result={items:[...(serverPresent?[{id:serverId,item_json:gear(serverId,'gloves','Рейдовые перчатки',{rarity:'rare'}),quantity:1,locked:false}]:[]),...(orePresent?[{id:oreId,item_json:gear('iron','ore','Железная руда'),quantity:2,locked:false}]:[])]};
  if(path==='/api/market/income')result={balanceGold:120};
  if(path==='/api/market/mine')result={listings:[]};
  if(path==='/api/market/listings')result={listings:[]};
  if(path==='/api/market/residents'){const body=JSON.parse(options.body);if(residentRequest)assert.equal(body.operationId,residentRequest.operationId);residentRequest=body;if(residentLost){residentLost=false;throw new Error('Lost response');}result={gold:6};}
  if(path==='/api/market/list'){
   calls++;const body=JSON.parse(options.body);if(request)assert.equal(body.operationId,request.operationId);request=body;
   if(lost){lost=false;throw new Error('Lost response');}if(body.itemId===serverId)serverPresent=false;if(body.itemId===oreId)orePresent=false;result={listing:{id:'listing'}};
  }
  return {ok:true,status:200,text:async()=>JSON.stringify(result)};
 };
 w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Торговец','warrior'));
  const save=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));
  save.player.inventory=[gear('herb','material','Лечебная трава',{stackCount:4}),gear('ore','ore','Железная руда',{stackCount:2}),gear('meat','material','Мясо вепря',{stackCount:48}),gear('locked','gloves','Заперто',{isLocked:true}),gear('bound','pants','Клановое',{boundToClan:'clan'})];save.player.equipped={};
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(save));await w.act(async()=>w.mount());
  const button=(text:string)=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent.trim()===text) as any;
  await w.act(async()=>button('Местные жители').click());
  const residentSelect=w.document.querySelector('select');await w.act(async()=>{residentSelect.value='meat';residentSelect.dispatchEvent(new w.Event('change',{bubbles:true}));});
  const amount=w.document.querySelector('input[type=number]');await w.act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(amount,'2');amount.dispatchEvent(new w.Event('input',{bubbles:true}));});
  const goldBefore=w.game.player.gold;
  await w.act(async()=>button('Подтвердить продажу жителям').click());assert.equal(w.game.player.inventory.find((i:any)=>i.id==='meat').stackCount,48);assert.equal(w.game.player.gold,goldBefore);
  await w.act(async()=>button('Подтвердить продажу жителям').click());assert.equal(w.game.player.inventory.find((i:any)=>i.id==='meat').stackCount,46);assert.equal(w.game.player.gold,goldBefore+6);assert.equal(residentRequest.quantity,2);
  await w.act(async()=>button('Рыцари').click());
  await w.act(async()=>button('Продать вещь').click());
  const select=w.document.querySelector('select');const options=[...select.querySelectorAll('option')].map((o:any)=>o.value).filter(Boolean);
  assert.deepEqual(options.sort(),[serverId,oreId].sort());
  const search=w.document.querySelector('input[type=search]');
  const setSearch=async(value:string)=>w.act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(search,value);search.dispatchEvent(new w.Event('input',{bubbles:true}));});
  await setSearch('мясо');assert.deepEqual([...select.querySelectorAll('option')].map((o:any)=>o.value).filter(Boolean),[]);assert.equal(button('Выставить').disabled,true);
  await setSearch('');await w.act(async()=>button('Экипировка').click());assert.deepEqual([...select.querySelectorAll('option')].map((o:any)=>o.value).filter(Boolean),[serverId]);
  await w.act(async()=>button('Все').click());
  await w.act(async()=>{select.value=oreId;select.dispatchEvent(new w.Event('change',{bubbles:true}));});
  const inputs=w.document.querySelectorAll('input[type="number"]');
  await w.act(async()=>{const setter=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!;setter.call(inputs[0],'2');inputs[0].dispatchEvent(new w.Event('input',{bubbles:true}));});
  // Direct context call also verifies the non-UI API honors quantity and idempotent retry.
  let result:any;lost=true;await w.act(async()=>{result=await w.game.listMarketItem(w.game.player.inventory.find((i:any)=>i.id===oreId),2,100);});
  assert.equal(result.success,false);assert.equal(w.game.player.inventory.find((i:any)=>i.id===oreId).stackCount,2);
  await w.act(async()=>{result=await w.game.listMarketItem(w.game.player.inventory.find((i:any)=>i.id===oreId),2,100);});
  assert.equal(result.success,true);assert.equal(calls,2);assert.equal(w.game.player.inventory.some((i:any)=>i.id===oreId),false);
  assert.equal(request.item.type,'ore');assert.equal(request.quantity,2);assert.equal(w.localStorage.getItem('aethelgard_market_pending_'+w.game.player.userId),null);
  assert.equal(w.game.player.inventory.some((i:any)=>i.id==='herb'),true);
  request=null;
  await w.act(async()=>{select.value=serverId;select.dispatchEvent(new w.Event('change',{bubbles:true}));});
  await w.act(async()=>button('Выставить').click());
  assert.equal(request.item.type,'gloves');assert.equal(request.itemId,serverId);assert.equal(request.quantity,1);
  assert.equal(w.game.player.inventory.some((i:any)=>i.id===serverId),false);assert.equal(w.document.querySelector('[role=dialog]'),null);

 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
