import test from 'node:test';
import assert from 'node:assert/strict';
import {shareEqualJson,shareProgressProjection} from '../src/utils/projectionSharing';
import {sortScoredEquipment} from '../src/utils/inventorySorting';
test('combat updates retain unchanged item/quest identity; real item edits and resets stay visible',()=>{
 const player={id:'p1',gold:120,inventory:[{id:'a',isLocked:false,stats:{attack:4}},{id:'b',isLocked:false,stats:{attack:8}}],equipped:{}},quests=[{id:'q',done:false}];
 const previous:any={ownerId:'1',resetVersion:0,game:{player,quests,battleLog:[]},save:{player,quests}};
 const next=structuredClone(previous);next.game.battleLog.push({text:'Hit'});next.game.player.gold++;next.save.player=next.game.player;
 const shared=shareProgressProjection(previous,next);
 assert.notEqual(shared.game,previous.game);assert.equal(shared.game!.player!.inventory,player.inventory);assert.equal(shared.game!.quests,quests);
 assert.equal(shared.save!.player,shared.game!.player);assert.equal(shared.game!.player!.gold,121);
 const edited=structuredClone(next);edited.game.player.inventory[0].isLocked=true;
 const changed=shareProgressProjection(shared,edited);assert.notEqual(changed.game!.player!.inventory,player.inventory);
 assert.equal(changed.game!.player!.inventory[1],player.inventory[1]);assert.equal(player.inventory[0].isLocked,false);
 const reset={...next,resetVersion:1};assert.equal(shareProgressProjection(previous,reset),reset);
 assert.deepEqual(shareEqualJson({a:1},{a:1,b:undefined}),{a:1,b:undefined});
});
test('large equipment sort preserves old ordering and computes a score only once per item',()=>{
 const items=Array.from({length:500},(_,i)=>({id:String(i),type:'weapon',stats:{attack:(i*17)%31}})) as any[];
 const equipped:any={weapon:items[45]},reference=[...items].sort((a,b)=>Number(b.id==='45')-Number(a.id==='45')||b.stats.attack-a.stats.attack);
 let scores=0;const sorted=sortScoredEquipment(items,equipped,item=>{scores++;return item.stats.attack;});
 assert.deepEqual(sorted,reference);assert.equal(scores,items.length);assert.equal(items[0].id,'0');
});
