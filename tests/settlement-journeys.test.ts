import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('real provider persists settlement/field/cave journeys, charges once and gates services and stale callbacks',async()=>{
 const b=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {NavigationProvider,useNavigation} from './src/context/NavigationContext';import {UnifiedBottomNavigation} from './src/components/navigation/UnifiedBottomNavigation';function Probe(){window.game=useGame();window.nav=useNavigation();return <UnifiedBottomNavigation currentTab={window.nav.currentTab} onSelectTab={window.nav.setCurrentTab}/>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><NavigationProvider><Probe/></NavigationProvider></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test',runScripts:'outside-only'}),w:any=dom.window;w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});w.Math.random=()=>.5;let clock=Date.now();w.Date.now=()=>clock;w.eval(b.outputFiles[0].text);
 const tick=async()=>w.act(async()=>new Promise(resolve=>setTimeout(resolve,190)));
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Путешественник','warrior'));
  await w.act(async()=>assert.equal(w.game.fishingAction('cast','river').success,false));const gold=w.game.player.gold,energy=w.game.player.energy;
  await w.act(async()=>w.nav.setCurrentTab('more'));assert.equal(w.nav.currentTab,'more','settings and journal do not require a town journey');
  await w.act(async()=>w.nav.setCurrentTab('leaderboard'));assert.equal(w.nav.currentTab,'leaderboard');assert.equal(w.game.player.energy,energy);assert.equal(w.game.player.worldPlace,'field');
  await w.act(async()=>w.nav.setCurrentTab('market'));assert.equal(w.nav.currentTab,'settlement');
  let result:any,duplicate:any;await w.act(async()=>{result=w.game.returnToSettlement();duplicate=w.game.returnToSettlement();});assert(result.success);assert(!duplicate.success);assert.equal(w.game.player.energy,energy);const townTrip=w.game.player.worldJourney;assert(townTrip);
  await w.act(async()=>w.root.unmount());clock=townTrip.startedAt+500;await w.act(async()=>w.mount());assert.equal(w.game.player.worldJourney.id,townTrip.id);await w.act(async()=>assert.equal(w.game.fishingAction('cast','river').success,false));
  clock=townTrip.arrivesAt+1;await tick();assert.equal(w.game.player.worldPlace,'settlement');assert.equal(w.game.player.worldJourney,undefined);assert.equal(w.game.player.gold,gold);assert.equal(w.game.player.energy,energy);assert.equal(w.document.querySelector('nav button').textContent,'Поселение');
  await w.act(async()=>w.nav.setCurrentTab('fishing'));assert.equal(w.nav.currentTab,'fishing');await w.act(async()=>{result=w.game.fishingAction('cast','river');});assert(result.success);await w.act(async()=>w.game.fishingAction('cancel'));const oldFish=w.game.fishingAction;
  await w.act(async()=>{result=w.game.startTravel('reg_plains','mod_standard');duplicate=w.game.startTravel('reg_plains','mod_standard');});assert(result.success);assert(!duplicate.success);assert.equal(w.game.player.energy,energy-5);await w.act(async()=>{result=oldFish('cast','river');});assert(!result.success);
  const fieldTrip=w.game.player.worldJourney;clock=fieldTrip.arrivesAt+1;await tick();assert.equal(w.game.player.worldPlace,'field');assert.equal(w.document.querySelector('nav button').textContent,'Охота');assert.equal(w.nav.currentTab,'hunter');await w.act(async()=>{result=oldFish('cast','river');});assert(!result.success);
  await w.act(async()=>w.game.returnToSettlement());clock=w.game.player.worldJourney.arrivesAt+1;await tick();const beforeCave=w.game.player.energy;
  await w.act(async()=>{result=w.game.enterDungeon('cave_bat');duplicate=w.game.enterDungeon('cave_bat');});assert(result);assert(!duplicate);assert.equal(w.game.player.energy,beforeCave-15);assert.equal(w.game.proceedDungeonRoom(),false);const run=JSON.stringify(w.game.activeDungeonRun),trip=w.game.player.worldJourney;
  await w.act(async()=>w.root.unmount());clock=trip.arrivesAt+1;await w.act(async()=>w.mount());await tick();assert.equal(w.game.player.worldPlace,'dungeon');assert.equal(JSON.stringify(w.game.activeDungeonRun),run);assert.equal(w.game.player.energy,beforeCave-15);await w.act(async()=>assert.equal(w.game.fishingAction('cast','river').success,false));
  await w.act(async()=>w.game.exitDungeon());await w.act(async()=>w.game.returnToSettlement());clock=w.game.player.worldJourney.arrivesAt+1;await tick();assert.equal(w.game.player.worldPlace,'settlement');assert.equal(w.game.player.gold,gold);
  await w.act(async()=>{result=w.game.fishingAction('cast','river');});assert(result.success);
  const key='aethelgard_save_v1_data_'+w.game.player.userId;const legacy=JSON.parse(w.localStorage.getItem(key));delete legacy.player.worldPlace;
  const legacyGold=legacy.player.gold,legacyEnergy=legacy.player.energy;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem(key,JSON.stringify(legacy));await w.act(async()=>w.mount());
  assert.equal(w.game.player.worldPlace,'settlement','a legacy fishing session remains finishable in town');assert.equal(w.game.player.gold,legacyGold);assert.equal(w.game.player.energy,legacyEnergy);
  await w.act(async()=>{result=w.game.fishingAction('cancel');});assert(result.success);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
