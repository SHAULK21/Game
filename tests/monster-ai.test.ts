import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import type { Monster } from '../src/types/game';
import { chooseMonsterSkill, getMonsterCombatSkills, monsterActionKind, monsterActionWeights, monsterDelayRange, sampleMonsterDelay, prepareMonsterForCombat, advanceMonsterCooldowns } from '../src/utils/monsterAI';
import { forecastMonsterAction, monsterReadingAccuracy } from '../src/utils/monsterForecast';
import { createTalentTree, learnTalent, migrateTalents, resetTalents } from '../src/data/talents';
import { incomingArmorConstant, pveThreatMultiplier, monsterEnrageMultiplier, monsterEnragePressureDamage } from '../src/utils/pveBalance';

const enemy = (level = 1): Monster => ({id:'m_bandit',name:'Разбойник',regionId:'reg_plains',level,hp:10000,maxHp:10000,mp:100,maxMp:100,attack:42,magicAttack:0,defense:18,magicDefense:10,speed:18,critChance:0,evasion:0,avatar:'',expReward:0,goldReward:0,drops:[]});

test('different super skills cannot bypass shared recovery; each skill waits at least three full turns',()=>{
 let m=prepareMonsterForCombat({...enemy(80),skills:[0,1].map(n=>({id:'super_'+n,name:'Удар',icon:'',manaCost:0,cooldown:0,damageMultiplier:1.5,damageType:'physical'}))});
 assert(m.skills!.filter(s=>monsterActionKind(s)==='super').every(s=>s.cooldown===3));
 const casts:Record<string,number>={};let previous=-100;
 for(let turn=1;turn<=60;turn++){
  const skill=chooseMonsterSkill(m,[],()=>.3);
  if(skill){assert(turn-previous>=3);assert(turn-(casts[skill.id]||-100)>=4);casts[skill.id]=turn;previous=turn;}
  m=advanceMonsterCooldowns(m,skill||undefined);
 }
 assert(Object.keys(casts).length===2);
});

