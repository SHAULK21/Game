import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {JSDOM} from 'jsdom';
import {potionDamage,isRestorationPotion,potionActionLabel,THROWING_RECIPES} from '../src/utils/combatPotions';

test('throwing recipes and turn labels distinguish restorative, buff and damage potions',()=>{
 const item:any={type:'potion',stats:{heal:120,manaRestore:60}};assert(isRestorationPotion(item));assert(!potionDamage(item));assert.equal(potionActionLabel(item,'warrior'),'Не расходует ход');
 assert(isRestorationPotion({...item,stats:{healFull:1,invulnerable:1}}));assert(!isRestorationPotion({...item,stats:{attackPercent:25}}));
 assert(!isRestorationPotion({...item,stats:{fireDamage:90}}));assert.equal(potionDamage({...item,stats:{fireDamage:90}})?.damageType,'fire');
 for(const recipe of THROWING_RECIPES){assert(recipe.ingredients.length);assert(potionDamage({type:'potion',stats:recipe.resultStats} as any));}
 assert(potionActionLabel({...item,stats:{fireDamage:90}},'rogue').includes('113'));
});

test('real provider: free restoration preserves effects and cooldowns; throws use a turn, resistances and rogue bonus; autobattle keeps player cadence and uses bounded monster preparation',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {LocalGameProvider as GameProvider,useGame} from './src/context/GameContext';function Probe(){window.game=useGame();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:true,items:[],ok:true})});w.eval(bundle.outputFiles[0].text);
 const target:any={id:'potion_test',name:'Цель',regionId:'arena',level:1,hp:10000,maxHp:10000,mp:100,maxMp:100,attack:70,magicAttack:70,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:1,goldReward:1,drops:[]};
 const pot=(id:string,stats:any)=>({id,templateId:id,name:id==='restore'?'Настой':'Огненная склянка',type:'potion',rarity:'common',level:1,upgradeLevel:0,icon:'',stats,stackCount:2,sellPrice:1,disassembleYield:{silver:1}});
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Алхимик','rogue'));w.Math.random=()=>.5;
  let seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));seed.player.inventory.push(pot('restore',{heal:10,manaRestore:10}),pot('bomb',{fireDamage:90}));
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await w.act(async()=>w.mount());
  let crafted=false;await w.act(async()=>{crafted=w.game.craftAlchemy('alc_throw_fire');});assert(crafted);assert.equal(w.game.player.inventory.find((i:any)=>i.templateId==='alc_throw_fire').stats.fireDamage,90);
  const poisoned={...target,skills:[{id:'poison',name:'Яд',damageType:'poison',damageMultiplier:1,manaCost:0,cooldown:3,currentCooldown:0,effect:'poison',effectDuration:3,effectPower:8}]};
  await w.act(async()=>w.game.startBattleWithMonster(poisoned,{chain:false,energyCost:0}));
  await w.act(async()=>w.game.performPlayerAction('skill','r_strike'));
  await w.act(async()=>await new Promise(r=>setTimeout(r,1100)));await w.act(async()=>await new Promise(r=>setTimeout(r,1100)));
  assert.equal(w.game.turnPhase,'player');assert(w.game.combatPlayerHp<w.game.combatStats.maxHp);assert(w.game.playerEffects.some((e:any)=>e.type==='poison'));
  const before={round:w.game.combatRound,hp:w.game.combatPlayerHp,mp:w.game.combatPlayerMp,effects:JSON.stringify(w.game.playerEffects),skills:JSON.stringify(w.game.player.skills),enemy:w.game.activeMonster.hp};
  await w.act(async()=>{w.game.performPlayerAction('potion','restore');w.game.performPlayerAction('potion','restore');});
  assert.equal(w.game.turnPhase,'player');assert.equal(w.game.combatRound,before.round);assert.equal(w.game.combatPlayerHp,Math.min(w.game.combatStats.maxHp,before.hp+10));assert.equal(w.game.combatPlayerMp,Math.min(w.game.combatStats.maxMp,before.mp+10));assert.equal(JSON.stringify(w.game.playerEffects),before.effects);assert.equal(JSON.stringify(w.game.player.skills),before.skills);assert.equal(w.game.activeMonster.hp,before.enemy);assert.equal(w.game.player.inventory.find((i:any)=>i.id==='restore').stackCount,1);
  await w.act(async()=>w.game.exitCombat());await w.act(async()=>w.game.dismissFlightWarning());await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  const hp=w.game.activeMonster.hp;await w.act(async()=>{w.game.performPlayerAction('potion','bomb');w.game.performPlayerAction('potion','bomb');});assert.equal(hp-w.game.activeMonster.hp,113);assert.equal(w.game.turnPhase,'monster');assert.equal(w.game.player.inventory.find((i:any)=>i.id==='bomb').stackCount,1);
  await w.act(async()=>w.game.exitCombat());await w.act(async()=>w.game.startBattleWithMonster({...target,hp:30,maxHp:30},{chain:false,energyCost:0}));await w.act(async()=>w.game.performPlayerAction('potion','bomb'));assert.equal(w.game.combatOutcome,'victory');assert.equal(w.game.activeMonster.hp,0);assert(!w.game.player.inventory.some((i:any)=>i.id==='bomb'));
  await w.act(async()=>w.game.exitCombat());
  seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));seed.player.classId='warrior';seed.player.inventory.push(pot('bomb',{fireDamage:90}));await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await w.act(async()=>w.mount());
  await w.act(async()=>w.game.startBattleWithMonster({...target,resistances:{fire:50}},{chain:false,energyCost:0}));const resistantHp=w.game.activeMonster.hp;await w.act(async()=>w.game.performPlayerAction('potion','bomb'));assert.equal(resistantHp-w.game.activeMonster.hp,45);
  await w.act(async()=>w.game.exitCombat());await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  await w.act(async()=>w.game.exitCombat());
  seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));seed.player.inventory.push(pot('venom',{poisonDamage:220}));await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await w.act(async()=>w.mount());
  await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  const venomStartHp=w.game.activeMonster.hp;
  await w.act(async()=>w.game.performPlayerAction('potion','venom'));
  assert.equal(w.game.monsterEffects.find((e:any)=>e.type==='poison').value,33);
  assert.equal(w.game.battleLog.find((e:any)=>e.id.startsWith('throw_')&&e.impact)?.impact.amount,220);
  await w.act(async()=>await new Promise(r=>setTimeout(r,1100)));
  const dot=w.game.battleLog.find((e:any)=>e.impact?.periodic==='poison');assert(dot);assert.equal(dot.impact.amount,33);assert.equal(dot.impact.target,'monster');assert.equal(w.game.activeMonster.hp,venomStartHp-253);
  await w.act(async()=>w.game.exitCombat());await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  const timers:number[]=[];const native=w.setTimeout.bind(w);w.setTimeout=(fn:any,ms:number,...args:any[])=>{timers.push(ms);return native(fn,ms,...args);};
  await w.act(async()=>w.game.updateAutoBattleSettings({enabled:true,useSkills:false,healAtHpPercent:0}));await w.act(async()=>await new Promise(r=>setTimeout(r,650)));assert.equal(w.game.turnPhase,'monster');assert(timers.includes(600));assert(timers.some(ms=>ms>=100 && ms<=250));assert(!timers.includes(750));
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
