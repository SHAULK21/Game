import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('real mining UI buys and equips a pickaxe, uses the vein maximum only on a crit and applies mining XP bonus',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {MiningScreen} from './src/components/mining/MiningScreen';function Probe(){window.game=useGame();return window.game.player?<MiningScreen/>:null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[localProgressPlugin,{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});
 Object.defineProperty(w.crypto,'randomUUID',{value:undefined,configurable:true});
 w.String.prototype.replaceAll=undefined;
 w.AudioContext=class {constructor(){throw new Error('Audio unavailable');}};
 w.Telegram={WebApp:{initData:'desktop-test',platform:'tdesktop',initDataUnsafe:{user:{id:1,first_name:'Игрок'}},HapticFeedback:{impactOccurred:()=>{throw new Error('Haptic unavailable');},notificationOccurred:()=>{throw new Error('Haptic unavailable');}}}};
 w.eval(bundle.outputFiles[0].text);
 try {
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Страж','warrior'));
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_1'));seed.player.gold=200000;seed.player.miningLevel=80;seed.player.miningExp=14000;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_1',JSON.stringify(seed));await w.act(async()=>w.mount());
  assert.ok(w.document.body.textContent.includes('Максимум жилы — редкий крит'));
  let bought:any;await w.act(async()=>{bought=w.game.buyPickaxe('pickaxe_legendary');});assert.equal(bought.success,true);assert.equal(w.game.player.gold,50000);
  const tool=w.game.player.inventory.find((i:any)=>i.type==='pickaxe');assert.ok(tool);
  const weapon=w.game.player.equipped.weapon?.id;
  await w.act(async()=>w.game.equipItem(tool));assert.equal(w.game.player.equipped.pickaxe.id,tool.id);assert.equal(w.game.player.equipped.weapon?.id,weapon);
  assert.ok(w.document.body.textContent.includes('+80% опыта'));
  let random=0;w.Math.random=()=>++random===1?0:.99;
  const before=w.game.player.miningExp;let result:any;
  await w.act(async()=>{result=w.game.mineNode('ore_coal');});assert.equal(result.yieldCount,7);assert.equal(result.isCrit,true);assert.equal(w.game.player.miningExp-before,14);
  const ore=w.game.player.inventory.find((i:any)=>i.templateId==='ore_coal' && i.rarity==='rare');assert.equal(ore.stackCount,7);
  await w.act(async()=>w.game.unequipItem('pickaxe'));assert.equal(w.game.player.equipped.pickaxe,undefined);
  w.Math.random=()=>.99;const xp=w.game.player.miningExp;
  await w.act(async()=>{result=w.game.mineNode('ore_coal');});assert.equal(result.yieldCount,6);assert.equal(result.isCrit,false);assert.equal(w.game.player.miningExp-xp,8);
  const button=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Добывать') as any;assert.ok(button);
  const stamina=w.game.player.stamina;
  await w.act(async()=>button.click());assert.equal(w.game.player.stamina,stamina-3);assert.ok(w.document.body.textContent.includes('Получено: 6'));
  assert.equal(button.disabled,true);await w.act(async()=>await new Promise(r=>setTimeout(r,550)));assert.equal(button.disabled,false);
  await w.act(async()=>button.click());assert.equal(w.game.player.stamina,stamina-6);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
