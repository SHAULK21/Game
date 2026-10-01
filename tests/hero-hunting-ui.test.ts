import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('hero groups preserve stats; hunting modes scale and freeze each enemy while rank bosses stay fixed',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {CharacterScreen} from './src/components/character/CharacterScreen';import {REGION_MODIFIERS} from './src/data/gameData';import {applyHuntingMode,combatHuntingMode} from './src/utils/huntingModes';window.modes=REGION_MODIFIERS;window.applyMode=applyHuntingMode;window.modeFor=combatHuntingMode;function Probe(){window.game=useGame();return window.game.player?<CharacterScreen/>:null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});
 w.eval(bundle.outputFiles[0].text);
 try {
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Страж','warrior'));
  const baseline=JSON.parse(JSON.stringify(w.game.combatStats));
  for(const title of ['Критические удары и пробитие','Точность, уклонение и темп','Восстановление','Бонусы наград','Сопротивления']){
   const summary=[...w.document.querySelectorAll('summary')].find((s:any)=>s.textContent===title) as any;assert.ok(summary);assert.equal(summary.parentElement.open,false);await w.act(async()=>summary.click());assert.equal(summary.parentElement.open,true);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
  const monster={id:'mode_test',name:'Манекен',regionId:'reg_plains',level:1,hp:100,maxHp:100,mp:0,maxMp:0,attack:10,magicAttack:5,defense:10,magicDefense:5,speed:1,critChance:0,evasion:0,avatar:'',expReward:1,goldReward:1,drops:[]};
  let standardHp=0,standardDefense=0;
  for(const id of ['mod_standard','mod_sanctuary','mod_dense_fog','mod_blood_moon','mod_abyss_curse']){
   let started=false;await w.act(async()=>{started=w.game.startBattleWithMonster(monster,{chain:true,energyCost:0,huntingModeId:id});});assert.equal(started,true);
   const mode=w.modes[id];assert.equal(w.game.activeMonster.huntingModeId,id);
   if(id==='mod_standard'){standardHp=w.game.activeMonster.maxHp;standardDefense=w.game.activeMonster.defense;}
   else{assert.equal(w.game.activeMonster.maxHp,Math.round(standardHp*mode.hpMultiplier));assert.equal(w.game.activeMonster.defense,Math.round(standardDefense*mode.defenseMultiplier));}
   assert.equal(w.modeFor(w.game.activeMonster).damageMultiplier,mode.damageMultiplier);
   await w.act(async()=>w.game.setActiveRegionMod('mod_standard'));assert.equal(w.modeFor(w.game.activeMonster).id,id,'mode remains fixed during the fight');
   await w.act(async()=>w.game.exitCombat());
  }
  for(const regionId of ['ascension','arena','dungeon_test']){const special={...monster,regionId};assert.equal(w.applyMode(special,w.modes.mod_abyss_curse),special);assert.equal(w.modeFor(special).id,'mod_standard');}
  await w.act(async()=>w.game.challengeAscension());assert.equal(w.game.activeMonster.maxHp,1800);assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
