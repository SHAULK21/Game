import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryAction,inventoryProjection} from '../src/components/inventory/flutterInventoryBridge';
import type {RuntimeGameContext} from '../src/context/GameStateContext';

const sword=(id:string,extra:any={})=>({id,templateId:'sword',name:'Меч',type:'weapon',rarity:'rare',level:5,upgradeLevel:7,ascensionLevel:2,stats:{attack:100},sellPrice:42,disassembleYield:{ore:1,silver:4},icon:'⚔️',...extra});
function fixture(){
 const calls:any[]=[];
 const game:any={player:{userId:'17',classId:'warrior',name:'Игрок',level:5,gold:500,silver:100,maxInventorySlots:40,worldPlace:'settlement',inventory:[sword('a'),sword('b',{isLocked:true}),sword('c',{upgradeLevel:0,ascensionLevel:0})],equipped:{}},premium:{active:true},isInCombat:false,travelState:{isTraveling:false},
  equipItem:async(item:any)=>{calls.push(['equip',item]);return {success:true,message:'ok'};},sellItem:async(item:any)=>{calls.push(['sell',item]);},toggleItemLock:async(id:any)=>{calls.push(['lock',id]);},bulkDisposeItems:async(...args:any[])=>{calls.push(['bulk',...args]);return {success:true,message:'ok'};}};
 return {game:game as RuntimeGameContext,calls};
}
test('Flutter receives a narrow presentation projection with the same effective enhancement stats',()=>{
 const {game}=fixture(),view=inventoryProjection(game,s=>'t:'+s,'uk')!;
 assert.equal(view.owner,'17');assert.equal(view.items[0].name,'t:Меч');assert.equal(view.items[0].upgrade,7);assert.equal(view.items[0].merge,2);
 assert.equal(view.items[0].stats.find(s=>s.key==='attack')!.value,170);
 assert.equal(view.canAct,true);assert.equal((view as any).actor,undefined);assert.equal((view as any).sessionToken,undefined);
 game.player!.worldPlace='field';assert.equal(inventoryProjection(game,s=>s,'ru')!.canAct,false);
});
test('Flutter action resolves fresh ownership and ignores forged stats and API paths',async()=>{
 const {game,calls}=fixture();const current=game.player!.inventory[0];
 await inventoryAction(game,{owner:'17',type:'equip',id:'a',item:{stats:{attack:999999}},path:'/admin'},()=>{});
 assert.equal(calls[0][1],current);assert.equal(calls[0][1].stats.attack,100);
 await assert.rejects(inventoryAction(game,{owner:'other',type:'sell',id:'a'},()=>{}),/Персонаж изменился/);
 await assert.rejects(inventoryAction(game,{owner:'17',type:'sell',id:'foreign'},()=>{}),/Предмет больше/);
 await assert.rejects(inventoryAction(game,{owner:'17',type:'sell',id:'b'},()=>{}),/Защищено/);
 await assert.rejects(inventoryAction(game,{owner:'17',type:'fetch',id:'a',path:'/api/admin'},()=>{}),/Неизвестное/);
 assert.equal(calls.length,1);
});
test('bulk actions preserve both enhancement axes and only submit still eligible confirmed IDs',async()=>{
 const {game,calls}=fixture();
 await inventoryAction(game,{owner:'17',type:'bulk',action:'sell',filters:{rarities:['rare'],type:'all',keepUpgraded:true},ids:['a','b','c','foreign']},()=>{});
 assert.deepEqual(calls[0][3],['c']);
 (game.premium as any).active=false;
 await assert.rejects(inventoryAction(game,{owner:'17',type:'bulk',action:'sell',filters:{rarities:['rare'],type:'all',keepUpgraded:false},ids:['a']},()=>{}),/Premium/);
 assert.equal(calls.length,1);
});
