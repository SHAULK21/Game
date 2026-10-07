import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { potionKinds, potionUsedThisTurn } from '../src/utils/combatPotions';
import { recordFlight, completePenalizedBattle, flightBattlesLeft } from '../src/utils/flightPenalty';

test('potion kinds group strengths and hybrid effects; flights refresh three battles and warn once', () => {
  const small: any = { type:'potion', name:'Малое', templateId:'a', stats:{heal:10} };
  assert(potionUsedThisTurn({...small, templateId:'b', stats:{healFull:1}}, potionKinds(small)));
  assert(potionUsedThisTurn({...small, stats:{manaRestore:10}}, potionKinds(small)));
  assert(potionUsedThisTurn({...small, stats:{heal:10,manaRestore:10}}, ['mana']));
  assert(potionUsedThisTurn({...small, stats:{iceDamage:50}}, ['fireDamage']));
  assert(!potionUsedThisTurn(small, []));
  let p: any = recordFlight({} as any);
  assert.equal(flightBattlesLeft(p),3); assert(p.flightPenalty.warningPending);
  p = {...p,flightPenalty:{...p.flightPenalty,warningPending:false}};
  p = completePenalizedBattle(p); assert.equal(flightBattlesLeft(p),2);
  p = recordFlight(p); assert.equal(flightBattlesLeft(p),3); assert(!p.flightPenalty.warningPending);
  for(let i=0;i<5;i++) p=completePenalizedBattle(p);
  assert.equal(flightBattlesLeft(p),0);
});

