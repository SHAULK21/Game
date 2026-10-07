import type {GameItem} from '../types/game';
import {addStackCounts,validStackCount,MAX_STACK_COUNT} from './stackRules';
/** All local resource producers share this rule; SQL-owned items remain separate projections. */
export function addOrStackInventoryItem(inventory:GameItem[],item:GameItem,maxSlots:number){
 if(!validStackCount(item.stackCount??1))return {inventory,added:false};
 const stackable=['material','ore','potion'].includes(item.type);
 const index=inventory.findIndex(i=>!i.serverOwned&&!item.serverOwned&&i.templateId===item.templateId&&i.type===item.type&&i.name===item.name&&i.rarity===item.rarity);
 if(index>=0&&stackable){
  if((inventory[index].stackCount??1)+(item.stackCount??1)>MAX_STACK_COUNT)return {inventory,added:false};
  const next=[...inventory];next[index]={...next[index],stackCount:addStackCounts(next[index].stackCount??1,item.stackCount??1)};
  return {inventory:next,added:true};
 }
 if(inventory.length>=maxSlots)return {inventory,added:false};
 return {inventory:[...inventory,item],added:true};
}
