import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('failed custom artwork tries a sprite, resources try a vector, and terminal fallback does not retry forever',async()=>{
 const bundle=await build({plugins:[localProgressPlugin],stdin:{contents:`import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';import {ItemArtwork} from './src/components/ui/ItemArtwork';function Probe(){const [item,setItem]=useState({name:'Меч',type:'weapon',rarity:'rare',icon:'⚔',image:'/missing.webp'});window.setItem=setItem;return <ItemArtwork item={item}/>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<Probe/>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.eval(bundle.outputFiles[0].text);
 const image=()=>w.document.querySelector('img');const fail=async()=>w.act(async()=>image().dispatchEvent(new w.Event('error')));
 try{
  await w.act(async()=>w.mount());assert.equal(image().getAttribute('src'),'/missing.webp');
  await fail();assert.match(image().getAttribute('src'),/sword.webp$/);
  await fail();assert.equal(image(),null);assert.match(w.document.body.textContent,/⚔/);
  await w.act(async()=>w.setItem({name:'Медная руда',type:'ore',rarity:'common',icon:'⛏'}));
  assert.match(image().getAttribute('src'),/copper-ore.webp$/);
  await fail();assert.match(image().getAttribute('src'),/^data:image\/svg\+xml,/);
  await w.act(async()=>w.setItem({name:'Зелье маны',type:'potion',rarity:'common',icon:'🧪'}));
  assert.match(image().getAttribute('src'),/mana-potion.webp$/);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
