import React from 'react';
import type { CharacterClassId, GameItem } from '../../types/game';
import { CLASS_EQUIPMENT, getClassGearBonus } from '../../utils/classEquipment';

const LABELS: Record<string, string> = {
  attack: 'атака', defense: 'защита', magicAttack: 'маг. атака', magicDefense: 'маг. защита',
  critDamage: 'крит. урон', maxHp: 'HP', armorPenetration: 'пробивание', critChance: 'шанс крита',
  evasion: 'уклонение', speed: 'скорость', accuracy: 'точность', maxMp: 'MP', vampirism: 'вампиризм',
  hpRegen: 'HP/ход', darkResistance: 'сопр. тьме', mpRegen: 'MP/ход'
};
const PERCENT = new Set(['critDamage', 'armorPenetration', 'critChance', 'evasion', 'accuracy', 'vampirism', 'darkResistance']);

export const ClassGearBonus: React.FC<{
  item: Pick<GameItem, 'name' | 'type' | 'targetClass' | 'level'> & { isEquipped?: boolean };
  characterClass: CharacterClassId;
  compact?: boolean;
}> = ({ item, characterClass, compact }) => {
  const bonus = getClassGearBonus(item);
  if (!bonus) return null;
  const matches = bonus.targetClass === characterClass;
  return <div className={`${compact ? 'text-[8px] mt-1' : 'text-[10px] rounded-lg border border-slate-700 p-2 mt-2'} ${matches ? 'text-emerald-300' : 'text-slate-400'}`}>
    <div>✦ +{bonus.value}{PERCENT.has(bonus.stat) ? '%' : ''} {LABELS[bonus.stat]} · {CLASS_EQUIPMENT[bonus.targetClass].label}</div>
    <div>{matches ? item.isEquipped ? 'Бонус активен' : 'Активируется при экипировке' : 'Бонус неактивен: другой класс'}</div>
  </div>;
};
