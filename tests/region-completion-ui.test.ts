import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import fs from 'node:fs/promises';

for (const fantasy of [false,true]) test(`${fantasy?'fantasy':'modern'}: completed progress claims once, road selection travels, dangerous series earns fragment and D unlocks forest`,async()=>{
 const path=fantasy?'src/interfaces/fantasy/components/world/WorldScreen':'src/components/world/WorldScreen';
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {LocalGameProvider as GameProvider,useGame} from './src/context/GameContext';import {NavigationProvider} from './src/context/NavigationContext';import {WorldScreen} from './${path}';import {RegionCompletionReward} from './src/components/combat/RegionCompletionReward';import {REGIONS} from './src/data/gameData';function Probe(){window.game=useGame();return window.game.player?<><RegionCompletionReward region={REGIONS[0]}/><WorldScreen/></>:null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><NavigationProvider><Probe/></NavigationProvider></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'harness',setup(b){b.onLoad({filter:/GameModel\.ts$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('const [player, setPlayerState] = state<PlayerCharacter | null>("player", null);','const [player, setPlayerState] = state<PlayerCharacter | null>("player", null); (window as any).__setPlayer = setPlayerState;'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 let interval:(()=>void)|undefined;const timers:(()=>void)[]=[];w.setInterval=(fn:()=>void,ms:number)=>{if(ms===650)interval=fn;return 1;};w.clearInterval=()=>{};
 const originalTimeout=w.setTimeout.bind(w);w.setTimeout=(fn:()=>void,ms:number)=>[650,800].includes(ms)?(timers.push(fn),timers.length):originalTimeout(fn,ms);
 w.Math.random=()=>.99;w.eval(bundle.outputFiles[0].text);
 const button=(text:string)=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent.includes(text)) as any;
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Путник','warrior'));
  await w.act(async()=>w.__setPlayer({...w.game.player,level:5,energy:100,maxEnergy:100,gold:10,silver:20,arenaTickets:0,regionProgress:{reg_plains:{kills:6,eliteWins:2,bossWins:1}},adventureJournal:{unlocked:['first-boss']},attributes:{...w.game.player.attributes,strength:1000000}}));
  assert.ok(button('Забрать награду за освоение'));await w.act(async()=>button('Забрать награду за освоение').click());assert.equal(w.game.player.gold,210);assert.equal(w.game.player.silver,80);assert.equal(w.game.player.arenaTickets,1);assert.equal(w.game.player.adventureJournal.pending.chapter,'plains-complete');
  await w.act(async()=>w.game.claimRegionCompletion('reg_plains'));assert.equal(w.game.player.gold,210);
  await w.act(async()=>w.game.finishAdventureStory());assert.ok(w.game.player.adventureJournal.unlocked.includes('plains-complete'));
  let result:any;await w.act(async()=>{result=w.game.startTravel('reg_whisper_woods');});assert.equal(result.success,false);
  const road=w.document.querySelector('[data-hunting-mode=mod_dense_fog]');assert.ok(road);await w.act(async()=>road.click());assert.equal(w.game.player.activeRegionModId,'mod_standard','selection does not teleport');
  assert.ok(button('Отправиться в путь'));await w.act(async()=>button('Отправиться в путь').click());assert.equal(w.game.travelState.isTraveling,true);assert.equal(w.game.player.energy,94);
  for(let i=0;i<3;i++)await w.act(async()=>interval!());await w.act(async()=>timers.shift()!());assert.equal(w.game.travelState.isTraveling,false);assert.equal(w.game.player.activeRegionModId,'mod_dense_fog');
  const dummy={id:'test_road',name:'Цель',regionId:'reg_plains',level:2,hp:1,maxHp:1,mp:0,maxMp:0,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]};
  const count=()=>w.game.player.inventory.filter((i:any)=>i.templateId==='ascension_fragment').reduce((n:number,i:any)=>n+(i.stackCount||1),0);
  w.Math.random=()=>.5;const before=count();await w.act(async()=>w.game.startBattleWithMonster(dummy,{chain:true,energyCost:0}));
  let n=0;while(n++<10){await w.act(async()=>w.game.performPlayerAction('attack'));if(!w.game.combatChain.remaining)break;assert.equal(count(),before);await w.act(async()=>w.game.startNextCombatBattle());}
  assert.equal(count(),before+1,'one guaranteed fragment only at series completion');await w.act(async()=>w.game.exitCombat());
  w.Math.random=()=>.99;await w.act(async()=>w.__setPlayer({...w.game.player,ascension:{rank:'D',trialsWon:['D']}}));await w.act(async()=>{result=w.game.startTravel('reg_whisper_woods');});assert.equal(result.success,true);
  for(let i=0;i<3;i++)await w.act(async()=>interval!());await w.act(async()=>timers.shift()!());assert.equal(w.game.player.currentRegionId,'reg_whisper_woods');assert.ok(w.game.player.unlockedRegionIds.includes('reg_whisper_woods'));
  const savedGold=w.game.player.gold;await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());
  assert.ok(w.game.player.regionalRewardsClaimed.includes('reg_plains'));assert.ok(w.game.player.adventureJournal.unlocked.includes('plains-complete'));assert.ok(w.game.player.unlockedRegionIds.includes('reg_whisper_woods'));
  await w.act(async()=>w.game.claimRegionCompletion('reg_plains'));assert.equal(w.game.player.gold,savedGold,'reward remains consumed after reloading');
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