test('reading upgrades are learnable, preserved and refundable; measured forecast accuracy rises without becoming certain',()=>{
 let player:any={classId:'knight',level:1,talents:createTalentTree('knight'),talentPoints:5,silver:1000};
 const m=prepareMonsterForCombat(enemy(80)),actual=m.skills![0];let previous=0;
 for(let rank=0;rank<=5;rank++){
  assert.equal(monsterReadingAccuracy(player.talents),50+rank*8);
  let seed=7,hits=0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<10000;i++)if(forecastMonsterAction(m,[],actual,player.talents,i,random).skill?.id===actual.id)hits++;
  assert(Math.abs(hits/100-(50+rank*8))<1.5);assert(hits>previous && hits<10000);previous=hits;
  if(rank<5)player=learnTalent(player,'knight_survival_read');
 }
 assert.equal(player.talentPoints,0);assert.equal(learnTalent(player,'knight_survival_read'),player);
 assert.equal(monsterReadingAccuracy(migrateTalents(player).talents),90);
 assert.equal(resetTalents(player).talentPoints,5);
 const guarded={...m,superCooldown:2,potionCharges:0,skills:m.skills!.map(s=>({...s,currentCooldown:2}))};
 assert.equal(forecastMonsterAction(guarded,[],null,player.talents,1,()=>.99).skill,null,'forecast cannot invent a move on cooldown');
});

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
  assert.equal(monsterEnrageMultiplier(enemy(),26),1.135);
  assert(monsterEnrageMultiplier(enemy(),200)>100);
  assert(monsterEnrageMultiplier({...enemy(),regionId:'ascension'},200)>100);
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
    let randomCalls=0;w.Math.random=()=>{randomCalls++;return 0;};
    await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));await w.act(async()=>w.game.performPlayerAction('defend'));
    const delay=pending.values().next().value!.ms,calls=randomCalls;
    await w.act(async()=>w.game.allocateAttribute('strength'));
    assert.equal(randomCalls,calls,'a rerender must not reroll the monster action');
    assert.equal(pending.size,1);assert(pending.values().next().value!.ms<=delay,'a rerender must not extend the deadline');
    const health=w.game.combatPlayerHp;await flush();assert.equal(w.game.monsterIntent.actionKind,'defend');
    await flush();assert.equal(w.game.combatPlayerHp,health);assert(w.game.monsterEffects.some((e:any)=>e.type==='fortify'));
    assert(!w.game.battleLog.some((e:any)=>e.id.startsWith('monster_skill_damage_')));
    await w.act(async()=>w.game.exitCombat());w.Math.random=()=>.45;await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
    await w.act(async()=>w.game.performPlayerAction('attack'));
    await flush();assert.equal(w.game.monsterIntent.actionKind,'potion');await flush();
    assert.equal(w.game.activeMonster.potionCharges,0);assert(w.game.playerEffects.some((e:any)=>e.type==='burn'||e.type==='poison'));
    const hit=w.game.battleLog.find((e:any)=>e.id.startsWith('monster_skill_damage_'));assert(hit.impact.amount>0);
    await w.act(async()=>w.game.performPlayerAction('defend'));assert.equal(pending.size,1);
    await w.act(async()=>w.game.exitCombat());assert.equal(pending.size,0);assert.equal(w.game.activeMonster,null);
    const supers={...enemy(80),regionId:'test',attack:1,skills:[0,1].map(n=>({id:'burst_'+n,name:'Удар',icon:'',manaCost:0,cooldown:0,damageMultiplier:1.5,damageType:'physical'}))};
    w.Math.random=()=>.3;await w.act(async()=>w.game.startBattleWithMonster(supers,{chain:false,energyCost:0}));
    let lastSuper=-100;const perSkill:Record<string,number>={};let casts=0;
    for(let turn=1;turn<=30;turn++){
      const prediction=w.game.monsterForecast;
      assert.equal(prediction.accuracy,50);assert.equal(prediction.round,w.game.combatRound);
      await w.act(async()=>w.game.performPlayerAction('defend'));await flush();
      const skill=w.game.monsterIntent;
      assert.equal(skill?.id,prediction.skill?.id,'successful read must predict the action actually cast');
      if(skill){
        if(skill.actionKind!=='potion'){assert(turn-lastSuper>=3);assert(turn-(perSkill[skill.id]||-100)>=4);lastSuper=turn;perSkill[skill.id]=turn;casts++;}
        await flush();
      }
    }
    assert(casts>4);assert(Object.keys(perSkill).length===2);
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});

test('late fury breaks zero damage, defensive loops and perpetual healing without changing short fights',()=>{
  for (const regionId of ['reg_plains','arena','ascension']) {
    const m=prepareMonsterForCombat({...enemy(80),regionId});
    assert.equal(monsterEnrageMultiplier(m,20),1);
    assert(monsterEnrageMultiplier(m,40)>monsterEnrageMultiplier(m,30));
    assert.equal(monsterEnragePressureDamage(39,1000,0),0);
    assert.equal(monsterEnragePressureDamage(40,1000,0),50);
    assert.equal(monsterEnragePressureDamage(40,1000,90),0);
    assert.equal(monsterEnragePressureDamage(41,1000,10),90);
    assert.equal(monsterEnragePressureDamage(59,1000,0),1000);
    for(let roll=0;roll<1;roll+=.02)assert.notEqual(monsterActionKind(chooseMonsterSkill(m,[],()=>roll,40)),'defend');
    const guardOnly={...m,skills:m.skills!.filter(s=>monsterActionKind(s)==='defend')};
    assert.equal(chooseMonsterSkill(guardOnly,[],()=>0,40),null);
  }
});

