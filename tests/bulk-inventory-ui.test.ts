import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('Premium inventory bulk controls sell only confirmed matching gear and keep locked/rare/other types',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {BulkInventoryActions} from './src/components/inventory/BulkInventoryActions';function Probe(){window.game=useGame();return window.game.player?<BulkInventoryActions/>:null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'artwork',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as null|(()=>void)};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();
 let active=true;let failResponse=false;let request:any=null;let disposalCalls=0;
 w.fetch=async(path:string,options:any)=>{
  let result:any={ok:true,items:[],active};
  if(path==='/api/items/bulk-dispose'){
   disposalCalls++;const body=JSON.parse(options.body);
   if(request)assert.equal(body.operationId,request.operationId,'retry must keep the same operation ID');
   request=body;
   if(failResponse){failResponse=false;throw new Error('Lost response');}
   result={operationId:body.operationId,itemIds:[],gold:0,silver:0,ore:0,count:0};
  }
  return{ok:true,status:200,text:async()=>JSON.stringify(result)};
 };
 w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Испытатель','warrior'));
  const save=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
  const gear=(id:string,extra:any={})=>({id,templateId:'gear',name:id,type:'gloves',rarity:'common',level:1,upgradeLevel:0,icon:'',stats:{},sellPrice:10,disassembleYield:{silver:3,ore:1},...extra});
  save.player.inventory=[gear('ordinary'),gear('uncommon',{rarity:'uncommon'}),gear('rare',{rarity:'rare'}),gear('pants',{type:'pants'}),gear('locked',{isLocked:true}),gear('upgraded',{upgradeLevel:1})];save.player.equipped={};save.player.gold=100;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(save));await w.act(async()=>w.mount());
  const button=(text:string)=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent===text) as any;
  await w.act(async()=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent?.includes('Массовая продажа и разбор'))?.click());
  await w.act(async()=>button('Необычные').click());
  const select=w.document.querySelector('select');await w.act(async()=>{select.value='gloves';select.dispatchEvent(new w.Event('change',{bubbles:true}));});
  assert.ok(w.document.body.textContent.includes('Подходит: 2 вещей'));
  await w.act(async()=>button('Продать выбранное').click());
  assert.equal(w.document.querySelector('[role="dialog"]')!.querySelector('h3')!.textContent,'Продать 2 вещей?');
  failResponse=true;
  await w.act(async()=>button('Подтвердить').click());
  assert.equal(w.game.player.gold,100);assert.equal(w.game.player.inventory.length,6);
  assert.ok(w.localStorage.getItem('aethelgard_bulk_pending_'+w.game.player.userId));
  await w.act(async()=>button('Подтвердить').click());
  assert.equal(disposalCalls,2);assert.equal(w.game.player.gold,120);
  assert.deepEqual(w.game.player.inventory.map((i:any)=>i.id).sort().join(','),'locked,pants,rare,upgraded');
  assert.equal(w.localStorage.getItem('aethelgard_bulk_pending_'+w.game.player.userId),null);
  assert.equal(JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data')).player.gold,120);
  assert.equal(w.document.querySelector('[role="dialog"]'),null);
  assert.ok(w.document.body.textContent.includes('Продано вещей: 2'));
  // A free account cannot invoke the operation through the context either.
  active=false;await w.act(async()=>w.game.refreshPremiumStatus());
  let blocked:any;await w.act(async()=>{blocked=await w.game.bulkDisposeItems({rarities:['common'],type:'all',keepUpgraded:true},'sell');});
  assert.equal(blocked.success,false);assert.equal(disposalCalls,2);assert.ok(button('Подключить Premium'));
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
