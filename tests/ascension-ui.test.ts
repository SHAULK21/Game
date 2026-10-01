import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('real ascension arena preserves combat stats, records victory without XP and persists new skills across reload',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {AscensionArena} from './src/components/arena/AscensionArena';import {CombatScreen} from './src/components/combat/CombatScreen';function Probe(){window.game=useGame();const [combat,setCombat]=useState(false);return window.game.player?(combat?<CombatScreen onReturnToArena={()=>setCombat(false)}/>:<AscensionArena onEnterCombatTab={()=>setCombat(true)}/>):null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
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
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));seed.player.silver=10000;seed.player.attributes.strength=1000000;seed.player.inventory.push({id:'frag',templateId:'ascension_fragment',name:'Осколок вознесения',type:'material',rarity:'rare',level:1,upgradeLevel:0,icon:'✦',stats:{},sellPrice:0,disassembleYield:{},stackCount:100});
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(seed));await w.act(async()=>w.mount());
  const baseline=JSON.parse(JSON.stringify(w.game.combatStats));const originalLevel=w.game.player.level;const originalXp=w.game.player.exp;const originalRating=w.game.player.arenaRating;const originalGold=w.game.player.gold;const tickets=w.game.player.arenaTickets;
  const button=(text:string)=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent===text) as any;
  assert.equal(button('Вознестись до D').disabled,true);
  await w.act(async()=>button('Вызвать хранителя D').click());assert.equal(w.game.activeMonster.regionId,'ascension');assert.equal(w.game.activeMonster.maxHp,1800);assert.equal(w.game.player.arenaTickets,tickets-1);
  w.Math.random=()=>.5;await w.act(async()=>w.game.performPlayerAction('attack'));assert.equal(w.game.combatOutcome,'victory');assert.ok(w.game.player.ascension.trialsWon.includes('D'));assert.equal(w.game.player.exp,originalXp);assert.equal(w.game.player.arenaRating,originalRating);assert.equal(w.game.player.gold,originalGold);assert.equal(w.game.lastCombatReward.items.length,0);
  assert.ok(button('Вернуться на арену'));assert.equal([...w.document.querySelectorAll('button')].some((b:any)=>b.textContent.includes('Новая серия')),false);
  await w.act(async()=>button('Вернуться на арену').click());assert.equal(w.game.isInCombat,false);assert.ok(w.document.body.textContent.includes('Выберите пассивку выше.'));assert.equal(button('Вознестись до D').disabled,true);
  await w.act(async()=>w.document.querySelectorAll('input[type=radio]')[1].click());assert.equal(button('Вознестись до D').disabled,false);
  await w.act(async()=>button('Вознестись до D').click());assert.ok(w.document.querySelector('[role=dialog]'));await w.act(async()=>button('Подтвердить вознесение').click());
  assert.equal(w.game.player.ascension.rank,'D');assert.equal(w.game.player.level,originalLevel);assert.equal(w.game.player.silver,9500);assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
  await w.act(async()=>button('Вызвать хранителя C').click());assert.equal(w.game.activeMonster.maxHp,4800);await w.act(async()=>w.game.performPlayerAction('attack'));assert.ok(w.game.player.ascension.trialsWon.includes('C'));
  await w.act(async()=>button('Вернуться на арену').click());
  await w.act(async()=>button('Вознестись до C').click());await w.act(async()=>button('Подтвердить вознесение').click());assert.equal(w.game.player.ascension.rank,'C');assert.ok(w.game.player.skills.some((s:any)=>s.id==='asc_warrior_C'));assert.equal(w.game.player.level,originalLevel);assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
  const savedSkills=w.game.player.skills.map((s:any)=>s.id);
  await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());assert.equal(w.game.player.ascension.rank,'C');assert.deepEqual(w.game.player.skills.map((s:any)=>s.id),savedSkills);assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
  const dummy={id:'dummy',name:'Манекен',regionId:'test',level:1,hp:10000000,maxHp:10000000,mp:0,maxMp:0,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]};
  await w.act(async()=>w.game.startBattleWithMonster(dummy,{chain:false,energyCost:0}));await w.act(async()=>w.game.performPlayerAction('skill','asc_warrior_C'));assert.ok(w.game.battleLog.some((e:any)=>e.text.includes('Рассекающий натиск')));assert.equal(w.game.player.skills.find((s:any)=>s.id==='asc_warrior_C').currentCooldown,4);
  const echoSave=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));echoSave.player.ascension={rank:'SSS',primary:'ward',secondary:'flow',trialsWon:[]};echoSave.player.arenaTickets=5;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(echoSave));await w.act(async()=>w.mount());
  const silver=w.game.player.silver;let started:any;await w.act(async()=>{started=w.game.challengeAscension('control');});assert.equal(started.success,true);
  const potions=w.game.player.inventory.filter((i:any)=>i.type==='potion').reduce((n:number,i:any)=>n+(i.stackCount||1),0);
  await w.act(async()=>w.game.performPlayerAction('potion'));assert.equal(w.game.turnPhase,'player');assert.equal(w.game.player.inventory.filter((i:any)=>i.type==='potion').reduce((n:number,i:any)=>n+(i.stackCount||1),0),potions);
  await w.act(async()=>w.game.performPlayerAction('attack'));assert.equal(w.game.combatOutcome,'victory');assert.equal(w.game.player.silver,silver+3000);assert.equal(w.game.lastCombatReward.silver,3000);assert.equal(w.game.challengeAscension('control').success,false);assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
