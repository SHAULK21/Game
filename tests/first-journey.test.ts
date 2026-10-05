import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
test('new heroes start one free fight, open the codex after victory or flee, spend points and never repeat on reload',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import{GameProvider,useGame}from'./src/context/GameContext';import{NavigationProvider,useNavigation}from'./src/context/NavigationContext';function Probe(){window.game=useGame();window.nav=useNavigation();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><NavigationProvider><Probe/></NavigationProvider></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}],bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 const nativeTimer=w.setTimeout.bind(w);w.setTimeout=(fn:any,ms:number,...args:any[])=>nativeTimer(fn,Math.min(ms||0,5),...args);
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();w.Math.random=()=>0;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({resetVersion:0,active:false,items:[],ok:true})});w.eval(bundle.outputFiles[0].text);
 const settle=()=>w.act(async()=>{await new Promise(r=>setTimeout(r,20));});
 try {
  await w.act(async()=>w.mount());
  for(const cls of ['warrior','berserker','knight','rogue','assassin','archer','mage','necromancer','paladin','druid']){
   await w.act(async()=>w.game.createCharacter('Новобранец',cls,true));await settle();
   assert.equal(w.game.isInCombat,true,cls);assert.equal(w.game.player.firstJourney,'battle');assert.equal(w.game.combatChain,null);assert.equal(w.game.player.energy,60);assert.equal(w.nav.isCharacterSheetOpen,false);
   if(cls==='warrior'){
    const id=w.game.player.id;await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());await settle();assert.equal(w.game.player.id,id);assert.equal(w.game.isInCombat,true);assert.equal(w.game.player.energy,60);
    for(let n=0;n<100&&w.game.player.firstJourney!=='done';n++){
     if(w.game.turnPhase==='player')await w.act(async()=>w.game.performPlayerAction('attack'));
     await settle();
    }
    assert.equal(w.game.player.statsSummary.battlesWon,1);assert(w.game.lastCombatReward?.exp>0);
   }else{await w.act(async()=>w.game.performPlayerAction('flee'));await settle();}
   assert.equal(w.game.player.firstJourney,'done',cls);assert.equal(w.nav.isCharacterSheetOpen,true,cls);assert.equal(w.game.isInCombat,false);assert.equal(w.game.activeMonster,null);
   const points=w.game.player.statPoints,strength=w.game.player.attributes.strength;await w.act(async()=>w.game.allocateAttribute('strength'));assert.equal(w.game.player.statPoints,points-1);assert.equal(w.game.player.attributes.strength,strength+1);
   if(cls==='warrior') {
    while(w.game.player.statPoints>0) await w.act(async()=>w.game.allocateAttribute('strength'));
    assert.equal(w.nav.isCharacterSheetOpen,false);assert.equal(w.game.player.firstJourneyDeparture,true);assert.equal(w.game.travelState.isTraveling,false);
    await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());await settle();
    assert.equal(w.game.player.firstJourneyDeparture,true);assert.equal(w.game.player.statPoints,0);assert.equal(w.game.isInCombat,false);
    const energy=w.game.player.energy;
    await w.act(async()=>w.game.startFirstJourneyDeparture());const started=w.game.player.firstJourneyDepartureStartedAt;
    await w.act(async()=>w.game.startFirstJourneyDeparture());assert.equal(w.game.player.firstJourneyDepartureStartedAt,started);assert.equal(w.game.travelState.isTraveling,true);assert.equal(w.game.player.energy,energy);
    await w.act(async()=>w.root.unmount());const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));seed.player.firstJourneyDepartureStartedAt=Date.now()-3500;w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(seed));
    await w.act(async()=>w.mount());await settle();assert.equal(w.game.player.firstJourneyDeparture,false);assert.equal(w.game.travelState.isTraveling,false);assert.equal(w.game.player.currentRegionId,'reg_plains');assert.equal(w.game.player.energy,energy);assert.equal(w.game.isInCombat,false);
    await w.act(async()=>w.game.startFirstJourneyDeparture());assert.equal(w.game.player.firstJourneyDepartureStartedAt,undefined);
   }
   await w.act(async()=>w.nav.setIsCharacterSheetOpen(false));await settle();assert.equal(w.nav.isCharacterSheetOpen,false);assert.equal(w.game.isInCombat,false);
  }
  const last=w.game.player.id;await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());await settle();assert.equal(w.game.player.id,last);assert.equal(w.game.player.firstJourney,'done');assert.equal(w.game.isInCombat,false);assert.equal(w.nav.isCharacterSheetOpen,false);
  await w.act(async()=>w.game.createCharacter('Старый сценарий','warrior'));await settle();assert.equal(w.game.isInCombat,false,'existing/programmatic creation can explicitly omit onboarding');
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
