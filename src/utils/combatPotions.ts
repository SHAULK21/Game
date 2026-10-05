import type { CharacterClassId, DamageType, GameItem, AlchemyRecipe } from '../types/game';

/** Throwing is an attack. Restoratives do not advance turns or tick effects. */
export function potionDamage(item: GameItem): {power:number;damageType:DamageType}|null {
  for (const [key, damageType] of [['fireDamage','fire'],['poisonDamage','poison'],['iceDamage','ice']] as const) {
    if (item.stats[key] > 0) return {power:item.stats[key],damageType};
  }
  return null;
}
export function isRestorationPotion(item: GameItem) {
  const s=item.stats;
  return item.type==='potion' && !potionDamage(item) && !!(s.heal || s.healFull || s.manaRestore)
;
}
export function potionActionLabel(item:GameItem, classId:CharacterClassId):string {
  const damage=potionDamage(item);
  if(damage) return `Бросок вместо атаки: ${Math.round(damage.power*(classId==='rogue'?1.25:1))} урона до сопротивлений${damage.damageType === 'poison' ? ' · Отравление на 3 хода: 15% силы склянки за ход до сопротивлений' : ''}`;
  return isRestorationPotion(item)?'Не расходует ход':'Расходует ход';
}
export const THROWING_RECIPES:AlchemyRecipe[]=[
 {id:'alc_throw_fire',name:'Огненная склянка',resultItem:'Огненная склянка',resultCount:2,description:'Бросок вместо обычной атаки: 90 огненного урона до сопротивлений. Разбойник: +25% урона. Не требует маны.',levelReq:1,heroLevelReq:1,craftTimeSeconds:1,icon:'',ingredients:[{name:'Уголь',count:2},{name:'Медная руда',count:1}],resultStats:{fireDamage:90}},
 {id:'alc_throw_venom',name:'Ядовитая склянка',resultItem:'Ядовитая склянка',resultCount:2,description:'Бросок вместо обычной атаки: 220 урона ядом до сопротивлений и отравление на 3 хода (15% силы за ход). Разбойник: +25% урона. Не требует маны.',levelReq:10,heroLevelReq:10,craftTimeSeconds:2,icon:'',ingredients:[{name:'Ядовитая железа',count:2},{name:'Лечебная трава',count:2}],resultStats:{poisonDamage:220}},
 {id:'alc_throw_frost',name:'Морозная склянка',resultItem:'Морозная склянка',resultCount:2,description:'Бросок вместо обычной атаки: 480 ледяного урона до сопротивлений. Разбойник: +25% урона. Не требует маны.',levelReq:25,heroLevelReq:25,craftTimeSeconds:2,icon:'',ingredients:[{name:'Ледяной голец',count:2},{name:'Магическая эссенция',count:2},{name:'Железная руда',count:2}],resultStats:{iceDamage:480}}
];

export function restorationUseful(item:GameItem,hp:number,mp:number,maxHp:number,maxMp:number) {
 const s=item.stats;
 return !!(s.attackPercent || s.defensePercent || s.critChance || s.invulnerable
   || (s.heal || s.healFull) && hp<maxHp || s.manaRestore && mp<maxMp);
}
