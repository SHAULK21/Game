import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('fantasy battle ledger preserves skill gates, combo and manual action', async () => {
  const bundle = await build({ stdin: { resolveDir:process.cwd(),loader:'tsx',contents:`
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';
    import {CombatSkillList} from './src/interfaces/fantasy/components/combat/CombatSkillList';
    window.act=act;window.used=[];
    const base={classId:'warrior',description:'Короткое описание',levelReq:1,manaCost:10,cooldown:2,damageMultiplier:1,damageType:'physical'};
    window.player={classId:'warrior',attributes:{strength:10},level:2,talents:[],skills:[
      {...base,id:'ready',name:'Доступный удар'},
      {...base,id:'level',name:'Высокий уровень',levelReq:3},
      {...base,id:'cooldown',name:'Перезарядка',currentCooldown:2},
      {...base,id:'mana',name:'Дорогой',manaCost:100}
    ]};
    window.render=(turn=true)=>{window.reactRoot??=createRoot(document.getElementById('root'));window.reactRoot.render(<CombatSkillList player={window.player} mana={20} comboReady={['ready']} playerTurn={turn} onUse={id=>window.used.push(id)}/>);};
  ` },bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'} });
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});
  const w:any=dom.window;w.MessageChannel=class {port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)};};w.IS_REACT_ACT_ENVIRONMENT=true;w.eval(bundle.outputFiles[0].text);
  try {
    await w.act(async()=>w.render());
    const entry=(id:string)=>w.document.querySelector(`[data-combat-skill="${id}"]`);
    assert.equal(entry('ready').disabled,false);assert(entry('ready').classList.contains('is-combo'));
    for(const id of ['level','cooldown','mana']) {assert.equal(entry(id).disabled,true);await w.act(async()=>entry(id).click());}
    assert.deepEqual([...w.used],[]);
    assert.match(entry('level').textContent,/Доступно с уровня 3/);
    assert.match(entry('cooldown').textContent,/Перезарядка: 2/);
    assert.match(entry('mana').textContent,/100 MP/);
    assert.match(entry('ready').textContent,/Короткое описание/);
    assert.equal(w.document.querySelector('[data-skill-details]'),null);
    await w.act(async()=>entry('ready').click());assert.deepEqual([...w.used],['ready']);
    await w.act(async()=>w.render(false));assert.equal(entry('ready').disabled,true);
    await w.act(async()=>entry('ready').click());assert.deepEqual([...w.used],['ready']);
  } finally {await w.act(async()=>w.reactRoot.unmount());dom.window.close();}
});
