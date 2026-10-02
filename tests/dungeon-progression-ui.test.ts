import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import fs from 'node:fs/promises';

test('dungeon UI clears defeated enemies, advances consecutive rooms once, and keeps low-level cave access', async () => {
  const bundle = await build({stdin:{contents:`import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {CombatScreen} from './src/components/combat/CombatScreen';import {WorldScreen} from './src/components/world/WorldScreen';
function Harness(){window.game=useGame();const [view,setView]=useState('world');window.view=view;return view==='world'?<WorldScreen onEnterCombatTab={()=>setView('combat')}/>:<CombatScreen onContinueDungeon={()=>setView('world')}/>;}
window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Harness/></GameProvider>);};window.act=act;`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_ADMIN_TELEGRAM_ID':'""'},plugins:[{name:'harness',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('const [player, setPlayer] = useState<PlayerCharacter | null>(null);','const [player, setPlayer] = useState<PlayerCharacter | null>(null); (window as any).setPlayer = setPlayer;').replace('const [activeDungeonRun, setActiveDungeonRun] = useState<DungeonRun | null>(null);','const [activeDungeonRun, setActiveDungeonRun] = useState<DungeonRun | null>(null); (window as any).setRun = setActiveDungeonRun;'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;
  w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true,totalGold:0})});w.Math.random=()=>0.5;
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(bundle.outputFiles[0].text);
  const click=async(label:string)=>{const button=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent.includes(label)) as any;assert.ok(button,`Missing button: ${label}`);await w.act(async()=>button.click());};
  try {
    await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Проверка','warrior'));
    await w.act(async()=>w.setPlayer((p:any)=>({...p,level:1,exp:0,nextExp:1e9,attributes:{...p.attributes,strength:10000},activePet:undefined})));
    const enemy={id:'repeat_guard',name:'Страж',regionId:'reg_whisper_woods',level:5,hp:1,maxHp:1,mp:0,maxMp:0,attack:1,magicAttack:1,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:1,goldReward:1,drops:[]};
    const rooms=[
      {id:'first',roomNumber:1,type:'combat',title:'Первый страж',description:'',resolved:false,monster:{...enemy}},
      {id:'chest',roomNumber:2,type:'treasure',title:'Сундук',description:'',resolved:false},
      {id:'second',roomNumber:3,type:'elite',title:'Второй страж',description:'',resolved:false,monster:{...enemy}},
      {id:'boss',roomNumber:4,type:'boss',title:'Босс',description:'',resolved:false,monster:{...enemy,id:'final_guard',isBoss:true}},
    ];
    await w.act(async()=>w.setRun({dungeonId:'cave_bat',dungeonName:'Проверка пещеры',difficulty:'normal',totalRooms:4,currentRoomIndex:0,rooms,completed:false}));
    for (const index of [0,2,3]) {
      await click('Сразиться с врагом');assert.equal(w.view,'combat');assert.equal(w.game.isCombatEnded,false);assert.ok(w.game.activeMonster.hp>0);
      await w.act(async()=>w.game.performPlayerAction('attack'));
      assert.equal(w.game.combatOutcome,'victory');assert.equal(w.game.activeDungeonRun.rooms[index].resolved,true);
      assert.equal(w.game.activeDungeonRun.kills,[0,2,3].indexOf(index)+1);
      const gold=w.game.player.gold;
      await click(index===3?'Итоги подземелья':'Продолжить подземелье');
      assert.equal(w.view,'world');assert.equal(w.game.isInCombat,false);assert.equal(w.game.activeMonster,null);assert.equal(w.game.player.gold,gold);
      assert.equal(w.game.activeDungeonRun.currentRoomIndex,index===3?3:index+1);
      if(index===0){await click('Открыть сундук');assert.equal(w.game.activeDungeonRun.currentRoomIndex,2);}
    }
    assert.equal(w.game.activeDungeonRun.completed,true);assert.ok(w.game.activeDungeonRun.completionReward);
    const gold=w.game.player.gold;await w.act(async()=>{assert.equal(w.game.proceedDungeonRoom('fight'),false);assert.equal(w.game.proceedDungeonRoom('fight'),false);});assert.equal(w.game.player.gold,gold);
    await click('Вернуться в город');assert.equal(w.game.activeDungeonRun,null);
    // A failed room start must leave the player on the dungeon screen.
    await w.act(async()=>{w.setRun({dungeonId:'cave_bat',dungeonName:'Повтор',difficulty:'normal',totalRooms:1,currentRoomIndex:0,rooms:[rooms[0]],completed:false});w.setPlayer((p:any)=>({...p,miningExpedition:{startedAt:Date.now(),endsAt:Date.now()+3600000,durationHours:1,rewards:[]}}));});
    await click('Сразиться с врагом');assert.equal(w.view,'world');assert.equal(w.game.isInCombat,false);
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
