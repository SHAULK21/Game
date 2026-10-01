import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('actual character applies gear attributes, rewards, full pet stats and harder dungeon enemies',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {PETS_LIST} from './src/data/gameData';window.pets=PETS_LIST;function Probe(){window.game=useGame();return null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>)};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 const posts:any[]=[];
 w.fetch=async(path:string,opts:any)=>{if(path==='/api/telemetry')posts.push(JSON.parse(opts.body));return {ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})};};
 w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Мастер','warrior'));
  const before=JSON.parse(JSON.stringify(w.game.combatStats));
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
  seed.player.equipped.ring={id:'test_ring',name:'Кольцо',type:'ring',rarity:'rare',level:1,upgradeLevel:0,icon:'',stats:{strength:10,expBonus:20,goldBonus:25,dropBonus:30},sellPrice:0,disassembleYield:{}};
  seed.player.activePet=w.pets.find((p:any)=>p.id==='pet_golem');
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(seed));await w.act(async()=>w.mount());
  const after=w.game.combatStats;
  assert.equal(after.expBonus,20);assert.equal(after.goldBonus-before.goldBonus,25);assert.equal(after.dropBonus-before.dropBonus,30);
  assert.equal(after.maxHp-before.maxHp,180);assert.ok(after.defense>before.defense+30);assert.ok(after.attack>before.attack);
  await w.act(async()=>w.game.enterDungeon('cave_bat','normal'));
  const normal=w.game.activeDungeonRun.rooms.at(-1).monster;
  await w.act(async()=>w.game.exitDungeon());await w.act(async()=>w.game.enterDungeon('cave_bat','hell'));
  const hell=w.game.activeDungeonRun.rooms.at(-1).monster;
  assert.equal(hell.maxHp,normal.maxHp*3);assert.equal(hell.attack,normal.attack*2);
  await w.act(async()=>w.game.exitDungeon());
  const target={id:'dummy',name:'Цель',regionId:'reg_plains',level:1,hp:1,maxHp:1,mp:0,maxMp:0,attack:1,magicAttack:1,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:1,goldReward:1,drops:[]};
  w.Math.random=()=>0.5;
  await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  await w.act(async()=>w.game.performPlayerAction('attack'));
  assert.equal(w.game.combatOutcome,'victory');
  const events=posts.flatMap(p=>p.events).filter((e:any)=>e.kind==='battle');assert.equal(events.length,1);assert.equal(events[0].outcome,'victory');assert.ok(events[0].exp>=1);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
