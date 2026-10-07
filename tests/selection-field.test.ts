import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {JSDOM} from 'jsdom';
test('all themes search rich items, preserve disabled choices and restore focus without losing form changes',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';import {InterfaceProvider,useInterface} from './src/context/InterfaceContext';import {SelectionField} from './src/components/ui/SelectionField';import {ItemSelector} from './src/components/ui/ItemSelector';function Probe(){const [value,set]=useState('one');window.value=value;const [busy,setBusy]=useState(false);window.busy=setBusy;window.theme=useInterface().setStyle;return <><SelectionField aria-label="Выбор дороги" value={value} disabled={busy} onChange={e=>set(e.target.value)}><option value="one">Лёгкая дорога</option><option value="two">Опасная дорога</option><option value="locked" disabled>Закрытая дорога</option></SelectionField><ItemSelector label="Предмет для продажи" value="" items={[{id:'sword',name:'Длинное имя меча королевского рыцаря',type:'weapon',rarity:'rare',level:7,upgradeLevel:4,stackCount:1,icon:'',stats:{},sellPrice:0,disassembleYield:{}}]} onSelect={id=>{window.item=id}}/></>};window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<InterfaceProvider><Probe/></InterfaceProvider>)};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',plugins:[localProgressPlugin,{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art"',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.eval(bundle.outputFiles[0].text);
 const trigger=()=>w.document.querySelector('button[aria-label="Выбор дороги"]');const key=(k:string)=>w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
 try{await w.act(async()=>w.mount());await w.act(async()=>trigger().click());assert.equal(w.document.body.style.overflow,'hidden');assert.equal(w.document.activeElement.type,'search');assert.ok(w.document.querySelector('[role=option][disabled]'));
 const input=w.document.querySelector('input');await w.act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(input,'опас');input.dispatchEvent(new w.Event('input',{bubbles:true}));});assert.equal(w.document.querySelectorAll('[role=option]').length,1);
 await w.act(async()=>key('ArrowDown'));assert.equal(w.document.activeElement.getAttribute('role'),'option');await w.act(async()=>w.document.activeElement.click());assert.equal(w.value,'two');assert.equal(w.document.querySelector('[role=dialog]'),null);assert.equal(w.document.activeElement,trigger());assert.equal(w.document.body.style.overflow,'');
 await w.act(async()=>trigger().click());await w.act(async()=>key('Escape'));assert.equal(w.document.querySelector('[role=dialog]'),null);assert.equal(w.value,'two');
 await w.act(async()=>w.document.querySelector('button[aria-label="Предмет для продажи"]').click());assert.ok(w.document.body.textContent.includes('Длинное имя меча королевского рыцаря'));assert.ok(w.document.querySelector('[role=option]').textContent.includes('+4'));await w.act(async()=>w.document.querySelector('[role=option]:not(:disabled)').click());assert.equal(w.item,'sword');
 await w.act(async()=>trigger().click());await w.act(async()=>w.busy(true));assert.equal(w.document.querySelector('[role=dialog]'),null);assert.equal(trigger().disabled,true);
 for (const theme of ['fantasy','fantasy-beta']) {
 await w.act(async()=>{w.busy(false);w.theme(theme)});
 assert.equal(w.document.querySelectorAll('button[aria-haspopup=dialog]').length,2);
 assert.equal(w.document.querySelector('select').hidden,true);
 await w.act(async()=>trigger().click());
 assert.equal(w.document.querySelectorAll('[role=option]').length,3);
 await w.act(async()=>w.document.querySelector('[role=option]').click());
 assert.equal(w.value,'one');assert.ok(!w.document.querySelector('[role=dialog]'));
 assert.equal(w.document.activeElement,trigger());
 await w.act(async()=>w.document.querySelector('button[aria-label="Предмет для продажи"]').click());
 await w.act(async()=>w.document.querySelector('[role=option]:not(:disabled)').click());
 assert.equal(w.item,'sword');assert.equal(w.document.body.style.overflow,'');
 }
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
