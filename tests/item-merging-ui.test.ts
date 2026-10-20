import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('forge merging requires explicit donor selection, shows losses and prevents duplicate taps', async () => {
  const bundle = await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameContext} from './src/context/GameStateContext';import {ItemMergePanel} from './src/components/blacksmith/ItemMergePanel';window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameContext.Provider value={window.game}><ItemMergePanel/></GameContext.Provider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(webp|jpg)$/},()=>({contents:'export default "art"',loader:'js'}));}}]});
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}), w:any=dom.window;
  w.IS_REACT_ACT_ENVIRONMENT=true;
  w.MessageChannel=class {port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};
  const item = (id:string, extra:any={})=>({id,templateId:'sword',name:'Меч',type:'weapon',rarity:'rare',level:5,upgradeLevel:7,stats:{attack:100},icon:'⚔️',...extra});
  let calls=0, finish:Function;
  w.game={player:{classId:'warrior',equipped:{},inventory:[item('base',{mergeLevel:1}),item('donor'),item('wrong',{rarity:'epic'}),item('locked',{isLocked:true})]},mergeItems:(base:string,donor:string)=>{calls++;assert.equal(base,'base');assert.equal(donor,'donor');return new Promise(resolve=>finish=()=>resolve({success:false,message:'Объединение не удалось.'}));}};
  w.eval(bundle.outputFiles[0].text);
  const select=async(index:number,value:string)=>w.act(async()=>{const el=w.document.querySelectorAll('select')[index];el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));});
  const action=()=>[...w.document.querySelectorAll('button')].find((b:any)=>/Объединить и|Объединение…/.test(b.textContent)) as any;
  try {
    await w.act(async()=>w.mount());
    await select(0,'base');
    const donorSelect=w.document.querySelectorAll('select')[1];
    assert.equal(donorSelect.value,''); assert.deepEqual([...donorSelect.options].map((o:any)=>o.value),['','donor']);
    assert.equal(action(),undefined);
    await select(1,'donor');
    assert.match(w.document.body.textContent,/50%/); assert.match(w.document.body.textContent,/Второй предмет исчезнет при любом исходе/);
    await w.act(async()=>{action().click();action().click();});
    assert.equal(calls,1); assert.equal(action().disabled,true);
    await w.act(async()=>finish!());
    assert.match(w.document.querySelector('[role=status]').textContent,/не удалось/);
    assert.equal(w.document.querySelectorAll('select')[1].value,'');
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
