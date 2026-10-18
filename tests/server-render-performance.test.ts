import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('saving status does not rerender the game; confirmed changes still update its UI',async()=>{
 const result=await build({stdin:{contents:`import React,{act} from 'react';import{createRoot}from'react-dom/client';import{ServerGameProvider}from'./src/context/ServerGameProvider';import{useGame}from'./src/context/GameStateContext';import{useServerProgress}from'./src/context/ServerProgressContext';function ClientProbe(){window.client=useServerProgress();return null;}function Probe(){window.renders++;const game=useGame();return <span id="gold">{game.player.gold}</span>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<ServerGameProvider><ClientProbe/><Probe/></ServerGameProvider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'transport',setup(b){
  b.onLoad({filter:/utils[\\/]gameFetch\.ts$/},()=>({contents:`export async function gameFetch(path,init){if(init.method==='POST')await new Promise(resolve=>window.release=resolve);const version=init.method==='POST'?2:1;return {ok:true,json:async()=>({protocol:'server-actions-v1',ownerId:'1',resetVersion:0,version,sessionGeneration:1,activeHere:true,writerPresent:true,migrationOpen:false,canonical:true,save:null,game:{player:{level:1,gold:version}},expeditions:null,serverTime:Date.now(),nextTickAt:null,cues:[],operation:init.method==='POST'?{id:init.headers.get('X-Game-Operation'),outcome:'applied',result:{success:true},replayed:false}:undefined})};}`,loader:'js'}));
  b.onLoad({filter:/utils[\\/]api\.ts$/},()=>({contents:'export function setProgressTransport(){};export async function apiRequest(){return {};}',loader:'js'}));
 } }]});
 const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.IS_REACT_ACT_ENVIRONMENT=true;w.renders=0;w.Headers=Headers;w.AbortSignal=AbortSignal;
 w.Telegram={WebApp:{initData:'verified-by-platform',initDataUnsafe:{user:{id:1,first_name:'Test'}},ready(){}}};
 w.eval(result.outputFiles[0].text);
 try{
  await w.act(async()=>{w.mount();await new Promise(resolve=>setTimeout(resolve,20));});
  assert.equal(w.document.getElementById('gold').textContent,'1');
  const rendered=w.renders;let operation:Promise<unknown>;
  await w.act(async()=>{operation=w.client.mutate('/api/progress/command',{type:'drinkBeer'});await Promise.resolve();});
  assert.match(w.document.querySelector('aside').textContent,/Сохранение/);
  assert.equal(w.renders,rendered,'transport status must not invalidate the game context');
  await w.act(async()=>{w.release();await operation;});
  assert.equal(w.document.getElementById('gold').textContent,'2');assert.ok(w.renders>rendered);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
