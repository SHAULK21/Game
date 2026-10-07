import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';

const bundle = await build({stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import{LocalGameProvider as GameProvider,useGame}from'./src/context/GameContext';import{NavigationProvider}from'./src/context/NavigationContext';import{CombatScreen as Modern}from'./src/components/combat/CombatScreen';import{CombatScreen as Fantasy}from'./src/interfaces/fantasy/components/combat/CombatScreen';function Probe(){window.game=useGame();return window.style==='fantasy'?<Fantasy/>:<Modern/>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><NavigationProvider><Probe/></NavigationProvider></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/GameModel\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace(/const timer = setTimeout\(\(\) => \{\n      (const currentTurn = combatRound;|const skill = monsterIntent;)/g,'const timer = (window as any).__combatSetTimeout(() => {\n      $1'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});

for(const style of ['modern','fantasy'])test(`${style}: forecast is explicitly uncertain, may differ from actual attack and improves through a purchased talent`,async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true});const w:any=dom.window;
 w.style=style;w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.localStorage.setItem('aethelgard_language','ru');
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});
 let id=100000;const pending=new Map<number,()=>void>();const clear=w.clearTimeout.bind(w);
 w.__combatSetTimeout=(fn:()=>void)=>{pending.set(++id,fn);return id;};w.clearTimeout=(timer:number)=>{if(!pending.delete(timer))clear(timer);};
 w.eval(bundle.outputFiles[0].text);
 const target={id:'forecast_test',name:'Тестовый волк',regionId:'test',level:2,hp:10000,maxHp:10000,mp:40,maxMp:40,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]};
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Страж','knight'));await w.act(async()=>w.game.exitCombat());
  w.Math.random=()=>.9;await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  assert.equal(w.game.monsterForecast.skill.actionKind,'defend');
  assert.match(w.document.body.textContent,/Возможный приём/);assert.match(w.document.body.textContent,/Прогноз может ошибаться/);assert.match(w.document.body.textContent,/Точность чтения: 50%/);
  const before=w.game.monsterForecast;await w.act(async()=>w.game.allocateAttribute('strength'));assert.deepEqual(w.game.monsterForecast,before);
  await w.act(async()=>w.game.performPlayerAction('defend'));const timer=pending.entries().next().value;assert(timer);pending.delete(timer[0]);await w.act(async()=>timer[1]());
  assert.equal(w.game.monsterIntent,null);assert(w.game.battleLog.some((log:any)=>log.id.startsWith('m_atk_')),'a predicted guard must be allowed to resolve as an ordinary attack');
  await w.act(async()=>w.game.exitCombat());assert.equal(w.game.monsterForecast,null);
  await w.act(async()=>w.game.unlockTalent('knight_survival_read'));assert.equal(w.game.player.talentPoints,0);
  w.Math.random=()=>.55;await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  assert.equal(w.game.monsterForecast.accuracy,58);assert.equal(w.game.monsterForecast.skill,null);
  assert.match(w.document.body.textContent,/Точность чтения: 58%/);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
