import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { impactCaption, impactStyle } from '../src/components/combat/CombatDamageFeedback';

test('crit, powerful hit, guarded powerful hit and periodic damage have distinct marks',()=>{
 const base={target:'player' as const,amount:42};
 assert.equal(impactStyle({...base,critical:true}),'critical');
 assert.equal(impactStyle({...base,empowered:true}),'super');
 assert.equal(impactStyle({...base,empowered:true,blocked:60}),'shield-super');
 assert.equal(impactCaption({...base,empowered:true,blocked:60},true),'Щит проти потужного удару');
 for(const periodic of ['bleed','poison','burn'] as const) assert.equal(impactStyle({...base,periodic}),periodic);
});

test('all impacts in a turn render even after system logs; independent expiry without another action',async()=>{
 const bundle=await build({plugins:[localProgressPlugin],stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {CombatDamageFeedback} from './src/components/combat/CombatDamageFeedback';window.act=act;window.root=createRoot(document.getElementById('root'));window.render=(battleLog)=>window.root.render(<React.StrictMode><CombatDamageFeedback battleLog={battleLog}/></React.StrictMode>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"development"'}});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'});const w:any=dom.window;w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};w.IS_REACT_ACT_ENVIRONMENT=true;w.eval(bundle.outputFiles[0].text);
 const entries:any[]=[{id:'bleed',impact:{target:'monster',amount:12,periodic:'bleed'}},{id:'poison',impact:{target:'monster',amount:23,periodic:'poison'}},{id:'hit',impact:{target:'player',amount:41,empowered:true,blocked:80}},{id:'system',text:'system'}];
 try {
  await w.act(async()=>w.render(entries));assert.equal(w.document.querySelectorAll('.combat-damage-pop').length,3);assert(w.document.body.textContent.includes('−23'));assert(w.document.querySelector('[data-impact="shield-super"]').textContent.includes('80'));
  await w.act(async()=>await new Promise(r=>setTimeout(r,900)));
  await w.act(async()=>w.render([...entries,{id:'crit',impact:{target:'monster',amount:99,critical:true}}]));
  await w.act(async()=>await new Promise(r=>setTimeout(r,850)));
  assert.equal(w.document.querySelectorAll('.combat-damage-pop').length,1);assert(w.document.body.textContent.includes('−99'));
  await w.act(async()=>await new Promise(r=>setTimeout(r,850)));assert.equal(w.document.querySelectorAll('.combat-damage-pop').length,0);
  await w.act(async()=>w.render([...entries,{id:'new',impact:{target:'monster',amount:8}}]));assert.equal(w.document.querySelectorAll('.combat-damage-pop').length,1);
  await w.act(async()=>w.render([{id:'next-battle'}]));assert.equal(w.document.querySelectorAll('.combat-damage-pop').length,0);
 } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
