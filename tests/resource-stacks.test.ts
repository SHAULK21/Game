import test from 'node:test';
import assert from 'node:assert/strict';
import {addOrStackInventoryItem} from '../src/utils/inventoryStacks';
import {MAX_STACK_COUNT,MAX_TRADE_QUANTITY} from '../src/utils/stackRules';
import {bulkReward,applyBulkDisposal} from '../src/utils/bulkInventory';
const ore=(count:number,id='ore'):any=>({id,templateId:'iron_ore',name:'Железная руда',type:'ore',rarity:'common',stackCount:count,level:1,stats:{}});
test('local resource producers stack beyond lot limit in a full bag, with no split, loss or ledger mutation',()=>{
 for(const count of [998,999,1000,1000000]){
  const bag=[ore(count)];const result=addOrStackInventoryItem(bag,ore(1,'new'),1);
  assert.equal(result.added,true);assert.equal(result.inventory.length,1);assert.equal(result.inventory[0].stackCount,count+1);assert.equal(bag[0].stackCount,count);
 }
 assert.equal(MAX_TRADE_QUANTITY,999);
 const sql=[{...ore(999),serverOwned:true}];assert.equal(addOrStackInventoryItem(sql,ore(1),1).added,false);
 const maximum=[ore(MAX_STACK_COUNT)];assert.equal(addOrStackInventoryItem(maximum,ore(1),1).added,false);assert.equal(maximum[0].stackCount,MAX_STACK_COUNT);
});
test('bulk disposal counts the complete stack and preserves the exact ore reward',()=>{
 const equipment:any={id:'equipment',name:'Клинок',type:'weapon',rarity:'common',stackCount:1000,level:1,stats:{},sellPrice:1,disassembleYield:{ore:1},upgradeLevel:0};
 assert.equal(bulkReward([equipment],'sell').gold,1000);assert.equal(bulkReward([equipment],'disassemble').ore,1000);
 const p:any={inventory:[ore(999),equipment],equipped:{},gold:0,silver:0};
 const result=applyBulkDisposal(p,{operationId:'op',action:'disassemble',filters:{rarities:['common'],type:'all',keepUpgraded:false},localIds:['equipment'],serverIds:[]},{operationId:'op',itemIds:[],ore:0,gold:0,silver:0,count:0});
 assert.equal(result.inventory[0].stackCount,1999);assert.equal(result.inventory.length,1);assert.equal(applyBulkDisposal(result,{operationId:'op'} as any,{} as any).inventory[0].stackCount,1999);
});
