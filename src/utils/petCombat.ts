import type { Monster, Pet, StatusEffect } from '../types/game';
export function petBattleOpening(monster: Monster, pet?: Pet) {
  let enemy={...monster,hp:monster.maxHp};
  const playerEffects:StatusEffect[]=[],monsterEffects:StatusEffect[]=[];
  if(pet?.id==='pet_wolf')enemy.hp=Math.max(1,enemy.hp-80);
  if(pet?.id==='pet_dragon')monsterEffects.push({type:'burn',name:'Дыхание пламени',duration:2,value:12});
  // Opening buffs lose one tick on the first player action, before any enemy attack.
  if(pet?.id==='pet_golem')playerEffects.push({type:'fortify',name:'Каменный заслон',duration:3,value:15});
  if(pet?.id==='pet_voidling')enemy={...enemy,resistances:{...enemy.resistances,magic:(enemy.resistances?.magic||0)-10}};
  const openingDamage=monster.maxHp-enemy.hp;
  const openingMessage=openingDamage>0?`Волк-спутник атаковал до первого хода: −${openingDamage} HP противнику.`:null;
  return {enemy,playerEffects,monsterEffects,openingDamage,openingMessage};
}
