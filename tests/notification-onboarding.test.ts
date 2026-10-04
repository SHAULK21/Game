import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { recordTelegramWriteAccess } from '../server/telegramWriteAccess';

async function setup(settings: Record<string,boolean> = {}, granted = true, botStarted = false) {
  const bundle = await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {NotificationOnboarding} from './src/components/notifications/NotificationOnboarding';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.render=()=>window.root.render(<NotificationOnboarding/>);window.render();};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'game-state',setup(b){b.onResolve({filter:/context\/GameContext$/},()=>({path:'game-state',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useGame=()=>window.gameState;',loader:'js'}));}}]});
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});
  const w:any=dom.window;w.Headers=Headers;w.IS_REACT_ACT_ENVIRONMENT=true;w.gameState={player:{},offlineReport:null};
  w.MessageChannel=class {port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
  const writes:{path:string;body:any}[]=[];let permissionCalls=0;let current={...settings};
  w.Telegram={WebApp:{initData:'signed-session',initDataUnsafe:{user:{id:123}},requestWriteAccess:(callback:any)=>{permissionCalls++;callback(granted);},openTelegramLink:()=>{}}};
  w.fetch=async(path:string,options:any={})=>{
    if(options.method==='POST') {
      const body=JSON.parse(options.body);writes.push({path,body});
      if(path==='/api/notifications/settings')current={...body,onboardingSeen:true};
      if(path==='/api/notifications/onboarding')current={...current,onboardingSeen:true};
    }
    return {ok:true,status:200,text:async()=>JSON.stringify(path==='/api/referrals'?{url:'https://t.me/game_bot?start=ref_123'}:{settings:current,botStarted})};
  };
  w.eval(bundle.outputFiles[0].text);
  const settle=()=>w.act(async()=>{await new Promise(r=>setTimeout(r,20));});
  const mount=async()=>{await w.act(async()=>w.mount());await settle();};
  const click=async(text:string)=>{const button=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent===text) as any;assert(button);await w.act(async()=>button.click());await settle();};
  const close=async()=>{await w.act(async()=>w.root.unmount());dom.window.close();};
  return {w,dom,writes,mount,click,settle,close,permissionCalls:()=>permissionCalls};
}

test('first-entry Later persists without subscribing; reopening does not prompt again',async()=>{
  const h=await setup();try{
    await h.mount();assert(h.w.document.querySelector('[role="dialog"]'));
    await h.click('Позже');assert.equal(h.permissionCalls(),0);
    assert.deepEqual(h.writes.map(x=>x.path),['/api/notifications/onboarding']);
    assert.equal(h.w.document.querySelector('[role="dialog"]'),null);
    await h.w.act(async()=>h.w.root.unmount());await h.mount();
    assert.equal(h.w.document.querySelector('[role="dialog"]'),null);
  }finally{await h.close();}
});

test('permission denial never subscribes; acceptance persists and closes the prompt',async()=>{
  const denied=await setup({},false);try{
    await denied.mount();await denied.click('Включить');assert.equal(denied.permissionCalls(),1);
    assert.equal(denied.writes.length,0);assert(denied.w.document.querySelector('[role="alert"]'));
    assert(denied.w.document.querySelector('[role="dialog"]'));
  }finally{await denied.close();}
  const allowed=await setup({market:false});try{
    await allowed.mount();await allowed.click('Включить');assert.equal(allowed.permissionCalls(),1);
    assert.equal(allowed.writes[0].body.enabled,true);assert.equal(allowed.writes[0].body.market,false);
    assert.equal(allowed.w.document.querySelector('[role="dialog"]'),null);
  }finally{await allowed.close();}
});

test('existing choices are respected and browsers outside Telegram are not prompted',async()=>{
  for(const settings of [{enabled:true},{enabled:false},{onboardingSeen:true}] as Record<string,boolean>[]) {
    const h=await setup(settings);try{await h.mount();assert.equal(h.w.document.querySelector('[role="dialog"]'),null);assert.equal(h.permissionCalls(),0);}finally{await h.close();}
  }
  const h=await setup();try{delete h.w.Telegram;await h.mount();assert.equal(h.w.document.querySelector('[role="dialog"]'),null);}finally{await h.close();}
});

test('permission service message enables delivery without opting the player into notifications',async()=>{
  const writes:any[]=[];const pool:any={query:async(sql:string,args:any[])=>{writes.push({sql,args});}};
  assert.equal(await recordTelegramWriteAccess(pool,{chat:{type:'private'},from:{id:123,first_name:'Герой'},write_access_allowed:{from_request:true}}),true);
  assert.equal(writes[0].args[0],123);assert.match(writes[0].sql,/bot_started=TRUE/);
  assert.doesNotMatch(writes[0].sql,/notification_settings/);
  assert.equal(await recordTelegramWriteAccess(pool,{chat:{type:'group'},from:{id:123},write_access_allowed:{}}),false);
  assert.equal(await recordTelegramWriteAccess(pool,{chat:{type:'private'},from:{id:123},text:'/start'}),false);
  assert.equal(writes.length,1);
});

test('onboarding waits for offline rewards and older clients can start the bot',async()=>{
 const h=await setup();try{
   h.w.gameState.offlineReport={minutes:5};delete h.w.Telegram.WebApp.requestWriteAccess;
   let opened='';h.w.Telegram.WebApp.openTelegramLink=(url:string)=>{opened=url;};
   await h.mount();assert.equal(h.w.document.querySelector('[role="dialog"]'),null);
   h.w.gameState.offlineReport=null;await h.w.act(async()=>h.w.render());await h.settle();
   await h.click('Включить');assert.equal(h.permissionCalls(),0);
   assert.equal(opened,'https://t.me/game_bot?start=notifications');
   assert.equal(h.writes[0].body.enabled,true);
 }finally{await h.close();}
});
