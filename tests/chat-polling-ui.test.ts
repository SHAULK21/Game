import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('incremental chat polling retains messages arriving between poll and own send, with independent statistics cadence',async()=>{
 const bundle=await build({plugins:[localProgressPlugin],stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import{useGlobalChat}from'./src/hooks/useGlobalChat';function Probe(){window.chat=useGlobalChat();return null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<Probe/>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;Object.defineProperty(w.document,'hidden',{value:false});let now=0;w.Date.now=()=>now;
 const timers:Function[]=[];w.setInterval=(cb:Function)=>{timers.push(cb);return timers.length;};w.clearInterval=()=>{};
 const requests:string[]=[];const message=(id:number)=>({id,text:'Message '+id,display_name:'Test',created_at:'2026-10-07'});
 w.fetch=async(url:string,options:any)=>{requests.push(options?.method==='POST'?'POST '+url:url);return {ok:true,status:200,text:async()=>JSON.stringify(url==='/api/community/stats'?{onlinePlayers:2}:options?.method==='POST'?{message:message(3)}:url.includes('afterId=1')?{messages:[message(2),message(3)]}:url.includes('afterId=3')?{messages:[]}:{messages:[message(1)]})};};
 w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());assert.deepEqual(Array.from(w.chat.renderedMessages,(m:any)=>m.id),[1]);assert.equal(requests.filter(u=>u==='/api/community/stats').length,1);
  await w.act(async()=>w.chat.setInput('Own'));await w.act(async()=>w.chat.send({preventDefault(){}}));assert.deepEqual(Array.from(w.chat.renderedMessages,(m:any)=>m.id),[1,3]);
  now=10000;await w.act(async()=>timers[0]());assert(requests.includes('/api/chat/global?afterId=1'));assert.deepEqual(Array.from(w.chat.renderedMessages,(m:any)=>m.id),[1,2,3]);
  const previous=w.chat.renderedMessages;now=20000;await w.act(async()=>timers[0]());assert.equal(w.chat.renderedMessages,previous);assert.equal(requests.filter(u=>u==='/api/community/stats').length,1);
  now=60000;await w.act(async()=>timers[0]());assert.equal(requests.filter(u=>u==='/api/community/stats').length,2);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
