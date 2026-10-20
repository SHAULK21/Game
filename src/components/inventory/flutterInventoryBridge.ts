import type {RuntimeGameContext} from '../../context/GameStateContext';
import type {GameItem, ItemType} from '../../types/game';
import {getEffectiveGearStats} from '../../utils/classEquipment';
import {getItemSpritePath} from '../../utils/itemSprites';
import {getItemArtworkPath} from '../../utils/itemArtwork';
import {STAT_LABELS} from '../../utils/statLabels';
import {BULK_EQUIPMENT_TYPES, BULK_RARITIES, selectBulkItems, bulkReward, type BulkFilters} from '../../utils/bulkInventory';

export const INVENTORY_LABELS = ['Сумка','Снаряжение','Зелья','Ресурсы','Поиск предмета','Сначала сильные','По имени','По редкости','Ничего не найдено','Экипировано','Пусто','Ур.','Заточка','Объединение','Закрыть','Надеть','Снять','Запереть','Отпереть','Продать','Разобрать','Кузница','Создание','Сравнение с надетым','Свойства','Золото','Серебро','Расширить сумку','Подключить Premium','Массовая продажа и разбор','Редкость','Все типы снаряжения','Сохранить усиленные вещи','Подтвердить','Отмена','Предметы будут удалены из инвентаря.','Выбранные предметы','Готово.','Обработка…','Нужен Premium','Назад','Характеристики','Действия доступны в поселении.','Продать предмет?','Разобрать предмет?','Предмет будет удалён из инвентаря.','Защищено','Стопка','Качество','Мощь','Надето','В сумке','Усиление','Слотов','Все','Не удалось выполнить действие.'] as const;
const TYPES:Record<string,string>={weapon:'Оружие',offhand:'Вторая рука',helmet:'Шлем',armor:'Доспех',pants:'Штаны',gloves:'Перчатки',boots:'Сапоги',amulet:'Амулет',ring:'Кольцо',belt:'Пояс',cloak:'Плащ',artifact:'Артефакт',pickaxe:'Кирка',alchemyTool:'Реторта',potion:'Зелье',ore:'Руда',material:'Материал',pet:'Спутник'};
const RARITIES:Record<string,[string,string]>={common:['Обычный','94a3b8'],uncommon:['Необычный','65c885'],rare:['Редкий','6da9ed'],epic:['Эпический','b18be5'],legendary:['Легендарный','e0b365'],mythic:['Мифический','ee8caa'],ancient:['Древний','e29a68'],divine:['Божественный','eadea8']};
const equipment = new Set([...BULK_EQUIPMENT_TYPES,'pickaxe','alchemyTool']);
const percentages=new Set(['critChance','critDamage','vampirism','accuracy','evasion','physicalResistance','magicResistance','fireResistance','iceResistance','lightningResistance','poisonResistance','darkResistance','holyResistance','attackPercent','defensePercent']);
export function inventoryProjection(game:RuntimeGameContext, translate:(text:string)=>string, locale:string) {
 const p=game.player;if(!p)return null;
 const map=(item:GameItem,equipped=false)=>{
  const stats=getEffectiveGearStats(item,p.classId), rarity=RARITIES[item.rarity]||RARITIES.common;
  const sprite=getItemSpritePath(item)||getItemArtworkPath(item);
  return {id:item.id,name:translate(item.name),type:item.type,typeLabel:translate(TYPES[item.type]||item.type),rarity:item.rarity,rarityLabel:translate(rarity[0]),color:rarity[1],level:item.level,upgrade:item.upgradeLevel||0,merge:item.ascensionLevel||0,
   image:sprite&&!/\.svg(?:\?|$)/.test(sprite)?sprite:null,description:translate(item.description||''),quantity:item.stackCount??1,equipped,locked:!!item.isLocked,bound:!!item.boundToClan,equipment:equipment.has(item.type),price:item.sellPrice||0,saleGold:(item.sellPrice||10)*(item.stackCount??1),
   score:Math.round((stats.attack||0)*2+(stats.magicAttack||0)*2+(stats.defense||0)*1.4+(stats.magicDefense||0)*1.4+(stats.maxHp||0)*.05+(stats.maxMp||0)*.04+(stats.critChance||0)*1.1+(stats.critDamage||0)*.25+(stats.vampirism||0)*1.2+(stats.speed||0)*.5+(stats.armorPenetration||0)*.8),
   stats:Object.entries(stats).filter(([,v])=>v!==0).map(([key,value])=>({key,label:translate(STAT_LABELS[key]||key),value,percent:percentages.has(key)})),yield:{ore:item.disassembleYield?.ore||0,silver:item.disassembleYield?.silver||0},canEquip:equipped||['pickaxe','alchemyTool'].includes(item.type)||p.level>=item.level};
 };
 return {protocol:1,owner:p.userId,locale,name:translate(p.name),level:p.level,gold:p.gold,silver:p.silver,capacity:p.maxInventorySlots,used:p.inventory.length,premium:game.premium.active,expansionCost:p.maxInventorySlots*60,
  canAct:p.worldPlace==='settlement'&&!p.worldJourney&&!p.expeditionPresence&&!game.isInCombat&&!game.travelState.isTraveling,
  items:p.inventory.map(i=>map(i)),equipped:Object.values(p.equipped).filter((i):i is GameItem=>!!i).map(i=>map(i,true)),
  slots:Object.entries(TYPES).filter(([id])=>equipment.has(id)).map(([id,label])=>({id,label:translate(label)})),rarities:BULK_RARITIES.map(id=>({id,label:translate(RARITIES[id][0]),color:RARITIES[id][1]})),
  labels:Object.fromEntries(INVENTORY_LABELS.map(label=>[label,translate(label)]))};
}
function filters(input:any):BulkFilters {
 if(!input||!Array.isArray(input.rarities)||!input.rarities.length||input.rarities.some((r:any)=>!BULK_RARITIES.includes(r))||input.type!=='all'&&!BULK_EQUIPMENT_TYPES.includes(input.type)||typeof input.keepUpgraded!=='boolean')throw Error('Некорректный выбор предметов.');
 return {rarities:[...new Set(input.rarities)] as BulkFilters['rarities'],type:input.type,keepUpgraded:input.keepUpgraded};
}
/** IDs are resolved again from the latest projection. Flutter has no auth token,
 * save writer, economy authority, or ability to submit arbitrary API routes. */
