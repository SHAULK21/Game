import { t as localize, useLocale } from '../../i18n/locale';
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
  useLocale();
  const bonus = getClassGearBonus(item);
  if (!bonus) return null;
  const matches = bonus.targetClass === characterClass;
  return <div className={`${compact ? 'text-[8px] mt-1' : 'text-[10px] rounded-lg border border-slate-700 p-2 mt-2'} ${matches ? 'text-emerald-300' : 'text-slate-400'}`}>
    <div>✦ +{localize(bonus.value)}{localize(PERCENT.has(bonus.stat) ? '%' : '')} {localize(LABELS[bonus.stat])} · {localize(CLASS_EQUIPMENT[bonus.targetClass].label)}</div>
    <div>{localize(matches ? item.isEquipped ? 'Бонус активен' : 'Активируется при экипировке' : 'Бонус неактивен: другой класс')}</div>
  </div>;
};
