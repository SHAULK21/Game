import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const MINING_NODES=[...readFileSync('src/data/gameData.ts','utf8').split('export const MINING_NODES:')[1].split('export const ALCHEMY_RECIPES:')[0].matchAll(/levelReq: (\d+)/g)].map(m=>({levelReq:Number(m[1])}));
import {PICKAXES,makePickaxe,miningCritChance,miningExperience,rollMiningYield} from '../src/utils/mining';

test('all mines yield one through five; five is always critical and remains rare with best gear',()=>{
 for(const node of MINING_NODES){
  const chance=miningCritChance(node.levelReq,makePickaxe('pickaxe_legendary','test'),100000,true);
  assert.ok(chance>0&&chance<=.025);
  const crit=rollMiningYield(node.levelReq,chance,()=>0);assert.deepEqual(crit,{count:5,isCrit:true});
  const found=new Set<number>();
  for(let i=0;i<10000;i++){let call=0;const result=rollMiningYield(node.levelReq,chance,()=>++call===1 ? .99 : i/10000);assert.equal(result.isCrit,false);assert.ok(result.count>=1&&result.count<=4);found.add(result.count);}
  assert.deepEqual([...found],[1,2,3,4]);
  assert.ok((1-chance)*.03>chance,'five is less frequent than four');
 }
 let call=0;assert.equal(rollMiningYield(1,0,()=>++call===1 ? .99 : .65).count,2);call=0;assert.equal(rollMiningYield(100,0,()=>++call===1 ? .99 : .65).count,1);
});
test('all five pickaxes increase critical chance and mining XP monotonically without combat stats',()=>{
 let chance=miningCritChance(1),xp=miningExperience(100);
 for(const offer of PICKAXES){const item=makePickaxe(offer.id,offer.id);assert.deepEqual(item.stats,{});assert.equal(item.type,'pickaxe');assert.ok(miningCritChance(1,item)>chance);assert.ok(miningExperience(100,item)>xp);chance=miningCritChance(1,item);xp=miningExperience(100,item);assert.ok(item.image?.startsWith('data:image/svg+xml,'));}
 assert.equal(miningExperience(100,makePickaxe('pickaxe_legendary','p')),180);
});
