import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {ALCHEMY_TOOLS,makeAlchemyTool,alchemyExperience,alchemyExtraYield,alchemyProgress} from '../src/utils/alchemy';

test('retorts have bounded bonuses, profession gates and correct level progress',()=>{
 for(const offer of ALCHEMY_TOOLS){
  const tool=makeAlchemyTool(offer.id,offer.id);
  assert.deepEqual(tool.stats,{});
  assert.equal(alchemyExtraYield(tool,offer.alchemyLevel,()=>0),1);
  assert.equal(alchemyExtraYield(tool,offer.alchemyLevel,()=>offer.extraChance/100),0);
  assert.equal(alchemyExperience(100,tool,offer.alchemyLevel),100+offer.expBonus);
  if(offer.alchemyLevel>1){assert.equal(alchemyExtraYield(tool,offer.alchemyLevel-1,()=>0),0);assert.equal(alchemyExperience(100,tool,offer.alchemyLevel-1),100);}
  assert.ok(offer.extraChance<=5);
 }
 assert.equal(alchemyExtraYield(undefined,100,()=>0),0);
 assert.deepEqual(alchemyProgress(2,230),{current:10,need:220,percent:5,maxed:false});
 assert.equal(alchemyProgress(100,21780).percent,100);
});

test('alchemy UI buys, equips, crafts once, preserves other items and XP; combat shows only the final series card',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {AlchemyScreen} from './src/components/alchemy/AlchemyScreen';import {CombatScreen} from './src/components/combat/CombatScreen';function Probe(){window.game=useGame();return window.game.player?(window.game.isInCombat?<CombatScreen/>:<AlchemyScreen/>):null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});
 w.eval(bundle.outputFiles[0].text);
 try {
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Алхимик','warrior'));
  assert.equal(w.game.buyAlchemyTool('retort_legendary').success,false);
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));seed.player.gold=200000;seed.player.alchemyLevel=80;seed.player.alchemyExp=80*220-1;seed.player.attributes.strength=1000000;seed.player.inventory.find((item:any)=>item.name==='Уголь').stackCount=20;
  seed.player.inventory.push({id:'keep',name:'Памятная вещь',type:'material',rarity:'common',level:1,upgradeLevel:0,icon:'✦',stats:{},sellPrice:0,disassembleYield:{}});
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await w.act(async()=>w.mount());
  const baseline=JSON.parse(JSON.stringify(w.game.combatStats));let result:any;
  await w.act(async()=>{result=w.game.buyAlchemyTool('retort_legendary');});assert.equal(result.success,true);assert.equal(w.game.player.gold,50000);
  const tool=w.game.player.inventory.find((i:any)=>i.type==='alchemyTool');const weapon=w.game.player.equipped.weapon.id;
  await w.act(async()=>w.game.equipItem(tool));assert.equal(w.game.player.equipped.alchemyTool.id,tool.id);assert.equal(w.game.player.equipped.weapon.id,weapon);assert.deepEqual(JSON.parse(JSON.stringify(w.game.combatStats)),baseline);
  assert.ok(w.document.body.textContent.includes('+80% опыта'));assert.ok(w.document.body.textContent.includes('219 / 220 EXP'));
  const before=w.game.player.alchemyExp;const energy=w.game.player.alchemyEnergy;const count=w.game.player.statsSummary.potionsCrafted;
  const button=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Сварить · 4 ⚗') as any;
  w.Math.random=()=>0;
  await w.act(async()=>{button.click();button.click();});
  assert.equal(w.game.player.alchemyExp,before+11);assert.equal(w.game.player.alchemyLevel,81);assert.equal(w.game.player.alchemyEnergy,energy-4);assert.equal(w.game.player.statsSummary.potionsCrafted,count+3);assert.ok(w.game.player.inventory.some((i:any)=>i.id==='keep'));assert.ok(w.document.body.textContent.includes('10 / 220 EXP'));
  await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());assert.equal(w.game.player.equipped.alchemyTool.id,tool.id);assert.equal(w.game.player.alchemyExp,before+11);
  await w.act(async()=>w.game.unequipItem('alchemyTool'));const exp=w.game.player.alchemyExp;await w.act(async()=>{result=w.game.craftAlchemy('alc_hp_small');});assert.equal(result,true);assert.equal(w.game.player.alchemyExp,exp+6);
  const monster={id:'series_test',name:'Манекен',regionId:'reg_plains',level:1,hp:10,maxHp:10,mp:0,maxMp:0,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:10,goldReward:10,drops:[]};
  w.Math.random=()=>.5;await w.act(async()=>w.game.startBattleWithMonster(monster,{chain:true,energyCost:0}));
  const initialGold=w.game.player.gold,initialSilver=w.game.player.silver;const length=w.game.combatChain.total;assert.ok(length>1);let gold=0,silver=0,xp=0;
  for(let i=0;i<length;i++){
   await w.act(async()=>w.game.performPlayerAction('attack'));assert.equal(w.game.combatOutcome,'victory');
   if(i<length-1){
    gold+=w.game.lastCombatReward.gold;silver+=w.game.lastCombatReward.silver;xp+=w.game.lastCombatReward.exp;
    assert.equal(w.document.body.textContent.includes('Получено за бой'),false);assert.equal(w.document.body.textContent.includes('Награда за серию'),false);
    const next=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent.trim()==='Следующий противник') as any;assert.ok(next);assert.equal(next.textContent.includes('бесплатно'),false);
    await w.act(async()=>next.click());
   }else{assert.ok(w.document.body.textContent.includes('Награда за серию'));assert.ok(w.game.lastCombatReward.gold>=gold);assert.ok(w.game.lastCombatReward.silver>=silver);assert.ok(w.game.lastCombatReward.exp>xp);assert.equal(w.game.lastCombatReward.gold,w.game.player.gold-initialGold);assert.equal(w.game.lastCombatReward.silver,w.game.player.silver-initialSilver);const loggedXp=w.game.battleLog.filter((entry:any)=>entry.id.startsWith('reward_')).reduce((sum:number,entry:any)=>sum+Number(entry.text.match(/\+(\d+) EXP/)[1]),0);assert.equal(w.game.lastCombatReward.exp,loggedXp);}
  }
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
