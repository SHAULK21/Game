import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
test('admin chooses a ready template, previews recipients and retries without a duplicate operation',async()=>{
 const bundle=await build({plugins:[localProgressPlugin],stdin:{contents:`import React,{act}from'react';import{createRoot}from'react-dom/client';import{AdminBroadcasts}from'./src/components/admin/AdminBroadcasts';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<AdminBroadcasts/>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as null|(()=>void)};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
 w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.crypto.randomUUID=()=>crypto.randomUUID();
 let fail=true,calls=0,request:any=null;
 w.fetch=async(_path:string,options:any)=>{
  let data:any={audiences:Object.fromEntries(['all','premium','regular','active'].map(a=>[a,{players:3,telegram:1}])),recent:[]};
  if(options.method==='POST'){calls++;const body=JSON.parse(options.body);if(request)assert.deepEqual(body,request);request=body;if(fail){fail=false;throw new Error('Lost response');}data={players:3,telegram:1,replayed:true};}
  return {ok:true,status:200,text:async()=>JSON.stringify(data)};
 };
 w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());
  const select=w.document.querySelector('select[aria-label="Шаблон оповещения"]');assert.equal(select.options.length,10);
  await w.act(async()=>{select.value='referral';select.dispatchEvent(new w.Event('change',{bubbles:true}));});
  const button=(text:string)=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent===text) as any;
  await w.act(async()=>button('Предпросмотр').click());assert.equal(calls,0);
  assert.ok(w.document.querySelector('[role="dialog"]').textContent.includes('Каждый игрок получит свою ссылку'));
  await w.act(async()=>button('Отправить оповещение').click());assert.equal(calls,1);assert.equal(request.templateId,'referral');assert.equal(request.details,'');
  assert.ok(button('Повторить отправку'));await w.act(async()=>button('Повторить отправку').click());assert.equal(calls,2);
  assert.equal(w.document.querySelector('[role="dialog"]'),null);assert.ok(w.document.body.textContent.includes('В очередь Telegram: 1'));
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
