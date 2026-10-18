import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {GameActor} from '../server/gameActor';
import {shareProgressProjection} from '../src/utils/projectionSharing';

for(const style of ['modern','fantasy'])test(style+': 200 unchanged equipment cards skip wallet rerenders; edits and selection remain live',async()=>{
 const actor=await new GameActor({user:{id:9710,first_name:'UI'},locale:'ru',resetVersion:0,admin:false,premium:{active:false,premiumUntil:null,priceStars:150,periodDays:30}}).initialize();
 await actor.invoke('createCharacter','UI','warrior');const view:any=actor.publicView(),template=Object.values(view.player.equipped).find(Boolean) as any;
 assert.ok(template);view.player.inventory=Array.from({length:200},(_,i)=>({...template,id:'render-'+i,name:'Test '+i,isEquipped:false}));view.player.maxInventorySlots=250;
 const screen=style==='modern'?'src/components/inventory/InventoryScreen':'src/interfaces/fantasy/components/inventory/InventoryScreen';
 const result=await build({stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import{GameContext}from'./src/context/GameStateContext';import{InventoryScreen}from'./${screen}';window.act=act;window.mount=game=>{window.root=createRoot(document.getElementById('root'));window.render=game=>window.root.render(<GameContext.Provider value={game}><InventoryScreen/></GameContext.Provider>);window.render(game);};`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'instrument',setup(b){
  b.onLoad({filter:/inventory[\\/]InventoryScreen\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('}){ useLocale();','}){ (window as any).cardRenders++; useLocale();'),loader:'tsx'}));
  b.onLoad({filter:/\.(webp|jpg)$/},()=>({contents:'export default "art";',loader:'js'}));
 }}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.cardRenders=0;w.eval(result.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount(view));assert.equal(w.cardRenders,200);
  let previous:any={ownerId:'9710',resetVersion:0,game:view,save:null};
  for(let i=0;i<3;i++){
   const next=structuredClone(previous);next.game.player.gold++;
   previous=shareProgressProjection(previous,next);await w.act(async()=>w.render(previous.game));
  }
  assert.equal(w.cardRenders,200,'wallet changes must not redraw item art');
  const changed=structuredClone(previous);changed.game.player.inventory[0].isLocked=true;previous=shareProgressProjection(previous,changed);
  await w.act(async()=>w.render(previous.game));assert.equal(w.cardRenders,201);
  const card=w.document.querySelector('[data-inventory-item="render-0"]');assert.ok(card);await w.act(async()=>card.click());
  assert.ok(w.document.body.textContent.includes('Test 0'));assert.equal(w.cardRenders,201);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
