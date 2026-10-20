import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

for(const style of ['modern','fantasy','fantasy-beta']) test(`${style}: forge previews the exact donor, confirms once and keeps sharpening separate`,async()=>{
  const result=await build({stdin:{contents:`
    import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';
    import {GameContext} from './src/context/GameStateContext';import{ServerProgressContext}from'./src/context/ServerProgressContext';
    import {InterfaceProvider} from './src/context/InterfaceContext';
    import {BlacksmithScreen as Modern} from './src/components/blacksmith/BlacksmithScreen';
    import {BlacksmithScreen as Fantasy} from './src/interfaces/fantasy/components/blacksmith/BlacksmithScreen';
    import {mergeEquipment} from './src/utils/itemAscension';
    const item=(id,extra={})=>({id,templateId:'test_helmet',name:'Шолом',type:'helmet',rarity:'rare',level:10,upgradeLevel:2,icon:'',stats:{defense:100,maxHp:200},sellPrice:20,disassembleYield:{},serverOwned:true,...extra});
    const client={current:{canonical:true},getSnapshot:()=>0,subscribe:()=>()=>{}};
    function App(){const[player,setPlayer]=useState({classId:'warrior',inventory:[item('base'),item('donor',{upgradeLevel:7}),item('protected',{isLocked:true})],equipped:{},maxInventorySlots:10,gold:1000,silver:1000});
      window.player=player;window.change=setPlayer;
      const value={player,achievements:[],upgradeItem:()=>({success:true,message:'OK'}),mergeItems:async(base,material)=>{window.calls.push([base,material]);await new Promise(resolve=>window.release=resolve);const result=mergeEquipment(player,base,material,'split');if(result.player)setPlayer(result.player);return result;}};
      return <ServerProgressContext.Provider value={client}><GameContext.Provider value={value}><InterfaceProvider>{window.style==='modern'?<Modern/>:<Fantasy/>}</InterfaceProvider></GameContext.Provider></ServerProgressContext.Provider>;
    }
    window.calls=[];window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<App/>);};
  `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art"',loader:'js'}));}}]});
  const dom=new JSDOM('<div id="root"></div>',{url:'https://game.test',runScripts:'outside-only'}),w:any=dom.window;
  w.MessageChannel=class{port1={onmessage:null as any};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage?.(),0)}};
  w.IS_REACT_ACT_ENVIRONMENT=true;w.style=style;w.localStorage.setItem('aethelgard_interface_style',style);w.eval(result.outputFiles[0].text);
  const panel=()=>w.document.querySelector('[data-item-ascension]');
  const button=(label:string)=>[...panel().querySelectorAll('button')].find((button:any)=>button.textContent===label) as HTMLButtonElement;
  try{
    await w.act(async()=>w.mount());
    assert.match(panel().textContent,/Піднесення/);assert.match(panel().textContent,/Рідкісність: Рідкісна/);
    assert.match(panel().querySelector('[data-ascension-preview]').textContent,/Захист112 → 156/);
    assert(!w.document.body.textContent.includes('Для заточки серверной вещи нужна серверная кузница'));
    await w.act(async()=>button('Піднести до 1/5').click());assert.equal(w.calls.length,0);
    assert.match(panel().textContent,/Буде витрачено 1 × Шолом \(\+7\)/);
    await w.act(async()=>{button('Підтвердити об’єднання').click();button('Підтвердити об’єднання').click();});
    assert.equal(w.calls.length,1);assert.deepEqual(Array.from(w.calls[0]),['base','donor']);
    assert(button('Об’єднання…').disabled);
    await w.act(async()=>{w.release();await Promise.resolve();});
    assert.equal(w.player.inventory.length,2);assert.equal(w.player.inventory[0].ascensionLevel,1);assert.equal(w.player.inventory[0].upgradeLevel,7);
    assert(w.player.inventory.some((item:any)=>item.id==='protected'));
    assert.match(panel().textContent,/Піднесення: 1\/5/);assert.match(panel().textContent,/Піднесення успішне/);
    await w.act(async()=>w.change((p:any)=>({...p,inventory:[{...p.inventory[0],ascensionLevel:0},{...p.inventory[0],id:'fresh',ascensionLevel:0}]})));
    await w.act(async()=>button('Піднести до 1/5').click());assert(button('Підтвердити об’єднання'));
    await w.act(async()=>w.change((p:any)=>({...p,inventory:p.inventory.map((item:any)=>item.id==='fresh'?{...item,isLocked:true}:item)})));
    assert.equal(button('Підтвердити об’єднання'),undefined);assert.equal(w.calls.length,1);
  }finally{await w.act(async()=>w.root.unmount());dom.window.close();}
});