test('real encounters end through late hits despite huge armor, shields, control and full healing every round',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {MonsterEnrageNotice} from './src/components/combat/MonsterEnrageNotice';function Probe(){window.game=useGame();return <MonsterEnrageNotice/>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'harness',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace(/const timer = setTimeout\(\(\) => \{\n      (const currentTurn = combatRound;|const skill = monsterIntent;)/g,'const timer = (window as any).__combatSetTimeout(() => {\n      $1').replace('const [player, setPlayerState] = useState<PlayerCharacter | null>(null);','const [player, setPlayerState] = useState<PlayerCharacter | null>(null); (window as any).__setPlayer=setPlayerState;').replace('const [monsterEffects, setMonsterEffects] = useState<StatusEffect[]>([]);','const [monsterEffects, setMonsterEffects] = useState<StatusEffect[]>([]); (window as any).__setMonsterEffects=setMonsterEffects;').replace('const [playerEffects, setPlayerEffects] = useState<StatusEffect[]>([]);','const [playerEffects, setPlayerEffects] = useState<StatusEffect[]>([]); (window as any).__setPlayerEffects=setPlayerEffects;'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({resetVersion:0,active:false,items:[],ok:true})});
 let id=100000;const timers=new Map<number,()=>void>(),clear=w.clearTimeout.bind(w);w.__combatSetTimeout=(fn:()=>void)=>{timers.set(++id,fn);return id;};w.clearTimeout=(n:number)=>{if(!timers.delete(n))clear(n);};w.eval(bundle.outputFiles[0].text);
 const flush=async()=>{const next=timers.entries().next().value;assert(next);timers.delete(next[0]);await w.act(async()=>next[1]());};
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Страж','knight'));await w.act(async()=>w.game.exitCombat());
  for(const regionId of ['reg_plains','arena','ascension']){
   await w.act(async()=>w.__setPlayer((p:any)=>({...p,firstJourney:'done',inventory:[{id:'full_heal',name:'Полное исцеление',type:'potion',rarity:'common',level:1,upgradeLevel:0,icon:'',stats:{healFull:1},sellPrice:0,disassembleYield:{},stackCount:100}],equipped:{armor:{id:'test_armor',name:'Броня',type:'armor',level:1,upgradeLevel:0,rarity:'common',stats:{defense:1e9,magicDefense:1e9,evasion:100},sellPrice:0,disassembleYield:{}}}})));
   const target={...enemy(80),id:'stalemate_'+regionId,regionId,hp:1e12,maxHp:1e12,attack:1,magicAttack:1,skills:[{id:'guard',name:'Щит',icon:'',manaCost:0,cooldown:0,damageMultiplier:0,damageType:'physical',actionKind:'defend',effect:'fortify',effectDuration:1,effectPower:90}]};
   if(regionId==='ascension')target.skills.push({id:'hit',name:'Удар',icon:'',manaCost:0,cooldown:3,damageMultiplier:1.5,damageType:'physical',actionKind:'super'} as any);
   w.Math.random=()=>0;await w.act(async()=>w.game.startBattleWithMonster(target,{chain:false,energyCost:0}));
   for(let round=1;round<=59;round++){
    assert(!w.game.isCombatEnded,`${regionId} should survive until round 59 with full healing`);assert.equal(w.game.combatRound,round);
    if(w.game.combatPlayerHp<w.game.combatStats.maxHp)await w.act(async()=>w.game.performPlayerAction('potion','full_heal'));
    if(round>=40)await w.act(async()=>{w.__setPlayerEffects([{type:'invulnerable',name:'Неуязвимость',duration:3,value:1},{type:'shield',name:'Щит',duration:3,value:1e9}]);w.__setMonsterEffects([{type:'stun',name:'Оглушение',duration:3,value:1}]);});
    await w.act(async()=>w.game.performPlayerAction('defend'));await flush();if(w.game.monsterIntent)await flush();
    if(round===25)assert(!w.game.battleLog.some((l:any)=>l.id.startsWith('monster_enrage_')));
    if(round===26)assert.equal(w.game.battleLog.filter((l:any)=>l.id.startsWith('monster_enrage_')).length,1);
    if(round===40){assert.match(w.document.body.textContent,/Неудержимая ярость/);assert(w.game.combatPlayerHp<=w.game.combatStats.maxHp*.95);assert(w.game.battleLog.some((l:any)=>l.id.startsWith('enrage_control_')));}
   }
   if(regionId==='ascension')assert(w.game.battleLog.some((l:any)=>l.turn>=40&&l.id.startsWith('monster_skill_damage_')),'late skill casts also apply pressure');
   assert.equal(w.game.combatOutcome,'defeat');assert.equal(w.game.combatPlayerHp,0);assert(!w.document.body.textContent.includes('Неудержимая ярость'));await w.act(async()=>w.game.exitCombat());
  }
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
