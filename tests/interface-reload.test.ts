import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import fs from 'node:fs/promises';
const bundle=build({stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import{InterfaceProvider,useInterface}from'./src/context/InterfaceContext';import{GameProvider,useGame}from'./src/context/GameContext';import{GameInterfaceBridge}from'./src/context/GameInterfaceBridge';import{InterfaceSwitcher}from'./src/components/ui/InterfaceSwitcher';function Probe(){window.game=useGame();window.theme=useInterface();return <InterfaceSwitcher/>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<InterfaceProvider reload={()=>{window.reloads++;window.atReload=JSON.parse(localStorage.getItem('aethelgard_save_v1_data_749219401')||'null');}}><GameProvider><GameInterfaceBridge/><Probe/></GameProvider></InterfaceProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('const [player, setPlayerState] = useState<PlayerCharacter | null>(null);','const [player, setPlayerState] = useState<PlayerCharacter | null>(null); (window as any).__setPlayer = setPlayerState;'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
async function setup(style='modern'){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.reloads=0;
 const empty={items:[],ok:true,active:false};w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(empty)});if(style!=='missing')w.localStorage.setItem('aethelgard_interface_style',style);w.eval((await bundle).outputFiles[0].text);
 await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Сохранённый','warrior',false));
 return {w,close:async()=>{await w.act(async()=>w.root.unmount());dom.window.close();}};
}
const stable=(p:any)=>JSON.stringify({...p,lastActiveTimestamp:0});
for(const from of ['modern','fantasy','fantasy-beta'])for(const to of ['modern','fantasy','fantasy-beta'].filter(s=>s!==from))test(`${from} → ${to}: durable save precedes reload and a fresh provider restores the same character`,async()=>{
 const h=await setup(from),w=h.w;try{
  const before=w.game.player;await w.act(async()=>{assert(w.game.buyBasicConsumable('pot_hp_small',5));assert(w.theme.setStyle(to));});
  assert.equal(w.reloads,1);assert.equal(w.atReload.player.gold,before.gold-5);assert.equal(w.atReload.player.id,before.id);assert.equal(w.localStorage.getItem('aethelgard_interface_style'),to);assert.equal(w.theme.style,from);assert.equal(w.document.documentElement.dataset.interface,from);
  const saved=w.atReload.player;await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());assert.equal(w.theme.style,to);assert.equal(stable(w.game.player),stable(saved));
  await w.act(async()=>w.theme.setStyle(to));assert.equal(w.reloads,1,'active interface is a no-op');
 }finally{await h.close();}
});
test('missing and invalid interface preferences fall back to modern',async()=>{for(const style of ['missing','unknown','null']){const h=await setup(style);try{assert.equal(h.w.theme.style,'modern');}finally{await h.close();}}});
test('unfinished combat and travel block both controls and direct switch calls',async()=>{
 const h=await setup(),w=h.w;try{
  await w.act(async()=>w.game.startBattleWithMonster({id:'guard',regionId:'arena',name:'Цель',level:1,hp:100,maxHp:100,mp:0,maxMp:0,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,expReward:1,goldReward:1,drops:[]},{energyCost:0}));
  await w.act(async()=>assert.equal(w.theme.setStyle('fantasy'),false));assert.match(w.theme.blockReason,/боя/);assert.equal(w.reloads,0);assert([...w.document.querySelectorAll('button')].filter((b:any)=>!b.lang && b.getAttribute('aria-pressed')==='false').every((b:any)=>b.disabled));
  await w.act(async()=>w.game.performPlayerAction('flee'));assert(w.game.isCombatEnded);
  await w.act(async()=>{const r=w.game.startTravel('reg_plains');assert(r.success,r.message);});
  await w.act(async()=>assert.equal(w.theme.setStyle('fantasy'),false));assert.match(w.theme.blockReason,/путешествия/);assert.equal(w.reloads,0);
 }finally{await h.close();}
});
test('server item operation remains blocked through inventory reconciliation, then saves the result',async()=>{
 const h=await setup(),w=h.w;let equipResolve:any,inventoryResolve:any;try{
  const item={...w.game.player.equipped.weapon,id:'server_weapon',serverOwned:true,isEquipped:false};await w.act(async()=>w.__setPlayer({...w.game.player,inventory:[item]}));
  w.fetch=async(url:string)=>new Promise(resolve=>{if(url.includes('/equip'))equipResolve=()=>resolve({ok:true,status:200,text:async()=>'{"ok":true}'});else inventoryResolve=()=>resolve({ok:true,status:200,text:async()=>JSON.stringify({items:[{id:item.id,item_json:item,quantity:1,locked:false,equipped_slot:'weapon'}]})});});
  let operation:Promise<any>;await w.act(async()=>{operation=w.game.equipItem(item);assert.equal(w.theme.setStyle('fantasy'),false);});assert.match(w.theme.blockReason,/предметами/);
  await w.act(async()=>equipResolve());await w.act(async()=>assert.equal(w.theme.setStyle('fantasy'),false));assert.equal(w.reloads,0);
  await w.act(async()=>{inventoryResolve();assert((await operation!).success);});await w.act(async()=>assert(w.theme.setStyle('fantasy')));assert.equal(w.atReload.player.equipped.weapon.id,item.id);
 }finally{await h.close();}
});
test('storage failure preserves the current mode and prevents reload; reset epochs cannot save an old hero',async()=>{
 const h=await setup(),w=h.w;const original=w.Storage.prototype.setItem;try{
  w.Storage.prototype.setItem=function(key:string,value:string){if(key.startsWith('aethelgard_save_v1_data'))throw new w.DOMException('Full','QuotaExceededError');return original.call(this,key,value);};
  await w.act(async()=>assert.equal(w.theme.setStyle('fantasy'),false));assert.equal(w.reloads,0);assert.equal(w.theme.style,'modern');assert.equal(w.localStorage.getItem('aethelgard_interface_style'),'modern');assert.match(w.theme.error,/сохранить прогресс/);
  w.Storage.prototype.setItem=original;w.localStorage.setItem('aethelgard_reset_version_749219401','2');await w.act(async()=>assert.equal(w.theme.setStyle('fantasy'),false));assert.equal(w.reloads,0);assert.match(w.theme.error,/Аккаунт изменился/);
 }finally{w.Storage.prototype.setItem=original;await h.close();}
});
