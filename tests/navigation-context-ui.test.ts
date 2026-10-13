import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import fs from 'node:fs/promises';

test('real navigation restores menu/history, Back returns to world and travel prevents changing screens',async()=>{
 const bundle=await build({stdin:{contents:`import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {NavigationProvider,useNavigation} from './src/context/NavigationContext';function Probe(){window.game=useGame();window.nav=useNavigation();return <p>{window.nav.currentTab}</p>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><NavigationProvider><Probe/></NavigationProvider></GameProvider>);};`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'art-and-seed',setup(b){b.onLoad({filter:/GameContext\.tsx$/},async args=>({contents:(await fs.readFile(args.path,'utf8')).replace('const [player, setPlayerState] = useState<PlayerCharacter | null>(null);','const [player, setPlayerState] = useState<PlayerCharacter | null>(null); (window as any).setPlayer = setPlayerState;'),loader:'tsx'}));b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art";',loader:'js'}));}}]});
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',runScripts:'outside-only'}),w:any=dom.window;
 w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
 w.IS_REACT_ACT_ENVIRONMENT=true;w.Headers=Headers;w.Math.random=()=>.5;w.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});
 w.eval(bundle.outputFiles[0].text);
 try{
  await w.act(async()=>w.mount());await w.act(async()=>w.game.createCharacter('Навигация','warrior'));
  await w.act(async()=>w.setPlayer((p:any)=>({...p,firstJourney:'done',firstJourneyDeparture:false,statPoints:0})));
  await w.act(async()=>w.nav.setCurrentTab('world'));await w.act(async()=>w.nav.setCurrentTab('alchemy'));
  assert.equal(w.nav.currentTab,'alchemy');await w.act(async()=>w.nav.goBack());assert.equal(w.nav.currentTab,'world');
  await w.act(async()=>w.nav.setCurrentTab('menu'));assert.equal(w.nav.currentTab,'menu');
  const characterId=w.game.player.id;await w.act(async()=>w.root.unmount());await w.act(async()=>w.mount());
  assert.equal(w.nav.currentTab,'menu');assert.equal(w.game.player.id,characterId);await w.act(async()=>w.nav.goBack());assert.equal(w.nav.currentTab,'world');
  await w.act(async()=>{const result=w.game.startTravel('reg_plains');assert(result.success,result.message);});assert(w.game.travelState.isTraveling);
  await w.act(async()=>{w.nav.setCurrentTab('blacksmith');w.nav.setIsCharacterSheetOpen(true);w.nav.goBack();});
  assert.equal(w.nav.currentTab,'world');assert.equal(w.nav.isCharacterSheetOpen,false);
 }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
