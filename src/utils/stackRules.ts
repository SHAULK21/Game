/** Storage is not a market lot. No splitting or truncation, including a full bag. */
export const MAX_STACK_COUNT=2_147_483_647;
export const MAX_TRADE_QUANTITY=999;
export const validStackCount=(quantity:unknown):quantity is number=>Number.isSafeInteger(quantity)&&Number(quantity)>=1&&Number(quantity)<=MAX_STACK_COUNT;
export function addStackCounts(left:number,right:number){
 const total=left+right;
 if(!validStackCount(left)||!validStackCount(right)||!validStackCount(total))throw new Error('Превышен допустимый запас ресурса. Операция не выполнена.');
 return total;
}
