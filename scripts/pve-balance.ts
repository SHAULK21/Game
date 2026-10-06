import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import fs from 'node:fs/promises';
const runs=Number(process.env.PVE_RUNS||5), quick=process.env.PVE_QUICK==='1';
if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw new Error('PVE_RUNS must be an integer from 1 to 1000');
const entry=`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {chooseAutoBattleAction} from './src/utils/autoBattle';import {GameProvider,useGame} from './src/context/GameContext';import {CLASSES,REGIONS,MONSTERS,CAVES,BASIC_CRAFT_RECIPES,REGION_MODIFIERS,ALCHEMY_RECIPES} from './src/data/gameData';import {applyClassGear} from './src/utils/classEquipment';import {reconcileSkills} from './src/data/classEvolution';import {createTalentTree,learnTalent,talentLockReason,branchSpent,talentManaCost} from './src/data/talents';import {getRegionMonster} from './src/data/gameData';import {applyDungeonDifficulty} from './src/utils/dungeonRewards';import {ASCENSION_STAGES,ASCENSION_RANKS,ascensionBoss,migrateAscension} from './src/data/ascension';window.catalog={CLASSES,REGIONS,MONSTERS,CAVES,BASIC_CRAFT_RECIPES,REGION_MODIFIERS,ALCHEMY_RECIPES,ASCENSION_STAGES,ASCENSION_RANKS};window.helpers={chooseAutoBattleAction,applyClassGear,reconcileSkills,createTalentTree,learnTalent,talentLockReason,branchSpent,talentManaCost,getRegionMonster,applyDungeonDifficulty,ascensionBoss,migrateAscension};function Probe(){window.game=useGame();return null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'harness',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace(/const timer = setTimeout\(\(\) => \{\n      (const currentTurn = combatRound;|const skill = monsterIntent;)/g,'const timer = (window as any).__combatSetTimeout(() => {\n      $1').replace('const [player, setPlayer] = useState<PlayerCharacter | null>(null);','const [player, setPlayer] = useState<PlayerCharacter | null>(null); (window as any).__setPlayer = setPlayer;'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});
const pending=new Map<number,()=>void>();let timerId=100000;
const originalSetTimeout=w.setTimeout.bind(w),originalClearTimeout=w.clearTimeout.bind(w);
w.setTimeout=(fn:any,ms:number,...args:any[])=>{if((ms===650 || ms===700 || ms===1000)){const id=++timerId;pending.set(id,()=>fn(...args));return id;}return originalSetTimeout(fn,ms,...args);};
w.__combatSetTimeout=(fn:any,_ms:number)=>{const id=++timerId;pending.set(id,fn);return id;};
w.clearTimeout=(id:number)=>{if(pending.has(id))pending.delete(id);else originalClearTimeout(id);};w.setInterval=()=>++timerId;w.clearInterval=()=>{};
const warnings:string[]=[];w.console.error=(...args:any[])=>warnings.push(args.map(String).join(' '));
w.eval(bundle.outputFiles[0].text);
const clone=(x:any)=>JSON.parse(JSON.stringify(x));
let seed=1;w.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const {CLASSES,REGIONS,MONSTERS,CAVES,BASIC_CRAFT_RECIPES,REGION_MODIFIERS}=w.catalog, h=w.helpers;
const bases:Record<string,any>={};const rows:any[]=[];
const attributeWeights:Record<string,Record<string,number>>={
 warrior:{strength:.6,vitality:.25,agility:.15},berserker:{strength:.6,vitality:.25,agility:.15},knight:{strength:.45,vitality:.4,willpower:.15},
 rogue:{agility:.6,strength:.25,vitality:.15},assassin:{agility:.5,strength:.35,vitality:.15},archer:{agility:.5,strength:.35,vitality:.15},
 mage:{intelligence:.6,vitality:.25,spirit:.15},necromancer:{intelligence:.6,vitality:.25,spirit:.15},paladin:{strength:.45,spirit:.3,vitality:.25},druid:{intelligence:.5,spirit:.3,vitality:.2}
};
function fixture(classId:string,level:number,gear:string) {
 let p=clone(bases[classId]);p.level=level;p.exp=0;p.nextExp=1e12;p.gold=0;p.silver=0;p.statPoints=0;p.talentPoints=level;p.energy=1000;p.maxEnergy=1000;p.inventory=[];p.maxInventorySlots=10000;p.currentRegionId='reg_plains';p.firstJourney='done';p.firstJourneyDeparture=false;p.adventureJournal={unlocked:['intro','royal-order','first-boss','royal-return']};
 p.attributes=clone(CLASSES[classId].baseAttributes);const points=5+(level-1)*5;let spent=0;const weights=Object.entries(attributeWeights[classId]);for(let i=0;i<weights.length;i++){const [attr,weight]=weights[i];const n=i===weights.length-1?points-spent:Math.floor(points*weight);p.attributes[attr]+=n;spent+=n;}
 p.talents=h.createTalentTree(classId);let guard=0;while(p.talentPoints>0&&guard++<300){const candidates=p.talents.filter((t:any)=>!h.talentLockReason(p,t)&&t.branch!=='mastery').sort((a:any,b:any)=>h.branchSpent(p.talents,a.branch)-h.branchSpent(p.talents,b.branch));if(!candidates.length)break;p=h.learnTalent(p,candidates[0].id);}
 if(gear!=='starter' && level>1){p.equipped={};for(const type of ['weapon','armor','helmet','boots']){const recipe=BASIC_CRAFT_RECIPES.filter((r:any)=>r.result?.type===type&&(r.levelReq||1)<=level&&(gear==='prepared'?r.huntStage==='elite':!r.huntStage)&&(!r.result.targetClass||r.result.targetClass===classId)).sort((a:any,b:any)=>(b.levelReq||1)-(a.levelReq||1))[0];if(!recipe)continue;const r=recipe.result;const rarity=gear==='strong'?'epic':gear==='basic'?'uncommon':'rare',mult=gear==='strong'?1.65:gear==='basic'?1.15:1.35;const stats=Object.fromEntries(Object.entries(r.stats).map(([key,value])=>[key,['speed','critChance','evasion'].includes(key)?value:Math.round(Number(value)*mult)]));p.equipped[type]=h.applyClassGear({id:'sim_'+type,name:r.name,type,rarity,level:r.level,upgradeLevel:Number(process.env.PVE_UPGRADE||(gear==='strong'?10:gear==='prepared'?7:gear==='basic'?3:5)),icon:'',stats,sellPrice:0,disassembleYield:{},targetClass:r.targetClass},classId);}}
 if(gear==='prepared'){for(const kind of ['hp','mp']){const recipe=w.catalog.ALCHEMY_RECIPES.filter((r:any)=>r.id.endsWith('_'+kind)&&(r.heroLevelReq||1)<=level).at(-1);p.inventory.push({id:'sim_pot_'+kind,templateId:recipe?.id||'alc_'+kind+'_small',name:'Подготовленный настой',type:'potion',rarity:'rare',level:1,upgradeLevel:0,icon:'',stats:recipe?.resultStats||(kind==='hp'?{heal:120}:{manaRestore:80}),sellPrice:0,disassembleYield:{},stackCount:2});}}
 p.regionProgress=Object.fromEntries(REGIONS.map((r:any)=>[r.id,{kills:6,eliteWins:2,bossWins:1}]));p=h.reconcileSkills(p,CLASSES[classId].startingSkills);return p;
}
function chooseAction(strategy:string) {
 const g=w.game,p=g.player;if(strategy==='attack')return ['attack'];const skills=p.skills.filter((s:any)=>s.levelReq<=p.level&&s.currentCooldown<=0&&h.talentManaCost(s.manaCost,p.talents)<=g.combatPlayerMp);
 if(strategy==='auto'){const decision=h.chooseAutoBattleAction({player:p,monster:g.activeMonster,stats:g.combatStats,hp:g.combatPlayerHp,mp:g.combatPlayerMp,playerEffects:g.playerEffects,monsterEffects:g.monsterEffects,settings:{...g.autoBattle,useSkills:true,useUltimate:true,healAtHpPercent:40,fleeAtHpPercent:0},damageMultiplier:w.catalog.REGION_MODIFIERS?.[g.activeMonster.huntingModeId]?.damageMultiplier||1});return [decision.action,decision.id];}
 if(g.combatPlayerHp/g.combatStats.maxHp<.5){const heal=skills.find((s:any)=>s.healMultiplier&&s.damageMultiplier===0);if(heal)return ['skill',heal.id];}
 const offensive=skills.filter((s:any)=>s.damageMultiplier>0).sort((a:any,b:any)=>b.damageMultiplier-a.damageMultiplier);
 const s=offensive[0];if(s)return ['skill',s.id];
 if(['mage','necromancer','druid'].includes(p.classId)&&g.combatPlayerMp<20)return ['defend'];
 return ['attack'];
}
async function fight(p:any,monster:any,mode:string,strategy:string,battleSeed:number,chain=false) {
 seed=battleSeed;await w.act(async()=>{w.game.exitCombat();w.__setPlayer(clone(p));});
 let started=false;await w.act(async()=>{started=w.game.startBattleWithMonster(clone(monster),{chain,energyCost:0,huntingModeId:mode});});if(!started)throw new Error('Could not start '+monster.id);
 const result=await playBattle(strategy,chain);
 await w.act(async()=>w.game.exitCombat());return result;
}
async function playBattle(strategy:string,chain=false) { let actions=0,monsterActions=0,completed=0;const stats=clone(w.game.combatStats);const enemyStats=clone(w.game.activeMonster);let actionCounts={attack:0,super:0,defend:0,potion:0};
 while(actions<(chain?450:150)){const g=w.game;if(g.isCombatEnded){if(chain&&g.combatOutcome==='victory'&&g.combatChain?.remaining){completed++;await w.act(async()=>w.game.startNextCombatBattle());continue;}break;}
 if(g.turnPhase==='player'){const [action,id]=chooseAction(strategy);await w.act(async()=>w.game.performPlayerAction(action,id));actions++;}
 else {const timer=pending.entries().next().value;if(!timer)throw new Error('No monster timer at '+g.activeMonster?.id+' phase '+g.turnPhase);pending.delete(timer[0]);const before=w.game.battleLog.length;await w.act(async()=>timer[1]());for(const log of w.game.battleLog.slice(before)){if(log.id.startsWith('m_atk_'))actionCounts.attack++;if(log.id.startsWith('monster_cast_')){const skill=g.monsterIntent;actionCounts[skill?.actionKind==='potion'?'potion':skill?.actionKind==='defend'||['fortify','shield'].includes(skill?.effect)?'defend':'super']++;}}monsterActions++;}
 }
 const g=w.game;const result={outcome:g.isCombatEnded&&(!chain||g.combatOutcome==='defeat'||!g.combatChain?.remaining)?g.combatOutcome:'timeout',rounds:actions,hpPercent:100*g.combatPlayerHp/stats.maxHp,remainingHpPercent:100*g.activeMonster.hp/g.activeMonster.maxHp,monsterActions,completed:completed+(g.isCombatEnded&&g.combatOutcome==='victory'?1:0),heroStats:stats,enemyStats,actionCounts};
 return result;
}


try {
 await w.act(async()=>w.mount());for(const id of Object.keys(CLASSES)){await w.act(async()=>w.game.createCharacter('Simulation',id));bases[id]=clone(w.game.player);}
 if(process.env.PVE_DUNGEONS==='1') {
  const rows:any[]=[];let count=0;
  for(const cave of Object.values(CAVES) as any[]) for(const difficulty of ['normal','hard','nightmare','hell']) for(const classId of Object.keys(CLASSES)) {
   const p=fixture(classId,cave.minLevel+Number(process.env.PVE_DUNGEON_LEVEL_BONUS||0),'prepared');p.currentRegionId=cave.regionId;const outcomes:any[]=[];
   for(let run=0;run<runs;run++) {
    seed=42+count++*17;await w.act(async()=>{w.game.exitDungeon();w.__setPlayer(clone(p));});await w.act(async()=>w.game.enterDungeon(cave.id,difficulty));
    if(!w.game.activeDungeonRun)throw new Error('Could not enter '+cave.id);
    let rounds=0,battles=0,guard=0;let outcome='timeout';
    while(guard++<cave.roomsCount*2+2) {
     if(w.game.activeDungeonRun.completed){outcome='victory';break;}
     await w.act(async()=>w.game.proceedDungeonRoom());
     if(w.game.isInCombat){const result=await playBattle('auto');rounds+=result.rounds;battles++;if(result.outcome!=='victory'){outcome=result.outcome;break;}await w.act(async()=>w.game.exitCombat());}
    }
    outcomes.push({outcome,rounds,battles,hp:100*w.game.combatPlayerHp/w.game.combatStats.maxHp});
    await w.act(async()=>w.game.exitDungeon());
   }
   rows.push({classId,level:p.level,cave:cave.id,difficulty,runs,wins:outcomes.filter(o=>o.outcome==='victory').length,losses:outcomes.filter(o=>o.outcome==='defeat').length,timeouts:outcomes.filter(o=>o.outcome==='timeout').length,meanRounds:outcomes.reduce((n,o)=>n+o.rounds,0)/runs,meanHp:outcomes.reduce((n,o)=>n+o.hp,0)/runs,battles:outcomes.reduce((n,o)=>n+o.battles,0)});
   await fs.writeFile(process.env.PVE_OUTPUT||'/tmp/pve-results.json',JSON.stringify({runs,rows,warnings,source:'Real GameProvider full dungeon runs; accelerated combat timers; HP/MP and limited consumables persist between rooms; prepared class gear; fixed seed; gates pre-unlocked; no fleeing'},null,2));
  }
  console.log(JSON.stringify({dungeonRuns:count,battles:rows.reduce((n,r)=>n+r.battles,0)}));
 } else {
 const levels=process.env.PVE_LEVELS?process.env.PVE_LEVELS.split(',').map(Number):quick?[1]:[1,5,8,12,25,40,55,75,90,100];let count=0;const start=Date.now();
 for(const level of levels){const region=REGIONS.filter((r:any)=>r.minLevel<=level).at(-1);for(const classId of Object.keys(CLASSES).filter(id=>!process.env.PVE_CLASS||id===process.env.PVE_CLASS))for(const gear of (process.env.PVE_GEAR?[process.env.PVE_GEAR]:level===1?['starter']:['standard'])){
 let p=fixture(classId,level,gear);p.currentRegionId=region.id;
 const stage=process.env.PVE_ASCENSION?w.catalog.ASCENSION_STAGES.find((s:any)=>s.recommendedLevel===level):null;
 if(stage){p.ascension={rank:w.catalog.ASCENSION_RANKS[w.catalog.ASCENSION_RANKS.indexOf(stage.rank)-1],primary:'ward',secondary:w.catalog.ASCENSION_RANKS.indexOf(stage.rank)>4?'flow':undefined,trialsWon:[]};p=h.migrateAscension(p);}
 for(const mode of (process.env.PVE_MODE?[process.env.PVE_MODE]:quick?['mod_standard']:region.availableMods))for(const id of (stage?['ascension_'+stage.rank]:region.monsters).filter((id:string)=>!process.env.PVE_MONSTER || id===process.env.PVE_MONSTER)){const monster=stage?h.ascensionBoss(stage.rank):h.getRegionMonster(MONSTERS[id],region,level);const outcomes:any[]=[];
 for(let run=0;run<runs;run++){outcomes.push(await fight(p,monster,mode,process.env.PVE_STRATEGY||'auto',42+count*17+run,process.env.PVE_CHAIN==='1'));count++;}
 rows.push({classId,level,gear,region:stage?'ascension':region.id,monster:id,name:monster.name,boss:Boolean(monster.isBoss),elite:Boolean(monster.isElite),mode,strategy:process.env.PVE_STRATEGY||'auto',chain:process.env.PVE_CHAIN==='1',runs,wins:outcomes.filter(o=>o.outcome==='victory').length,losses:outcomes.filter(o=>o.outcome==='defeat').length,timeouts:outcomes.filter(o=>o.outcome==='timeout').length,heroStats:outcomes[0].heroStats,enemyStats:outcomes[0].enemyStats,actionCounts:Object.fromEntries(['attack','super','defend','potion'].map(kind=>[kind,outcomes.reduce((n,o)=>n+o.actionCounts[kind],0)])),meanRounds:outcomes.reduce((n,o)=>n+o.rounds,0)/runs,meanHp:outcomes.reduce((n,o)=>n+o.hpPercent,0)/runs,meanCompleted:outcomes.reduce((n,o)=>n+o.completed,0)/runs,remainingEnemyHp:outcomes.reduce((n,o)=>n+o.remainingHpPercent,0)/runs});}
 }
 console.log(JSON.stringify({level,battles:count,elapsedSeconds:Math.round((Date.now()-start)/1000)}));await fs.writeFile(process.env.PVE_OUTPUT||'/tmp/pve-results.json',JSON.stringify({runs,rows,warnings,source:`real GameProvider; accelerated monster timers; shared smart autobattle selector; no fleeing; wolf pet; balanced attributes/talents; gear ${process.env.PVE_GEAR||'standard'}; prepared profile has 2 HP/MP potions; region gates pre-unlocked to isolate combat; ascension uses previous earned rank`},null,2));
 }
 }
}finally{await w.act(async()=>w.root.unmount());dom.window.close();}
