import test from 'node:test';
import assert from 'node:assert/strict';
import { monsterPreparation, playerPreparation, monsterImpact } from '../src/utils/combatNarration';
import { translateText } from '../src/i18n/translate';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('narration matches creatures, varies by round and describes only real shield outcomes', () => {
 const wolf:any={id:'m_wolf',name:'Волк',damageType:'physical'};
 const variants=[0,1,2].map(round=>monsterPreparation(wolf,round)[0]);
 assert.equal(new Set(variants).size,3);assert(variants[0].includes('прыжку'));
 assert(monsterPreparation({...wolf,id:'m_golem',name:'Голем'},0)[0].includes('каменный кулак'));
 assert(monsterPreparation({...wolf,id:'m_bandit',name:'Бандит'},0)[0].includes('оружие'));
 assert(monsterPreparation(wolf,0,{name:'Сокрушительный удар',damageMultiplier:1.45} as any)[1].includes('Усиленный'));
 assert(playerPreparation({classId:'archer'} as any,'attack',1)[0].includes('тетиву'));
 assert(monsterImpact('Волк',0,20,false,false)[0].includes('полностью отбили'));
 assert(monsterImpact('Волк',5,20,false,false)[0].includes('5 прошло'));
 assert(!monsterImpact('Волк',0,20,true,false)[0].includes('щит'));
 assert(!monsterImpact('Волк',10,0,false,false)[0].includes('отбили'));
 assert(translateText(variants[0],'uk').includes('готується до стрибка'));
 assert(translateText(monsterImpact('Волк',0,20,false,false)[0],'uk').includes('повністю відбили'));
});

test('real combat resolves player actions immediately, rejects double clicks and reports blocks', async () => {
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';function Probe(){window.game=useGame();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});w.eval(bundle.outputFiles[0].text);
 try {
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Защитник','knight'));w.Math.random=()=>.5;
  const target={id:'wolf_test',name:'Волк',regionId:'arena',level:1,hp:10000,maxHp:10000,mp:0,maxMp:0,attack:5,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:1,goldReward:1,drops:[]};
  await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));const hp=w.game.activeMonster.hp;
  await w.act(async()=>{w.game.performPlayerAction('attack');w.game.performPlayerAction('attack');});
  assert(w.game.activeMonster.hp<hp);assert.equal(w.game.turnPhase,'monster');
  assert.equal(w.game.battleLog.filter((e:any)=>e.id.startsWith('dmg_')).length,1);
  await w.act(async()=>w.game.exitCombat());await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
  await w.act(async()=>w.game.performPlayerAction('defend'));assert(w.game.playerEffects.some((e:any)=>e.type==='shield'));
  for(let i=0;i<6&&w.game.turnPhase==='monster';i++)await w.act(async()=>await new Promise(r=>setTimeout(r,850)));
  assert.equal(w.game.turnPhase,'player');assert(w.game.combatNarration.some((s:string)=>s.includes('полностью отбили')));assert.equal(w.game.combatPlayerHp,w.game.combatStats.maxHp);
  await w.act(async()=>{w.game.performPlayerAction('attack');});await w.act(async()=>w.game.exitCombat());
  assert.equal(w.game.isInCombat,false);assert.equal(w.game.activeMonster,null);assert.equal(w.game.battleLog.length,0);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
