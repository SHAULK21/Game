import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { canDrinkBeer, drinkTavernBeer, normalizeIntoxication, intoxicationPercent } from '../src/utils/tavernBeer';
import { flightBattlesLeft } from '../src/utils/flightPenalty';
import { fixturePlace, completeJourney } from './helpers/worldPlace';

test('beer preserves full-energy limits, replaces shame, stacks without currency, and validates persisted intoxication', () => {
  const base:any = {energy:55,maxEnergy:60,gold:200,silver:300,hp:11,mp:12,flightPenalty:{battlesLeft:3,warningSeen:true,warningPending:false}};
  let p=drinkTavernBeer(base); assert.equal(p.energy,60); assert.equal(flightBattlesLeft(p),0);assert.equal(p.intoxication.mugs,1);
  assert.equal(p.gold,200);assert.equal(p.silver,300);assert.equal(p.hp,11);assert.equal(p.mp,12);assert(p.flightPenalty.warningSeen);
  assert(!canDrinkBeer(p));assert.equal(drinkTavernBeer(p),p);
  p=drinkTavernBeer({...p,flightPenalty:{...p.flightPenalty,battlesLeft:3}});assert.equal(p.energy,60);assert.equal(intoxicationPercent(p),10);
  for(let i=0;i<25;i++)p=drinkTavernBeer({...p,energy:0});assert.equal(intoxicationPercent(p),50);assert.equal(p.intoxication.battlesLeft,3);
  assert.equal(normalizeIntoxication({mugs:Infinity,battlesLeft:3}),undefined);
  assert.equal(normalizeIntoxication({mugs:2,battlesLeft:NaN}),undefined);
  assert.equal(normalizeIntoxication({mugs:-3,battlesLeft:3}),undefined);
  assert.deepEqual(normalizeIntoxication({mugs:200,battlesLeft:999}),{mugs:10,battlesLeft:3});
});

