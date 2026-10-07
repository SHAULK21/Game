import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {makePickaxe} from '../src/utils/mining';
import {makeAlchemyTool} from '../src/utils/alchemy';
import {fishingMovement} from '../src/utils/fishing';
import {arenaOpponents,arenaMonster} from '../src/utils/arena';
import {prepareMonsterForCombat} from '../src/utils/monsterAI';
import {getItemArtworkPath as fantasyArtwork} from '../src/interfaces/fantasy/utils/itemArtwork';
import {applyClassGear} from '../src/utils/classEquipment';

const bundle=build({stdin:{contents:`import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';
import {GameProvider,useGame} from './src/context/GameContext';import {InterfaceProvider,useInterface} from './src/context/InterfaceContext';import {NavigationProvider,useNavigation} from './src/context/NavigationContext';
import {MiningScreen} from './src/components/mining/MiningScreen';import {AlchemyScreen} from './src/components/alchemy/AlchemyScreen';import {ArenaScreen} from './src/components/arena/ArenaScreen';import {FishingScreen} from './src/components/fishing/FishingScreen';
import {MiningScreen as FantasyMine} from './src/interfaces/fantasy/components/mining/MiningScreen';import {AlchemyScreen as FantasyAlchemy} from './src/interfaces/fantasy/components/alchemy/AlchemyScreen';import {ArenaScreen as FantasyArena} from './src/interfaces/fantasy/components/arena/ArenaScreen';
import {ModernGameContent} from './src/interfaces/modern/ModernGameContent';import {FantasyGameContent} from './src/interfaces/fantasy/FantasyGameContent';
function Probe(){const [full,setFull]=useState(false);window.full=setFull;window.game=useGame();window.theme=useInterface();window.nav=useNavigation();const [screen,setScreen]=useState('mine');window.screen=setScreen;const fantasy=window.theme.style!=='modern';const Screen=screen==='mine'?(fantasy?FantasyMine:MiningScreen):screen==='alchemy'?(fantasy?FantasyAlchemy:AlchemyScreen):screen==='arena'?(fantasy?FantasyArena:ArenaScreen):FishingScreen;if(full)return fantasy?<FantasyGameContent/>:<ModernGameContent/>;return window.game.player?<Screen onEnterCombatTab={()=>{window.entered=true;}}/>:null;}
window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><InterfaceProvider><NavigationProvider><Probe/></NavigationProvider></InterfaceProvider></GameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});

for(const style of ['modern','fantasy','fantasy-beta']) test(`${style}: actual profession and fishing buttons, legacy tools, finished combat and gladiator rewards`,async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,isAdmin:false,clan:null,clans:[],messages:[],players:[],listings:[]})});w.localStorage.setItem('aethelgard_interface_style',style);w.eval((await bundle).outputFiles[0].text);
 const button=(label:string)=>{const b=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent.trim()===label) as any;assert(b,`missing ${label}`);return b;};
 const click=async(label:string)=>{const b=button(label);assert(!b.disabled,`disabled ${label}`);await w.act(async()=>b.click());};
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Тест','warrior'));
  assert.equal(w.document.querySelector('[data-pickaxe-status]').dataset.pickaxeStatus,'missing');assert(button('Купить · 250 золота').disabled);assert.match(w.document.querySelector('[data-pickaxe-offer=pickaxe_common]').textContent,/нужно 250, у вас 120/);
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));seed.player.firstJourney='done';seed.player.firstJourneyDeparture=false;seed.player.statPoints=0;seed.player.gold=200000;seed.player.miningLevel=80;seed.player.alchemyLevel=80;seed.player.attributes.strength=1000000;
  // Old saves can have a stale equipped flag, missing template IDs, and a tool level above hero level.
  const pick=makePickaxe('pickaxe_legendary','legacy_pick'),retort=makeAlchemyTool('retort_legendary','legacy_retort');delete (pick as any).templateId;delete (retort as any).templateId;pick.isEquipped=true;retort.isEquipped=true;pick.level=80;retort.level=80;seed.player.inventory.push(pick,retort);
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(seed));await w.act(async()=>w.mount());
  const weapon=w.game.player.equipped.weapon.id;
  const offer=()=>w.document.querySelector('[data-pickaxe-offer=pickaxe_common]');const gold=w.game.player.gold;
  const buy=button('Купить · 250 золота');await w.act(async()=>{buy.click();buy.click();});assert.equal(w.game.player.gold,gold-250);assert.equal(w.game.player.inventory.filter((i:any)=>i.templateId==='pickaxe_common').length,1);assert.match(offer().textContent,/Куплена · в сумке/);assert.match(w.document.querySelector('[data-pickaxe-status] [role=status]').textContent,/Куплена/);
  await click('Установить');assert.equal(w.game.player.equipped.pickaxe.templateId,'pickaxe_common');assert.match(offer().textContent,/Установлена · бонус действует/);assert(offer().querySelector('button').disabled);assert.equal(w.game.player.gold,gold-250);
  await click('Экипировать');assert.equal(w.game.player.equipped.pickaxe.id,pick.id);assert.equal(w.game.player.equipped.weapon.id,weapon);assert.match(w.document.body.textContent,/Экипировано/);assert.equal(w.document.querySelector('[data-pickaxe-status]').dataset.pickaxeStatus,'installed');
  await click('Снять');assert(!w.game.player.equipped.pickaxe);await click('Экипировать');
  await w.act(async()=>w.screen('alchemy'));await click('Экипировать');assert.equal(w.game.player.equipped.alchemyTool.id,retort.id);assert.match(w.document.body.textContent,/80% опыта/);await click('Снять');await click('Экипировать');
  await w.act(async()=>w.screen('arena'));assert.equal(w.document.querySelectorAll('button').length>=9,true);assert.match(w.document.body.textContent,/EXP/);const tickets=w.game.player.arenaTickets;
  await click('В бой');assert(w.entered);assert.equal(w.game.player.arenaTickets,tickets-1);const enemy=w.game.activeMonster;assert(enemy.id.startsWith('gladiator_'));assert(enemy.hp>0 && enemy.hp<=enemy.maxHp);
  await w.act(async()=>{assert.equal(w.game.challengeArena(arenaOpponents(1)[0]),false);});assert.equal(w.game.player.arenaTickets,tickets-1);
  w.Math.random=()=>.5;await w.act(async()=>w.game.performPlayerAction('attack'));assert.equal(w.game.combatOutcome,'victory');assert.equal(w.game.lastCombatReward.exp,enemy.expReward);assert.equal(w.game.lastCombatReward.gold,0);assert.equal(w.game.lastCombatReward.silver,0);assert.equal(w.game.lastCombatReward.items.length,0);
  // Remain on the completed combat screen state: fishing must still be playable.
  assert(w.game.isInCombat);assert(w.game.isCombatEnded);await w.act(async()=>w.screen('fishing'));
  await click('Журнал улова');assert.match(w.document.body.textContent,/Самый крупный улов/);await click('Рыба и алхимия');await click('Перейти в алхимию');assert.equal(w.nav.currentTab,'alchemy');await click('Берег');
  await click('Забросить удочку · 4 выносливости');let c=w.game.player.fishing.cast;assert(c);await click('Смотать леску');assert(!w.game.player.fishing.cast);
  await click('Забросить удочку · 4 выносливости');c=w.game.player.fishing.cast;let clock=c.biteAt;w.Date.now=()=>clock;await w.act(async()=>w.dispatchEvent(new w.Event('focus')));await click('Подсечь');assert(w.game.player.fishing.cast.fight);
  for(let n=0;n<26;n++){
   c=w.game.player.fishing.cast;const f=c.fight;if(f.progress>=100)break;assert(!f.lost);const move=fishingMovement(c);const action=f.tension>=65?'slack':move.mood==='rush'&&f.tension>25&&f.energy>15?'brace':'pull';clock=f.readyAt+1;
   await w.act(async()=>w.dispatchEvent(new w.Event('focus')));
   const label=action==='pull'?'Подтянуть':action==='slack'?'Отпустить':'Удержать';const b=[...w.document.querySelectorAll('button')].find((b:any)=>b.querySelector('strong')?.textContent===label) as any;assert(b&&!b.disabled);await w.act(async()=>b.click());
  }
  assert.equal(w.game.player.fishing.cast.fight.progress,100);await click('Забрать улов');assert.equal(w.game.player.fishing.catches,1);assert(!w.game.player.fishing.cast);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});

test('arena scales at every level, preserves class tactics and previews the exact base reward',()=>{
 for(const level of [1,10,40,100]){
  const opponents=arenaOpponents(level);assert.equal(opponents.length,6);
  assert(opponents.at(-1)!.expReward>opponents[0].expReward);
  for(const opponent of opponents){const monster=arenaMonster(opponent.id,level)!;assert.equal(monster.level,level);assert.equal(monster.expReward,opponent.expReward);assert.equal(prepareMonsterForCombat(monster).expReward,opponent.expReward);assert.equal(prepareMonsterForCombat(monster).maxHp,monster.maxHp);assert(monster.skills?.length);assert.equal(monster.drops.length,0);assert.equal(monster.goldReward,0);}
 }
 assert.equal(arenaMonster('unknown',1),undefined);
 assert(arenaMonster('opp_3',10)!.magicAttack>arenaMonster('opp_3',10)!.attack);
 assert.equal(arenaMonster('opp_2',10)!.skills![0].effect,'bleed');
});

test('fantasy weapon families and old relic images match the actual equipment',()=>{
 for(const [name,weaponClass,sprite] of [['Лук','bow','bow'],['Посох','staff','staff'],['Парные клинки','dagger','dagger'],['Секира','twoHanded','axe'],['Священный молот','twoHanded','hammer']] as const)assert.match(fantasyArtwork({name,type:'weapon',weaponClass}),new RegExp('/'+sprite+'\\.webp$'));
 const bow=applyClassGear({id:'old',templateId:'old',sellPrice:1,disassembleYield:{silver:1},name:'Лук',type:'weapon',rarity:'legendary',level:1,upgradeLevel:0,icon:'⚔️',weaponClass:'bow',image:'/old-relic-sword.webp',stats:{attack:20}},'archer');assert.match(bow.image!,/bow.webp$/);
 assert.equal(fantasyArtwork({name:'Речной окунь',type:'material',image:'/assets/fishing/perch.webp'}),'/assets/fishing/perch.webp');
});


test('all game chapters in three interfaces render enabled buttons with working handlers',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.AbortSignal=AbortSignal;
 const errors:any[]=[];w.addEventListener('error',(event:any)=>errors.push(event.error));
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({resetVersion:0,active:false,items:[],ok:true,isAdmin:false,clan:null,clans:[],messages:[],players:[],listings:[],opponents:[],members:[],onlinePlayers:0,totalGold:0,notifications:[],settings:{enabled:false,onboardingSeen:true},botStarted:true,preferences:{},profile:{enrolled:false,stance:"balanced",rating:1000,tickets:5,wins:0,losses:0},history:[],leaders:[],resetAt:new Date().toISOString()})});
 w.eval((await bundle).outputFiles[0].text);
 const settle=()=>w.act(async()=>await new Promise(resolve=>setTimeout(resolve,45)));
 let checked=0;
 const check=()=>{for(const button of w.document.querySelectorAll('button:not(:disabled)')){
  if(button.closest('[inert]'))continue;
  const props=button[Object.keys(button).find(key=>key.startsWith('__reactProps$'))!];
  assert(typeof props?.onClick==='function' || button.type==='submit' && button.closest('form'),`enabled button without action: ${w.theme.style}/${w.nav.currentTab}/${button.textContent}`);checked++;
 }};
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Проверка','warrior'));
  const seed=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));seed.player.firstJourney='done';seed.player.firstJourneyDeparture=false;seed.player.statPoints=0;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(seed));await w.act(async()=>w.mount());await w.act(async()=>w.full(true));
  for(const style of ['modern','fantasy','fantasy-beta']){
   await w.act(async()=>w.theme.setStyle(style));
   for(const tab of ['hunter','world','character','arena','inventory','blacksmith','crafting','alchemy','mine','fishing','clan','chat','market','pets','leaderboard','more']){
    await w.act(async()=>w.nav.setCurrentTab(tab));await settle();assert(w.document.querySelector('main')?.textContent.trim(),`${style}/${tab} rendered`);check();
    // Actually activate local tab controls, not just inspect their presence.
    const tabs=[...w.document.querySelectorAll('main button[role=tab],main button[aria-pressed]')].filter((b:any)=>!b.disabled);
    for(const button of tabs){if(button.isConnected){await w.act(async()=>button.click());await settle();check();}}
   }
  }
  assert.equal(errors.length,0,errors.map(String).join('\n'));assert(checked>300);console.log(`Verified ${checked} enabled button instances across all three interfaces.`);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
