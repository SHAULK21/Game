import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import fs from 'node:fs/promises';
test('character UI blocks pending saves and switches only this tab after saving',async()=>{
  const result=await build({stdin:{contents:`
    import React,{act} from 'react';import{createRoot}from'react-dom/client';
    import{CharacterSwitcher}from'./src/components/layout/CharacterSwitcher';
    import{CharactersContext}from'./src/components/layout/CharacterGate';
    import{ServerProgressContext}from'./src/context/ServerProgressContext';
    import{GameContext}from'./src/context/GameStateContext';
    import{activateCharacter}from'./src/utils/characterSession';
    const characters=[{slot:0,id:'749219401',name:'Warrior',level:10},{slot:1,id:'-1',name:'Mage',level:3}];
    activateCharacter(749219401,characters[0]);
    window.client={status:'saved',pending:true,requestInFlight:false};
    window.game={getInterfaceSwitchBlockReason:()=>window.reason,flushProgress:()=>window.events.push('save')};
    window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));
    window.root.render(<CharactersContext.Provider value={{characters,limit:5}}><ServerProgressContext.Provider value={window.client}><GameContext.Provider value={window.game}><CharacterSwitcher/></GameContext.Provider></ServerProgressContext.Provider></CharactersContext.Provider>);};`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"','import.meta.env.VITE_GAME_BACKEND':'"http"'},plugins:[{name:'reload',setup(b){b.onLoad({filter:/CharacterSwitcher\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('window.location.reload()','(window as any).testReload()'),loader:'tsx'}));}}]});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://game.example',runScripts:'outside-only'}),w:any=dom.window;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
  w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.reason='';w.events=[];w.testReload=()=>w.events.push('reload');
  w.fetch=async()=>{throw new Error('offline list refresh');};
  w.eval(result.outputFiles[0].text);
  try {
    await w.act(async()=>w.mount());
    const button=Array.from(w.document.querySelectorAll('button')).find((b:any)=>b.textContent.includes('Mage')) as any;
    await w.act(async()=>button.click());assert.deepEqual([...w.events],[]);
    assert(w.document.querySelector('[role=alert]').textContent.includes('сохранения'));
    w.client.pending=false;w.reason='Бой не завершён';
    await w.act(async()=>button.click());assert.deepEqual([...w.events],[]);
    w.reason='';await w.act(async()=>button.click());
    assert.deepEqual([...w.events],['save','reload']);
    assert.equal(w.sessionStorage.getItem('aethelgard_character_slot_749219401'),'1');
    assert.equal(w.localStorage.getItem('aethelgard_character_slot_749219401'),null);
  } finally {await w.act(async()=>w.root.unmount());dom.window.close();}
});
