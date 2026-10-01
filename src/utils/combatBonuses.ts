export const classHealingMultiplier = (classId: string) => classId === 'paladin' ? 1.15 : 1;
export const classDefenseMultiplier = (classId: string, hpRatio: number) =>
  classId === 'warrior' && hpRatio < 0.35 ? 1.12 : classId === 'druid' && hpRatio < 0.45 ? 1.15 : 1;
export const petDamageMultiplier = (petId: string | undefined, damageType: string) =>
  petId === 'pet_wolf' && damageType === 'physical' ? 1.08 : petId === 'pet_dragon' && damageType === 'fire' ? 1.12 : 1;

export const combatHitChance = (accuracy: number, evasion: number) => Math.min(98, Math.max(30, accuracy - Math.min(60, Math.max(0, evasion))));
export function incomingAttackRoll(damage: number, evasion: number, critChance: number, random = Math.random) {
  if(damage<=0)return {damage:0,evaded:false,critical:false};
  const evaded=random()*100>=combatHitChance(95,evasion);
  const critical=!evaded && random()*100<Math.min(75,Math.max(0,critChance));
  return {damage:evaded?0:Math.round(damage*(critical?1.5:1)),evaded,critical};
}
