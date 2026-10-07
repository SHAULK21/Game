import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('chat skips overlapping polls and hidden windows, resumes on visibility and stops after unmount', async () => {
  const bundle = await build({
    stdin: {contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {ChatScreen} from './src/components/chat/ChatScreen';window.act=act;window.root=createRoot(document.getElementById('root'));window.mount=()=>window.root.render(<ChatScreen/>);`, resolveDir: process.cwd(), loader: 'tsx'},
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: {'process.env.NODE_ENV': '"development"'},
    plugins: [{name:'game',setup(b){b.onResolve({filter:/context\/GameContext$/},()=>({path:'game',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const useGame=()=>({player:{name:"Игрок"}});',loader:'js'}));}}]
  });
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost',runScripts:'outside-only'});
  const w: any = dom.window;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.Headers = Headers;
  let hidden = false;
  Object.defineProperty(w.document, 'hidden', {get:()=>hidden});
  let poll: () => void = () => {};
  let stopped = false;
  w.setInterval = (fn:()=>void) => {poll=fn;return 1;};
  w.clearInterval = () => {stopped=true;};
  let requests = 0;
  const pending: Array<()=>void> = [];
  w.fetch = (path: string) => {
    requests++;
    return new Promise(resolve=>pending.push(()=>resolve({ok:true,status:200,text:async()=>JSON.stringify(path.includes('chat')?{messages:[]}:{onlinePlayers:3})})));
  };
  w.eval(bundle.outputFiles[0].text);
  const finish = async () => {await w.act(async()=>{pending.splice(0).forEach(resolve=>resolve());});};
  try {
    await w.act(async()=>w.mount());
    assert.equal(requests,2);
    await w.act(async()=>{poll();w.document.querySelector('button').click();});
    assert.equal(requests,2,'a slow request must not create parallel polls');
    await finish();
    hidden=true;
    await w.act(async()=>{poll();w.document.dispatchEvent(new w.Event('visibilitychange'));});
    assert.equal(requests,2,'no background polling');
    hidden=false;
    await w.act(async()=>w.document.dispatchEvent(new w.Event('visibilitychange')));
    assert.equal(requests,3,'resume messages immediately without repeating fresh statistics');
    await finish();
    await w.act(async()=>w.document.querySelector('button').click());
    assert.equal(requests,5,'manual refresh remains available');
    await finish();
    await w.act(async()=>w.root.unmount());
    assert.equal(stopped,true);
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    poll();
    assert.equal(requests,5);
  } finally {dom.window.close();}
});
