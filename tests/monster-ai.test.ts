import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import type { Monster } from '../src/types/game';
import { chooseMonsterSkill, getMonsterCombatSkills, monsterActionKind, monsterActionWeights, monsterDelayRange, sampleMonsterDelay, prepareMonsterForCombat } from '../src/utils/monsterAI';
import { incomingArmorConstant, pveThreatMultiplier, monsterEnrageMultiplier } from '../src/utils/pveBalance';

const enemy = (level = 1): Monster => ({id:'m_bandit',name:'Разбойник',regionId:'reg_plains',level,hp:10000,maxHp:10000,mp:100,maxMp:100,attack:42,magicAttack:0,defense:18,magicDefense:10,speed:18,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]});

test('individual action timing has narrow bounded ranges, different creature rhythms and faster autobattle',()=>{
  for (const id of ['m_wolf','m_bandit','m_goblin','m_stone_golem','m_spider','m_dragon_boss']) {
    const monster={...enemy(50),id};const ranges=[];
    for (const kind of ['attack','super','defend','potion'] as const) {
      const range=monsterDelayRange(monster,kind);ranges.push(range.join(':'));
      assert(range[1]-range[0]>=100 && range[1]-range[0]<=180);
      assert.equal(sampleMonsterDelay(monster,kind,false,()=>0),range[0]);
      assert.equal(sampleMonsterDelay(monster,kind,false,()=>1),range[1]);
      assert(monsterDelayRange(monster,kind,true)[1]<range[0]);
    }
    assert.equal(new Set(ranges).size,4);
  }
  assert.notDeepEqual(monsterDelayRange({...enemy(),id:'m_wolf'},'attack'),monsterDelayRange(enemy(),'attack'));
});

test('low levels use fewer special actions; mana, cooldown, active protection and potion stock are enforced',()=>{
  const low=prepareMonsterForCombat(enemy(2)),high=prepareMonsterForCombat(enemy(80));
  assert(monsterActionWeights(low).super<monsterActionWeights(high).super);
  assert(monsterActionWeights(low).defend<monsterActionWeights(high).defend);
  assert.equal(low.potionCharges,0);assert.equal(high.potionCharges,3);
  assert.equal(monsterActionKind(chooseMonsterSkill(low,[],()=>0)),'defend');
  assert.equal(monsterActionKind(chooseMonsterSkill(low,[],()=>.08)),'super');
  assert.equal(chooseMonsterSkill(low,[],()=>.9),null);
  const potion=chooseMonsterSkill(high,[],()=>.7);assert.equal(potion?.actionKind,'potion');
  assert.equal(chooseMonsterSkill({...high,potionCharges:0},[],()=>.7),null);
  assert.notEqual(monsterActionKind(chooseMonsterSkill(high,[{type:'fortify',name:'Защита',duration:1,value:25}],()=>0)),'defend');
  assert.equal(chooseMonsterSkill({...high,mp:0,skills:high.skills!.map(s=>({...s,manaCost:5}))},[],()=>0),null);
  assert.equal(chooseMonsterSkill({...high,skills:high.skills!.map(s=>({...s,currentCooldown:1}))},[],()=>0),null);
  assert(getMonsterCombatSkills({...high,id:'m_stone_golem'}).some(s=>s.actionKind==='potion'));
  assert.equal(pveThreatMultiplier(enemy(8),1),2.1);assert.equal(pveThreatMultiplier(enemy(8),8),1);
  assert(incomingArmorConstant(enemy(80),'physical')>incomingArmorConstant(enemy(2),'physical'));
  assert.equal(pveThreatMultiplier({...enemy(80),regionId:'arena'},1),1);
  assert.equal(monsterEnrageMultiplier(enemy(),25),1);
  assert.equal(monsterEnrageMultiplier(enemy(),26),1.04);
  assert.equal(monsterEnrageMultiplier(enemy(),200),2);
  assert.equal(monsterEnrageMultiplier({...enemy(),regionId:'ascension'},200),1);
});

test('actual combat applies defense without an attack, throws a limited flask, honors deadlines and cancels exited turns',async()=>{
  const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';function Probe(){window.game=useGame();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'timers',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace(/const timer = setTimeout\(\(\) => \{\n      (const currentTurn = combatRound;|const skill = monsterIntent;)/g,'const timer = (window as any).__combatSetTimeout(() => {\n      $1'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
  w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});
  let id=100000;const pending=new Map<number,{fn:()=>void;ms:number}>();const clear=w.clearTimeout.bind(w);
  w.__combatSetTimeout=(fn:()=>void,ms:number)=>{pending.set(++id,{fn,ms});return id;};w.clearTimeout=(timer:number)=>{if(!pending.delete(timer))clear(timer);};
  w.eval(bundle.outputFiles[0].text);
  const flush=async()=>{const next=pending.entries().next().value;assert(next);pending.delete(next[0]);await w.act(async()=>next[1].fn());};
  try {
    await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Страж','knight'));
    await w.act(async()=>w.game.exitCombat());
    const target={...enemy(30),regionId:'test',attack:20};
    await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
    let randomCalls=0;w.Math.random=()=>{randomCalls++;return 0;};await w.act(async()=>w.game.performPlayerAction('defend'));
    const delay=pending.values().next().value!.ms,calls=randomCalls;
    await w.act(async()=>w.game.allocateAttribute('strength'));
    assert.equal(randomCalls,calls,'a rerender must not reroll the monster action');
    assert.equal(pending.size,1);assert(pending.values().next().value!.ms<=delay,'a rerender must not extend the deadline');
    const health=w.game.combatPlayerHp;await flush();assert.equal(w.game.monsterIntent.actionKind,'defend');
    await flush();assert.equal(w.game.combatPlayerHp,health);assert(w.game.monsterEffects.some((e:any)=>e.type==='fortify'));
    assert(!w.game.battleLog.some((e:any)=>e.id.startsWith('monster_skill_damage_')));
    await w.act(async()=>w.game.exitCombat());await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
    w.Math.random=()=>.45;await w.act(async()=>w.game.performPlayerAction('attack'));
    await flush();assert.equal(w.game.monsterIntent.actionKind,'potion');await flush();
    assert.equal(w.game.activeMonster.potionCharges,0);assert(w.game.playerEffects.some((e:any)=>e.type==='burn'||e.type==='poison'));
    const hit=w.game.battleLog.find((e:any)=>e.id.startsWith('monster_skill_damage_'));assert(hit.impact.amount>0);
    await w.act(async()=>w.game.performPlayerAction('defend'));assert.equal(pending.size,1);
    await w.act(async()=>w.game.exitCombat());assert.equal(pending.size,0);assert.equal(w.game.activeMonster,null);
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
