import type { Monster, Pet, StatusEffect } from '../types/game';
export function petBattleOpening(monster: Monster, pet?: Pet) {
  let enemy={...monster,hp:monster.maxHp};
  const playerEffects:StatusEffect[]=[],monsterEffects:StatusEffect[]=[];
  if(pet?.id==='pet_wolf')enemy.hp=Math.max(1,enemy.hp-80);
  if(pet?.id==='pet_dragon')monsterEffects.push({type:'burn',name:'Дыхание пламени',duration:2,value:12});
  if(pet?.id==='pet_golem')playerEffects.push({type:'fortify',name:'Каменный заслон',duration:2,value:15});
  if(pet?.id==='pet_voidling')enemy={...enemy,resistances:{...enemy.resistances,magic:(enemy.resistances?.magic||0)-10}};
  return {enemy,playerEffects,monsterEffects};
}
