import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const MINING_NODES=[...readFileSync('src/data/gameData.ts','utf8').split('export const MINING_NODES:')[1].split('export const ALCHEMY_RECIPES:')[0].matchAll(/levelReq: (\d+)[^\n]+baseYieldMin: (\d+), baseYieldMax: (\d+)/g)].map(m=>({levelReq:Number(m[1]),min:Number(m[2]),max:Number(m[3])}));
import {PICKAXES,makePickaxe,miningCritChance,miningExperience,rollMiningYield} from '../src/utils/mining';

test('veins use distinct ranges; their maximum is a rare critical with all pickaxes',()=>{
 for(const node of MINING_NODES){
  const chance=miningCritChance(node.levelReq,makePickaxe('pickaxe_legendary','test'),100000,true);
  assert.ok(chance>0&&chance<=.025);
  const crit=rollMiningYield(node.levelReq,chance,()=>0,node);assert.deepEqual(crit,{count:node.max,isCrit:true});
  const found=new Set<number>();
  for(let i=0;i<10000;i++){let call=0;const result=rollMiningYield(node.levelReq,chance,()=>++call===1 ? .99 : i/10000,node);assert.equal(result.isCrit,false);assert.ok(result.count>=1&&result.count<node.max);found.add(result.count);}
  assert.deepEqual([...found],Array.from({length:node.max-1},(_,i)=>i+1));
  assert.ok(node.max>=2&&node.max<=7);
 }
 assert.ok(new Set(MINING_NODES.map(node=>node.max)).size>=4);
 let call=0;assert.equal(rollMiningYield(1,0,()=>++call===1 ? .99 : .65).count,2);call=0;assert.equal(rollMiningYield(100,0,()=>++call===1 ? .99 : .65).count,1);
});
test('all five pickaxes increase critical chance and mining XP monotonically without combat stats',()=>{
 let chance=miningCritChance(1),xp=miningExperience(100);
 for(const offer of PICKAXES){const item=makePickaxe(offer.id,offer.id);assert.deepEqual(item.stats,{});assert.equal(item.type,'pickaxe');assert.ok(miningCritChance(1,item)>chance);assert.ok(miningExperience(100,item)>xp);chance=miningCritChance(1,item);xp=miningExperience(100,item);assert.ok(item.image?.startsWith('data:image/svg+xml,'));}
 assert.equal(miningExperience(100,makePickaxe('pickaxe_legendary','p')),180);
});
