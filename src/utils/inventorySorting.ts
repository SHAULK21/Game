import type {GameItem,PlayerCharacter} from '../types/game';
/** Decorate once rather than recalculating sharpened/class stats for every
 * comparison. Stable ties and equipped-first order match the original sort. */
export function sortScoredEquipment(items:GameItem[],equipped:PlayerCharacter['equipped'],score:(item:GameItem)=>number){
 return items.map((item,index)=>({item,index,equipped:equipped[item.type]?.id===item.id?1:0,score:score(item)}))
  .sort((a,b)=>b.equipped-a.equipped||b.score-a.score||a.index-b.index).map(entry=>entry.item);
}