test('provider enforces per-turn potion kinds, combat crafting lock, persistent flight and exactly three penalized encounters', async () => {
  const bundle = await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {LocalGameProvider as GameProvider,useGame} from './src/context/GameContext';function Probe(){window.game=useGame();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art"',loader:'js'}));}}]});
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}), w:any=dom.window;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
  w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
  w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:true,items:[],ok:true})});
  const native=w.setTimeout.bind(w); w.setTimeout=(fn:any,ms:number,...args:any[])=>native(fn,Math.min(ms||0,10),...args);
  w.eval(bundle.outputFiles[0].text);
  const act=async(fn:()=>void)=>w.act(async()=>fn());
  const settle=async()=>{for(let i=0;i<6;i++) await w.act(async()=>{await new Promise(r=>setTimeout(r,25));});};
  const potion=(id:string,stats:any)=>({id,templateId:id,name:id,type:'potion',rarity:'common',level:1,upgradeLevel:0,icon:'',stats,stackCount:5,sellPrice:1,disassembleYield:{}});
  const enemy:any={id:'rules',name:'Цель',regionId:'arena',level:1,hp:10000,maxHp:10000,mp:0,maxMp:0,attack:60,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]};
  const count=(id:string)=>w.game.player.inventory.find((i:any)=>i.id===id)?.stackCount;
  try {
    await act(()=>w.mount());await act(()=>w.game.createCharacter('Правила','warrior'));w.Math.random=()=>.5;
    const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));
    seed.player.inventory.push(potion('hp',{heal:10}),potion('hp-large',{heal:50}),potion('mp',{manaRestore:10}),potion('bomb',{fireDamage:90}));
    for(const name of ['Уголь','Медная руда']) seed.player.inventory.push({...potion(name,{}),type:'material',name,stackCount:30});
    await act(()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data_749219401',JSON.stringify(seed));await act(()=>w.mount());
    let crafted=false;await act(()=>{crafted=w.game.craftAlchemy('alc_throw_fire')});assert(crafted,'craft works outside combat');
    let sameEventCraft=true;await act(()=>{w.game.startBattleWithMonster(enemy,{chain:false,energyCost:0});sameEventCraft=w.game.craftAlchemy('alc_throw_fire')});assert(!sameEventCraft,'starting combat locks crafting before the next render');
    const inventory=JSON.stringify(w.game.player.inventory), energy=w.game.player.alchemyEnergy;
    await act(()=>{crafted=w.game.craftAlchemy('alc_throw_fire')});assert(!crafted);assert.equal(JSON.stringify(w.game.player.inventory),inventory);assert.equal(w.game.player.alchemyEnergy,energy);
    await act(()=>w.game.performPlayerAction('skill','w_strike'));await settle();
    assert.equal(w.game.turnPhase,'player');assert(w.game.combatPlayerHp<w.game.combatStats.maxHp);
    const round=w.game.combatRound;
    await act(()=>w.game.performPlayerAction('potion','hp'));assert.equal(count('hp'),4);
    const hp=w.game.combatPlayerHp;
    await act(()=>w.game.performPlayerAction('potion','hp'));await act(()=>w.game.performPlayerAction('potion','hp-large'));
    assert.equal(count('hp'),4);assert.equal(count('hp-large'),5);assert.equal(w.game.combatPlayerHp,hp);
    await act(()=>w.game.performPlayerAction('potion','mp'));assert.equal(count('mp'),5,'a different kind also waits for the next turn');assert.equal(w.game.combatRound,round);
    await act(()=>w.game.performPlayerAction('attack'));await settle();assert.equal(w.game.turnPhase,'player');
    await act(()=>w.game.performPlayerAction('potion','mp'));assert.equal(count('mp'),4,'next turn permits a different kind');
    await act(()=>w.game.performPlayerAction('potion','hp-large'));assert.equal(count('hp-large'),5);
    await act(()=>w.game.performPlayerAction('attack'));await settle();
    await act(()=>w.game.performPlayerAction('potion','hp-large'));assert.equal(count('hp-large'),4,'later turns unlock healing again');
    // Failed flee is not a flight; force abandonment records it once even under repeated calls.
    w.Math.random=()=>.99;await act(()=>w.game.performPlayerAction('flee'));await settle();assert.equal(flightBattlesLeft(w.game.player),0);
    await act(()=>{w.game.exitCombat();w.game.exitCombat()});assert.equal(flightBattlesLeft(w.game.player),3);assert(w.game.player.flightPenalty.warningPending);
    await act(()=>w.root.unmount());await act(()=>w.mount());assert(w.game.player.flightPenalty.warningPending,'unread first-flight story survives a reload');
    await act(()=>w.game.dismissFlightWarning());
    await act(()=>w.root.unmount());await act(()=>w.mount());assert.equal(flightBattlesLeft(w.game.player),3);assert(!w.game.player.flightPenalty.warningPending);
    const baseline={...w.game.combatStats};w.Math.random=()=>.5;
    for(let i=0;i<3;i++) {
      await act(()=>w.game.startBattleWithMonster({...enemy,hp:1,maxHp:1},{chain:false,energyCost:0}));
      for(const key of ['attack','magicAttack','defense','magicDefense']) assert(Math.abs(w.game.combatStats[key]-baseline[key]*.9)<=1,key);
      assert.equal(w.game.combatStats.maxHp,baseline.maxHp);
      await act(()=>w.game.performPlayerAction('potion','bomb'));assert.equal(w.game.combatOutcome,'victory');assert.equal(flightBattlesLeft(w.game.player),2-i);
      await act(()=>w.game.exitCombat());assert.equal(flightBattlesLeft(w.game.player),2-i,'leaving results never refreshes penalty');
    }
    await act(()=>w.game.startBattleWithMonster(enemy,{chain:false,energyCost:0}));assert.equal(w.game.combatStats.attack,baseline.attack);
    await act(()=>w.game.performPlayerAction('flee'));assert.equal(flightBattlesLeft(w.game.player),3);assert(!w.game.player.flightPenalty.warningPending,'later flights never repeat the story');
    await act(()=>w.game.exitCombat());
    await act(()=>w.game.startBattleWithMonster({...enemy,attack:1000000},{chain:false,energyCost:0}));await act(()=>w.game.performPlayerAction('attack'));await settle();
    assert.equal(w.game.combatOutcome,'defeat');assert.equal(flightBattlesLeft(w.game.player),2,'defeat consumes a penalized battle too');
    await act(()=>w.game.exitCombat());await act(()=>{crafted=w.game.craftAlchemy('alc_throw_fire')});assert(crafted,'craft unlocks when combat finishes');
  } finally {await act(()=>w.root.unmount());dom.window.close();}
});