test('real provider and tavern enforce location, reload, stacked combat penalties, first-flight artwork and three completed encounters',async()=>{
 const b=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {NavigationProvider} from './src/context/NavigationContext';import {TavernScreen} from './src/components/settlement/TavernScreen';import {FlightWarning} from './src/components/dialogs/FlightWarning';import {FlightPenaltyNotice} from './src/components/combat/FlightPenaltyNotice';import {setLanguage} from './src/i18n/locale';function Probe(){window.game=useGame();return window.game.player?<><TavernScreen><p>Chat remains available</p></TavernScreen><FlightPenaltyNotice/>{window.game.player.flightPenalty?.warningPending&&<FlightWarning/>}</>:null;}window.act=act;window.setLanguage=setLanguage;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><NavigationProvider><Probe/></NavigationProvider></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});w.Math.random=()=>.5;
 const clock=Date.now();w.Date.now=()=>clock;w.eval(b.outputFiles[0].text);
 const act=async(fn:()=>void)=>w.act(async()=>fn());
 const enemy:any={id:'beer-test',name:'Цель',regionId:'arena',level:1,hp:1,maxHp:1,mp:0,maxMp:0,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]};
 const key=()=> 'aethelgard_save_v1_data_'+w.game.player.userId;
 const beer=()=>w.document.querySelector('[data-drink-beer]');
 try{
  await act(()=>w.mount());await act(()=>w.game.createCharacter('Таверна','warrior'));assert.equal(w.game.meditateOrRefillEnergy,undefined);
  const initialEnergy=w.game.player.energy;let result:any;await act(()=>{result=w.game.drinkBeer()});assert(!result.success);assert.equal(w.game.player.energy,initialEnergy);
  await fixturePlace(w,'settlement');const saved=JSON.parse(w.localStorage.getItem(key()));saved.player.energy=10;saved.player.lastEnergyRegenTimestamp=clock;
  saved.player.inventory.push({id:'bomb',templateId:'bomb',name:'bomb',type:'potion',rarity:'common',level:1,upgradeLevel:0,icon:'',stats:{fireDamage:90},stackCount:5,sellPrice:1,disassembleYield:{}});
  await act(()=>w.root.unmount());w.localStorage.setItem(key(),JSON.stringify(saved));await act(()=>w.mount());
  const gold=w.game.player.gold,silver=w.game.player.silver,hp=w.game.player.hp,mp=w.game.player.mp;
  await act(()=>{beer().click();beer().click()});assert.equal(w.game.player.energy,30);assert.equal(intoxicationPercent(w.game.player),10);assert.equal(w.game.player.gold,gold);assert.equal(w.game.player.silver,silver);assert.equal(w.game.player.hp,hp);assert.equal(w.game.player.mp,mp);
  assert.match(w.document.querySelector('[data-tavern-screen]').textContent,/Опьянение · −10%/);
  await act(()=>w.root.unmount());await act(()=>w.mount());assert.equal(w.game.player.energy,30);assert.equal(intoxicationPercent(w.game.player),10);
  await act(()=>w.setLanguage('uk'));assert.match(w.document.querySelector('[data-tavern-screen]').textContent,/Сп’яніння/);assert.match(beer().textContent,/Випити/);await act(()=>w.setLanguage('ru'));
  const oldBeer=w.game.drinkBeer;await act(()=>w.game.startTravel('reg_plains','mod_standard'));await act(()=>{result=oldBeer()});assert(!result.success);await completeJourney(w);await act(()=>{result=oldBeer()});assert(!result.success);assert.equal(intoxicationPercent(w.game.player),10);
  const base={...w.game.combatStats};await act(()=>{assert(w.game.startBattleWithMonster({...enemy,hp:1000,maxHp:1000},{chain:false,energyCost:0}));result=oldBeer()});assert(!result.success);
  for(const field of ['attack','magicAttack','defense','magicDefense'])assert(Math.abs(w.game.combatStats[field]-base[field]*.9)<=1,field);
  await act(()=>w.game.exitCombat());assert.equal(w.game.player.intoxication.battlesLeft,3,'abandoning never sobers the hero');assert(w.game.player.flightPenalty.warningPending);
  const warning=w.document.querySelector('[role="dialog"]');assert.match(warning.textContent,/таверну/);assert.equal(warning.querySelector('img').getAttribute('src'),'/assets/story/tavern-beer.webp');assert(existsSync('public/assets/story/tavern-beer.webp'));
  await act(()=>w.root.unmount());await act(()=>w.mount());assert(w.game.player.flightPenalty.warningPending,'unread hint survives app termination');assert.equal(w.game.player.intoxication.battlesLeft,3);
  await act(()=>w.game.dismissFlightWarning());
  await act(()=>w.game.startBattleWithMonster({...enemy,hp:1000,maxHp:1000},{chain:false,energyCost:0}));
  for(const field of ['attack','magicAttack','defense','magicDefense'])assert(Math.abs(w.game.combatStats[field]-base[field]*.81)<=1,field+' combines shame and intoxication');
  await act(()=>w.game.exitCombat());assert.equal(w.game.player.intoxication.battlesLeft,3);assert(!w.game.player.flightPenalty.warningPending,'later abandonment does not replay the hint');
  await act(()=>w.game.returnToSettlement());await completeJourney(w);await act(()=>beer().click());assert.equal(flightBattlesLeft(w.game.player),0);assert.equal(intoxicationPercent(w.game.player),15);assert(!w.game.player.flightPenalty.warningPending);
  await act(()=>w.game.startTravel('reg_plains','mod_standard'));await completeJourney(w);
  for(let i=0;i<3;i++){
   await act(()=>assert(w.game.startBattleWithMonster(enemy,{chain:false,energyCost:0})));
   for(const field of ['attack','magicAttack','defense','magicDefense'])assert(Math.abs(w.game.combatStats[field]-base[field]*.85)<=1,field);
   await act(()=>w.game.performPlayerAction('potion','bomb'));assert.equal(w.game.combatOutcome,'victory');assert.equal(w.game.player.intoxication?.battlesLeft??0,2-i);
   await act(()=>{w.game.exitCombat();w.game.exitCombat()});assert.equal(w.game.player.intoxication?.battlesLeft??0,2-i,'result exit never counts twice');
  }
  assert.equal(intoxicationPercent(w.game.player),0);await act(()=>w.root.unmount());await act(()=>w.mount());assert.equal(intoxicationPercent(w.game.player),0);
  await act(()=>w.game.returnToSettlement());await completeJourney(w);await act(()=>beer().click());assert.equal(w.game.player.intoxication.battlesLeft,3);
  await act(()=>w.game.startBattleWithMonster({...enemy,hp:100000,maxHp:100000,attack:1000000},{chain:false,energyCost:0}));await act(()=>w.game.performPlayerAction('attack'));
  for(let i=0;i<12&&!w.game.isCombatEnded;i++)await w.act(async()=>new Promise(resolve=>setTimeout(resolve,150)));
  assert.equal(w.game.combatOutcome,'defeat');assert.equal(w.game.player.intoxication.battlesLeft,2,'a finished defeat also counts, exactly once');
  await act(()=>w.game.exitCombat());await act(()=>w.root.unmount());await act(()=>w.mount());assert.equal(w.game.player.intoxication.battlesLeft,2);
 }finally{await act(()=>w.root.unmount());dom.window.close();}
});

test('no live energy purchase or meditation handler remains',()=>{
 for(const path of ['src/context/GameContext.tsx','src/components/layout/TopHeader.tsx','src/interfaces/fantasy/components/layout/TopHeader.tsx','src/interfaces/fantasy/components/layout/BetaTopHeader.tsx','src/components/combat/CombatScreen.tsx','src/interfaces/fantasy/components/combat/CombatScreen.tsx','src/interfaces/fantasy/components/combat/HuntDashboard.tsx','src/interfaces/fantasy/components/combat/BetaHuntDashboard.tsx'])assert.doesNotMatch(readFileSync(path,'utf8'),/meditateOrRefillEnergy|getEnergyElixirPrice|onMeditate|onBuyElixir/);
});
