import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import fs from 'node:fs/promises';

const art = {name:'art',setup(b:any){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}};
const bundle = await build({stdin:{contents:`export {REGIONS,MONSTERS,REGION_CRAFT_TIERS,BASIC_CRAFT_RECIPES,ALCHEMY_RECIPES,MINING_NODES,MINE_CATALYST_BY_ORE,getRegionMonster,getUpgradeRequirements} from './src/data/gameData';export * from './src/utils/regionalProgress';export * from './src/utils/autoBattle';export {clanRaidReward,clanRaidItem} from './src/utils/clanProjects';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[art]});
const data:any=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('every base kit and regional potion has ordinary hunt and reachable mine sources; upgraded kits use earned seals',()=>{
 for (const tier of data.REGION_CRAFT_TIERS) {
  const region=data.REGIONS.find((r:any)=>r.id===tier.regionId);
  const ordinary=region.monsters.map((id:string)=>data.MONSTERS[id]).filter((m:any)=>!m.isBoss&&!m.isElite);
  const trophies=ordinary.flatMap((m:any)=>data.getRegionMonster(m,region).drops.map((d:any)=>d.itemName));
  assert.ok(ordinary.length>=2,region.id);
  assert.ok(region.monsters.some((id:string)=>data.MONSTERS[id].isElite));
  assert.ok(region.monsters.some((id:string)=>data.MONSTERS[id].isBoss),region.id);
  assert.equal(region.defaultModId,'mod_standard');
  const recipes=data.BASIC_CRAFT_RECIPES.filter((r:any)=>r.id.startsWith('regional_')&&r.regionId===tier.regionId&&r.levelReq===tier.level&&!r.huntStage);
  assert.ok(recipes.length>=4);
  for(const recipe of recipes)for(const ingredient of recipe.ingredients){
   const node=data.MINING_NODES.find((n:any)=>n.oreYield===ingredient.name);
   assert.ok(trophies.includes(ingredient.name)||node&&node.levelReq<=recipe.miningLevelReq,`${recipe.id}: ${ingredient.name}`);
  }
  const quote=data.getUpgradeRequirements({level:tier.level,type:'weapon'},9);assert.equal(quote.catalyst,null);
  const later=data.getUpgradeRequirements({level:tier.level,type:'weapon'},10);assert.equal(later.catalyst,data.MINE_CATALYST_BY_ORE[tier.ore]);
  const potion=data.ALCHEMY_RECIPES.find((r:any)=>r.regionId===tier.regionId&&r.heroLevelReq===tier.level);
  if(tier.level>=5){assert.ok(potion.resultStats.heal>0);assert.ok(potion.ingredients.every((i:any)=>trophies.includes(i.name)||data.MINING_NODES.some((n:any)=>n.oreYield===i.name)));}
 }
 const advanced=data.BASIC_CRAFT_RECIPES.filter((r:any)=>r.huntStage);
 assert.ok(advanced.some((r:any)=>r.huntStage==='elite'));assert.ok(advanced.some((r:any)=>r.huntStage==='boss'));
 for(const recipe of advanced)assert.ok(recipe.ingredients.some((i:any)=>i.name===data.regionalSealName(recipe.regionId,recipe.huntStage==='boss')));
});

test('migration preserves old access, new heroes earn regional steps independently, and raid supplies stay optional',()=>{
 const old:any={level:55,statsSummary:{monstersKilled:100}};
 const migrated=data.migrateRegionProgress(old,data.REGIONS);
 assert.equal(data.regionProgress(migrated,data.REGIONS.find((r:any)=>r.id==='reg_cursed')).bossWins,1);
 assert.equal(data.regionProgress(migrated,data.REGIONS.find((r:any)=>r.id==='reg_rift')).kills,0);
 assert.deepEqual(data.migrateRegionProgress(migrated,data.REGIONS),migrated);
 const novice={...old,regionProgress:{}};
 assert.equal(data.regionProgress(novice,data.REGIONS[0]).kills,0);
 assert.ok(data.huntingModeLockReason(novice,data.REGIONS[0],'mod_dense_fog'));
 assert.equal(data.huntingModeLockReason(novice,data.REGIONS[0],'mod_standard'),null);
 assert.ok(data.clanRaidReward(5,0,10).silver>data.clanRaidReward(5,0,0).silver);
 assert.ok(data.clanRaidReward(5,0,10).ore>data.clanRaidReward(5,0,0).ore);
 assert.equal(data.clanRaidItem(15,true).level,99);
});

test('autobattle avoids full-health healing and buff potions, respects ultimates and recovers mana for casters',()=>{
 const stats:any={maxHp:1000,maxMp:100,attack:100,magicAttack:100,defense:100,magicDefense:100,armorPenetration:0,mpRegen:3};
 const heal={id:'heal',levelReq:1,manaCost:10,currentCooldown:0,damageMultiplier:0,healMultiplier:2};
 const strike={id:'strike',levelReq:1,manaCost:10,currentCooldown:0,damageMultiplier:2,damageType:'physical'};
 const player:any={classId:'paladin',level:10,talents:[],skills:[heal,strike],inventory:[{id:'buff',type:'potion',stats:{attackPercent:25}}]};
 const settings:any={useSkills:true,useUltimate:false,healAtHpPercent:40,fleeAtHpPercent:0};
 const monster:any={hp:1000,maxHp:1000,attack:10,magicAttack:10,defense:0,magicDefense:0,mp:0};
 const input:any={player,stats,monster,hp:1000,mp:100,playerEffects:[],monsterEffects:[],settings};
 assert.deepEqual(data.chooseAutoBattleAction(input),{action:'skill',id:'strike'});
 assert.deepEqual(data.chooseAutoBattleAction({...input,hp:350}),{action:'skill',id:'heal'});
 assert.deepEqual(data.chooseAutoBattleAction({...input,player:{...player,skills:[{...strike,isUltimate:true}]}}),{action:'attack'});
 assert.deepEqual(data.chooseAutoBattleAction({...input,mp:0,player:{...player,classId:'mage',skills:[{...strike,damageType:'magic'}]}}),{action:'defend'});
 const guarded={...input,monster:{...monster,attack:400,mp:100,skills:[{id:'heavy',manaCost:0,cooldown:4,damageMultiplier:2,damageType:'physical'}]},player:{...player,skills:[strike,{id:'shield',levelReq:1,manaCost:10,currentCooldown:0,damageMultiplier:0,inflicts:{type:'shield',power:200}}]}};
 assert.deepEqual(data.chooseAutoBattleAction(guarded),{action:'skill',id:'shield'});
});

test('autobattle finishes weak enemies and only shields against meaningful incoming damage',()=>{
 const stats:any={maxHp:1000,maxMp:100,attack:100,magicAttack:100,defense:100,magicDefense:100,armorPenetration:0,mpRegen:3};
 const shield={id:'shield',levelReq:1,manaCost:10,currentCooldown:0,damageMultiplier:0,inflicts:{type:'shield',power:200}};
 const strike={id:'strike',levelReq:1,manaCost:10,currentCooldown:0,damageMultiplier:2,damageType:'physical'};
 const player:any={classId:'knight',level:10,talents:[],skills:[shield,strike],inventory:[]};
 const heavy={id:'heavy',manaCost:0,cooldown:0,damageMultiplier:2,damageType:'physical'};
 const input:any={player,stats,hp:1000,mp:100,playerEffects:[],monsterEffects:[],settings:{useSkills:true,useUltimate:true,healAtHpPercent:40,fleeAtHpPercent:0},monster:{hp:50,maxHp:1000,attack:400,magicAttack:10,defense:0,magicDefense:0,mp:100,skills:[heavy]}};
 assert.deepEqual(data.chooseAutoBattleAction(input),{action:'attack'});
 assert.deepEqual(data.chooseAutoBattleAction({...input,monster:{...input.monster,hp:150}}),{action:'skill',id:'strike'});
 assert.deepEqual(data.chooseAutoBattleAction({...input,monster:{...input.monster,hp:1000,attack:10}}),{action:'skill',id:'strike'});
 assert.deepEqual(data.chooseAutoBattleAction({...input,monster:{...input.monster,hp:1000}}),{action:'skill',id:'shield'});
 // A caster attacks a nearly defeated target instead of repeatedly recovering mana.
 assert.deepEqual(data.chooseAutoBattleAction({...input,mp:0,player:{...player,classId:'mage',skills:[{...strike,damageType:'magic'}]},monster:{...input.monster,hp:220,attack:10}}),{action:'attack'});
 // The same caster may still recover mana early in a long fight.
 assert.deepEqual(data.chooseAutoBattleAction({...input,mp:0,player:{...player,classId:'mage',skills:[{...strike,damageType:'magic'}]},monster:{...input.monster,hp:1000,attack:10}}),{action:'defend'});
});

test('actual hunts unlock elite then boss, award seals and first-boss fragment once, craft earned kits and persist progress',async()=>{
 const ui=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {REGIONS,MONSTERS,BASIC_CRAFT_RECIPES,getRegionMonster} from './src/data/gameData';window.data={REGIONS,MONSTERS,BASIC_CRAFT_RECIPES,getRegionMonster};function Probe(){window.game=useGame();return null;}window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[art,{name:'fixture',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async (args:any)=>({contents:(await fs.readFile(args.path,'utf8')).replace('const [player, setPlayer] = useState<PlayerCharacter | null>(null);','const [player, setPlayer] = useState<PlayerCharacter | null>(null); (window as any).setPlayer = setPlayer;'),loader:'tsx'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});w.Math.random=()=>.5;
 w.eval(ui.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Охотник','knight'));
  await w.act(async()=>w.setPlayer({...w.game.player,attributes:{...w.game.player.attributes,strength:1000000},level:4,nextExp:1e12,maxInventorySlots:1000}));
  const region=w.data.REGIONS[0],enemy=(id:string)=>w.data.getRegionMonster(w.data.MONSTERS[id],region);
  const elite=enemy('elite_reg_plains'),boss=enemy('m_queen_bat');
  const starts=async(m:any)=>{let result=false;await w.act(async()=>{result=w.game.startBattleWithMonster(m,{chain:false,energyCost:0});});return result;};
  assert.equal(await starts(elite),false);assert.equal(await starts(boss),false);
  const win=async(m:any,skill?:string)=>{assert.equal(await starts(m),true);await w.act(async()=>w.game.performPlayerAction(skill?'skill':'attack',skill));assert.equal(w.game.combatOutcome,'victory');await w.act(async()=>w.game.exitCombat());};
  // The knight's holy weapon skill uses Strength/weapon power, not low Intelligence.
  await win(enemy('m_wolf'),'k_smite');
  for(let i=0;i<5;i++)await win(enemy('m_wolf'));
  assert.equal(w.game.player.regionProgress.reg_plains.kills,6);
  assert.equal(await starts(boss),false);await win(elite);assert.equal(await starts(boss),false);await win(elite);
  assert.equal(w.game.player.regionProgress.reg_plains.eliteWins,2);
  const enhanced=w.data.BASIC_CRAFT_RECIPES.find((r:any)=>r.huntStage==='elite'&&r.result.type==='weapon'&&r.result.targetClass==='knight'&&r.regionId===region.id);
  const extra=enhanced.ingredients.filter((i:any)=>!i.name.startsWith('Знак элиты')).map((i:any)=>({id:i.name,templateId:i.name,name:i.name,type:'material',rarity:'common',level:1,upgradeLevel:0,icon:'',stats:{},sellPrice:0,disassembleYield:{},stackCount:i.count}));
  await w.act(async()=>w.setPlayer({...w.game.player,inventory:[...w.game.player.inventory,...extra]}));
  let crafted:any;await w.act(async()=>{crafted=w.game.craftBasicItem(enhanced.id);});assert.equal(crafted.success,true,crafted.message);
  assert.equal(w.game.player.inventory.find((i:any)=>i.templateId===enhanced.id).rarity,'rare');
  await win(boss);assert.equal(w.game.player.regionProgress.reg_plains.bossWins,1);
  const fragments=()=>w.game.player.inventory.filter((i:any)=>i.templateId==='ascension_fragment').reduce((n:number,i:any)=>n+(i.stackCount||1),0);
  assert.equal(fragments(),1);await win(boss);assert.equal(fragments(),1);
  const progress=JSON.stringify(w.game.player.regionProgress);
  await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());assert.equal(JSON.stringify(w.game.player.regionProgress),progress);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
