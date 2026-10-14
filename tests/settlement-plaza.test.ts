import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const bundle=build({stdin:{contents:`
 import React,{act} from 'react'; import {createRoot} from 'react-dom/client';
 import {GameProvider,useGame} from './src/context/GameContext';
 import {NavigationProvider,useNavigation} from './src/context/NavigationContext';
 import {InterfaceProvider,useInterface} from './src/context/InterfaceContext';
 import {GameInterfaceBridge} from './src/context/GameInterfaceBridge';
 import {FantasyLayout} from './src/interfaces/fantasy/FantasyLayout';
 import {FantasyBetaLayout} from './src/interfaces/fantasy-beta/FantasyBetaLayout';
 import {ModernGameContent} from './src/interfaces/modern/ModernGameContent';
 import {setLanguage} from './src/i18n/locale';
 function Probe(){window.game=useGame();window.nav=useNavigation();const {style}=useInterface();return style==='modern'?<ModernGameContent/>:style==='fantasy-beta'?<FantasyBetaLayout/>:<FantasyLayout/>;}
 window.act=act;window.setLanguage=setLanguage;
 window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<InterfaceProvider><GameProvider><NavigationProvider><GameInterfaceBridge/><Probe/></NavigationProvider></GameProvider></InterfaceProvider>);};
`,resolveDir:process.cwd(),loader:'tsx'},loader:{'.css':'empty'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});

for(const style of ['modern','fantasy','fantasy-beta'])test(`${style}: real town plaza has physical places, isolated quests and working service/settings routes`,async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test/',runScripts:'outside-only',pretendToBeVisual:true}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.AbortSignal=AbortSignal;w.crypto.randomUUID=()=>crypto.randomUUID();
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.HTMLMediaElement.prototype.play=async()=>{};w.HTMLMediaElement.prototype.pause=()=>{};
 w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({resetVersion:0,active:false,items:[],ok:true,totalGold:0,isAdmin:false,clan:null,clans:[],messages:[{id:1,text:"Привет из таверны",display_name:"Путник",created_at:"2026-10-14T18:00:00Z"}],players:[],listings:[],opponents:[],members:[],onlinePlayers:0,notifications:[],settings:{enabled:false,onboardingSeen:true},profile:{enrolled:false},history:[],leaders:[]})});
 w.localStorage.setItem('aethelgard_interface_style',style);w.eval((await bundle).outputFiles[0].text);
 const settle=()=>w.act(async()=>new Promise(resolve=>setTimeout(resolve,25)));
 const plaza=()=>w.document.querySelector('[data-settlement-screen]');
 const place=(id:string)=>plaza().querySelector(`[data-settlement-place="${id}"]`);
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Площадь','warrior'));
  const key='aethelgard_save_v1_data_'+w.game.player.userId,seed=JSON.parse(w.localStorage.getItem(key));seed.player.worldPlace='settlement';
  const quest=seed.quests.find((q:any)=>q.id!=='q_royal_first_journey');quest.currentCount=quest.targetCount;quest.completed=true;quest.claimed=false;
  await w.act(async()=>w.root.unmount());w.localStorage.setItem(key,JSON.stringify(seed));await w.act(async()=>w.mount());await w.act(async()=>w.nav.setCurrentTab('settlement'));await settle();
  assert(plaza());
  assert.deepEqual([...plaza().querySelectorAll('[data-settlement-place]')].map((b:any)=>b.dataset.settlementPlace),['market','quests','crafting','blacksmith','alchemy','arena','clan','pets','chat','fishing','mine']);
  for(const label of ['Настройки','Статистика','Оповещения','Premium','Герой','Достижения','Рейтинг','Журнал приключений'])assert(!plaza().textContent.includes(label),label+' is not a town place');
  const baseline={gold:w.game.player.gold,energy:w.game.player.energy,inventory:JSON.stringify(w.game.player.inventory)};
  // Every real service route uses the actual NavigationProvider and game shell.
  for(const id of ['market','crafting','blacksmith','alchemy','arena','clan','pets','chat','fishing','mine']){
   await w.act(async()=>place(id).click());await settle();assert.equal(w.nav.currentTab,id);assert(w.document.querySelector('main').textContent.trim());
   if(id==='chat'){
    const tavern=w.document.querySelector('[data-tavern-screen]');assert(tavern);
    assert.match(tavern.querySelector('#tavern-chat').textContent,/Привет из таверны/,'real shared chat loads without an extra click');
    assert(tavern.querySelector('#tavern-chat .chat-composer input'));assert.notEqual(w.document.activeElement,tavern.querySelector('input'));
    assert(!tavern.querySelector('.tavern-beer-details').open);assert(!tavern.querySelector('.tavern-art'));assert(!tavern.querySelector('.tavern-chat-toggle'));
   }
   await w.act(async()=>w.nav.setCurrentTab('settlement'));await settle();
  }
  assert.equal(w.game.player.gold,baseline.gold);assert.equal(w.game.player.energy,baseline.energy);assert.equal(JSON.stringify(w.game.player.inventory),baseline.inventory,'visiting services does not start a game operation');
  // The notice board has no sound, notification or account controls.
  const trigger=place('quests');assert(trigger.textContent.includes('Наград к получению: 1'));trigger.focus();await w.act(async()=>trigger.click());
  const dialog=w.document.querySelector('[role="dialog"][aria-label="Доска поручений"]');assert(dialog);assert.equal(w.document.body.style.overflow,'hidden');
  for(const label of ['Настройки','Статистика','Premium','Оповещения'])assert(!dialog.textContent.includes(label));
  await w.act(async()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(w.document.querySelector('.settlement-board'),null);assert.equal(w.document.activeElement,trigger);
  await w.act(async()=>place('quests').click());
  const claim=w.document.querySelector(`[data-quest-id="${quest.id}"] .settlement-quest-claim`);assert(claim);
  await w.act(async()=>{claim.click();claim.click();});assert.equal(w.game.player.gold,baseline.gold+quest.rewardGold,'double click pays once through the real provider');assert(w.game.quests.find((q:any)=>q.id===quest.id).claimed);assert.equal(plaza().querySelector('.settlement-reward-badge'),null);
  await w.act(async()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  await w.act(async()=>w.setLanguage('uk'));assert(plaza().textContent.includes('Площа поселення'));assert(place('quests').textContent.includes('Дошка доручень'));
  await w.act(async()=>place('quests').click());assert(w.document.querySelector('[role="dialog"][aria-label="Дошка доручень"]'));await w.act(async()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await w.act(async()=>w.setLanguage('ru'));
  // Choosing the gate previews the route rather than starting it.
  for(const destination of ['lands','dungeons']){
   const gate=plaza().querySelectorAll('.settlement-road')[destination==='lands'?0:1];await w.act(async()=>gate.click());await settle();assert.equal(w.nav.currentTab,'world');assert.equal(w.game.player.worldPlace,'settlement');assert.equal(w.game.player.worldJourney,undefined);assert.equal(w.game.player.energy,baseline.energy);
   const selected=style==='modern'?w.document.querySelector('[data-world-section]')?.dataset.worldSection:w.document.querySelector('.world-codex [aria-pressed=true]')?.textContent;assert.equal(selected,style==='modern'?destination:destination==='lands'?'Поля':'Пещеры');
   await w.act(async()=>w.nav.setCurrentTab('settlement'));await settle();
  }
  // Device settings are available from the existing menu while on the field.
  const saved=JSON.parse(w.localStorage.getItem(key));saved.player.worldPlace='field';await w.act(async()=>w.root.unmount());w.localStorage.setItem(key,JSON.stringify(saved));await w.act(async()=>w.mount());await w.act(async()=>w.nav.setCurrentTab('hunter'));await settle();
  const more=[...w.document.querySelectorAll('nav button')].find((b:any)=>b.textContent.trim().startsWith(style==='modern'?'Меню':'Ещё'));assert(more);await w.act(async()=>more.click());await settle();
  const settings=[...w.document.querySelectorAll(style==='modern'?'.mechanics-menu button':'.game-drawer button')].find((b:any)=>b.textContent.trim()==='Настройки');assert(settings);await w.act(async()=>settings.click());await settle();assert.equal(w.nav.currentTab,'more');assert(w.document.querySelector('main').textContent.includes('Звук и оповещения на этом устройстве'));assert.equal(w.game.player.worldPlace,'field');assert.equal(w.game.player.worldJourney,undefined);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