export async function inventoryAction(game:RuntimeGameContext,input:any,navigate:(screen:'blacksmith'|'crafting')=>void) {
 const p=game.player;
 if(!p||input?.owner!==p.userId)throw Error('Персонаж изменился. Откройте сумку заново.');
 if(input.type==='blacksmith'||input.type==='crafting'){navigate(input.type);return {success:true,message:''};}
 if(input.type==='premium')return await game.purchasePremium();
 if(input.type==='expand')return await game.expandInventory();
 if(input.type==='bulkPreview'||input.type==='bulk'){
  const selected=filters(input.filters);
  // Keep both enhancement axes unless the player explicitly disables protection.
  const items=selectBulkItems(p,selected).filter(i=>!selected.keepUpgraded||!i.ascensionLevel);
  if(input.type==='bulkPreview')return {success:true,items:items.map(i=>({id:i.id,name:i.name,quantity:i.stackCount??1})),sale:bulkReward(items,'sell'),salvage:bulkReward(items,'disassemble')};
  if(!game.premium.active)throw Error('Нужен Premium');
  if(!['sell','disassemble'].includes(input.action)||!Array.isArray(input.ids)||input.ids.length>5000||input.ids.some((id:any)=>typeof id!=='string'))throw Error('Некорректный выбор предметов.');
  const ids=new Set(input.ids), currentIds=items.filter(i=>ids.has(i.id)).map(i=>i.id);
  if(!currentIds.length)throw Error('Ничего не найдено');
  return await game.bulkDisposeItems(selected,input.action,currentIds);
 }
 const item=[...p.inventory,...Object.values(p.equipped)].find(i=>i?.id===input.id);
 if(!item)throw Error('Предмет больше не находится у персонажа.');
 switch(input.type){
  case 'equip':return await game.equipItem(item);
  case 'unequip':if(p.equipped[item.type]?.id!==item.id)throw Error('Предмет уже снят.');return await game.unequipItem(item.type as ItemType);
  case 'lock':await game.toggleItemLock(item.id);return {success:true,message:''};
  case 'sell':if(item.isEquipped||item.isLocked||item.boundToClan||p.equipped[item.type]?.id===item.id)throw Error('Защищено');return await game.sellItem(item)??{success:true,message:'Готово.'};
  case 'disassemble':if(!equipment.has(item.type)||item.isEquipped||item.isLocked||item.boundToClan||p.equipped[item.type]?.id===item.id)throw Error('Защищено');return await game.disassembleItem(item)??{success:true,message:'Готово.'};
  default:throw Error('Неизвестное действие инвентаря.');
 }
}
