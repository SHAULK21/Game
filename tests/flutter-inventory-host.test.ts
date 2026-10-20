import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('embedded Flutter view follows confirmed projections, rejects duplicate taps and detaches on tab change',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameContext} from './src/context/GameStateContext';import {FlutterInventoryScreen} from './src/components/inventory/FlutterInventoryScreen';window.act=act;window.render=()=>{window.reactRoot??=createRoot(document.getElementById('root'));window.reactRoot.render(<GameContext.Provider value={window.game}>{window.shown?<FlutterInventoryScreen/>:null}</GameContext.Provider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'engine-fixture',setup(b){b.onLoad({filter:/flutterInventoryLoader\.ts$/},()=>({contents:`let engine;export function loadFlutterInventory(){window.engineLoads=(window.engineLoads||0)+(!engine?1:0);return engine??=Promise.resolve({addView({hostElement}){window.added=(window.added||0)+1;hostElement.dataset.testView='attached';window.aethelgardInventoryUpdate=json=>window.projection=JSON.parse(json);return window.added;},removeView(id){window.removed=(window.removed||0)+1;}});}`,loader:'js'}));b.onLoad({filter:/\.(webp|jpg)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.IS_REACT_ACT_ENVIRONMENT=true;w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
 const item={id:'a',templateId:'sword',name:'Меч',type:'weapon',rarity:'rare',level:1,upgradeLevel:5,ascensionLevel:2,stats:{attack:100},sellPrice:10};
 let calls=0,finish:Function;
 w.game={player:{userId:'17',classId:'warrior',name:'Игрок',level:1,gold:100,silver:20,maxInventorySlots:40,worldPlace:'settlement',inventory:[item],equipped:{}},premium:{active:false},travelState:{isTraveling:false},equipItem:()=>{calls++;return new Promise(resolve=>finish=()=>resolve({success:true,message:'Надето'}));}};
 w.shown=true;w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.render());assert.equal(w.added,1);assert.equal(w.projection.items[0].merge,2);assert.equal(w.document.querySelector('[data-flutter-inventory]').dataset.flutterInventory,'ready');
  const first=w.aethelgardInventoryAction(JSON.stringify({owner:'17',type:'equip',id:'a'}));
  const second=JSON.parse(await w.aethelgardInventoryAction(JSON.stringify({owner:'17',type:'equip',id:'a'})));
  assert.equal(second.success,false);assert.equal(calls,1);finish!();assert.equal(JSON.parse(await first).success,true);
  w.game={...w.game,player:{...w.game.player,gold:150,inventory:[{...item,ascensionLevel:3}]}};
  await w.act(async()=>w.render());assert.equal(w.projection.gold,150);assert.equal(w.projection.items[0].merge,3);assert.equal(w.added,1);
  w.shown=false;await w.act(async()=>w.render());assert.equal(w.removed,1);assert.equal(w.aethelgardInventoryAction,undefined);
  w.shown=true;await w.act(async()=>w.render());assert.equal(w.added,2);assert.equal(w.engineLoads,1);
  const wrong=JSON.parse(await w.aethelgardInventoryAction(JSON.stringify({owner:'other',type:'equip',id:'a'})));assert.equal(wrong.success,false);assert.equal(calls,1);
 }finally{await w.act(async()=>w.reactRoot.unmount());dom.window.close();}
});
