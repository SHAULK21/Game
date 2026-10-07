import { getItemSpritePath } from './itemSprites';
import { sharpeningMultiplier } from './sharpening';
import type { CharacterClassId, GameItem } from '../types/game';

interface ClassGear {
  label: string;
  weapon: string;
  armor: string;
  weaponClass: NonNullable<GameItem['weaponClass']>;
  armorClass: NonNullable<GameItem['armorClass']>;
  weaponBonus: { stat: string; value: number };
  armorBonus: { stat: string; value: number };
}

export const CLASS_EQUIPMENT: Record<CharacterClassId, ClassGear> = {
  warrior: { label: 'Воин', weapon: 'Боевой меч', armor: 'Боевой нагрудник', weaponClass: 'twoHanded', armorClass: 'heavy', weaponBonus: { stat: 'attack', value: 8 }, armorBonus: { stat: 'defense', value: 6 } },
  berserker: { label: 'Берсерк', weapon: 'Секира', armor: 'Панцирь ярости', weaponClass: 'twoHanded', armorClass: 'heavy', weaponBonus: { stat: 'critDamage', value: 10 }, armorBonus: { stat: 'maxHp', value: 40 } },
  knight: { label: 'Рыцарь', weapon: 'Рыцарский меч', armor: 'Рыцарские латы', weaponClass: 'twoHanded', armorClass: 'heavy', weaponBonus: { stat: 'armorPenetration', value: 5 }, armorBonus: { stat: 'magicDefense', value: 6 } },
  rogue: { label: 'Разбойник', weapon: 'Парные клинки', armor: 'Кожаная куртка', weaponClass: 'dagger', armorClass: 'light', weaponBonus: { stat: 'critChance', value: 3 }, armorBonus: { stat: 'evasion', value: 4 } },
  assassin: { label: 'Ассасин', weapon: 'Кинжал', armor: 'Нагрудник убийцы', weaponClass: 'dagger', armorClass: 'light', weaponBonus: { stat: 'armorPenetration', value: 6 }, armorBonus: { stat: 'speed', value: 4 } },
  archer: { label: 'Лучник', weapon: 'Лук', armor: 'Куртка лучника', weaponClass: 'bow', armorClass: 'medium', weaponBonus: { stat: 'accuracy', value: 6 }, armorBonus: { stat: 'critChance', value: 3 } },
  mage: { label: 'Маг', weapon: 'Посох мага', armor: 'Мантия мага', weaponClass: 'staff', armorClass: 'light', weaponBonus: { stat: 'magicAttack', value: 8 }, armorBonus: { stat: 'maxMp', value: 40 } },
  necromancer: { label: 'Некромант', weapon: 'Жезл некроманта', armor: 'Одеяние некроманта', weaponClass: 'staff', armorClass: 'light', weaponBonus: { stat: 'vampirism', value: 3 }, armorBonus: { stat: 'hpRegen', value: 2 } },
  paladin: { label: 'Паладин', weapon: 'Священный молот', armor: 'Священный нагрудник', weaponClass: 'twoHanded', armorClass: 'heavy', weaponBonus: { stat: 'attack', value: 8 }, armorBonus: { stat: 'darkResistance', value: 8 } },
  druid: { label: 'Друид', weapon: 'Посох друида', armor: 'Облачение друида', weaponClass: 'staff', armorClass: 'medium', weaponBonus: { stat: 'magicAttack', value: 8 }, armorBonus: { stat: 'mpRegen', value: 2 } }
};

export const CLASS_GEAR_IDS = Object.keys(CLASS_EQUIPMENT) as CharacterClassId[];
export const rollClassGear = (roll = Math.random()) => CLASS_GEAR_IDS[Math.min(9, Math.floor(Math.max(0, roll) * 10))];

export const getGearTargetClass = (item: Pick<GameItem, 'name' | 'type' | 'targetClass'>) => {
  if (item.type !== 'weapon' && item.type !== 'armor') return undefined;
  if (item.targetClass && CLASS_EQUIPMENT[item.targetClass]) return item.targetClass;
  return CLASS_GEAR_IDS.find(id => item.name.startsWith(item.type === 'weapon' ? CLASS_EQUIPMENT[id].weapon : CLASS_EQUIPMENT[id].armor));
};

export const applyClassGear = (item: GameItem, targetClass?: CharacterClassId): GameItem => {
  if (item.type !== 'weapon' && item.type !== 'armor') return item;
  const target = targetClass || getGearTargetClass(item) || (item.type === 'weapon'
    ? item.weaponClass === 'bow' ? 'archer' : item.weaponClass === 'staff' ? 'mage' : item.weaponClass === 'dagger' ? 'assassin' : 'warrior'
    : item.armorClass === 'light' ? 'rogue' : item.armorClass === 'medium' ? 'archer' : 'warrior');
  const gear = CLASS_EQUIPMENT[target];
  const stats = { ...item.stats };
  const caster = item.type === 'weapon' && gear.weaponClass === 'staff';
  if (caster) {
    const power = stats.magicAttack ?? stats.attack ?? item.baseAttack;
    if (power !== undefined) stats.magicAttack = power;
    delete stats.attack;
  }
  return { ...item, targetClass: target, stats, baseAttack: caster ? undefined : item.baseAttack,
    name: item.type === 'weapon' ? gear.weapon : gear.armor,
    image: item.type==='weapon' && item.image ? getItemSpritePath({name:gear.weapon,type:'weapon',weaponClass:gear.weaponClass}) : item.image,
    weaponClass: item.type === 'weapon' ? gear.weaponClass : item.weaponClass,
    armorClass: item.type === 'armor' ? gear.armorClass : item.armorClass,
    icon: item.type === 'armor' ? '🥋' : gear.weaponClass === 'bow' ? '🏹' : gear.weaponClass === 'staff' ? '🪄' : gear.weaponClass === 'dagger' ? '🗡️' : '⚔️'
  };
};

export const getClassGearBonus = (item: Pick<GameItem, 'name' | 'type' | 'targetClass' | 'level'>) => {
  const target = getGearTargetClass(item);
  if (!target) return null;
  const bonus = item.type === 'weapon' ? CLASS_EQUIPMENT[target].weaponBonus : CLASS_EQUIPMENT[target].armorBonus;
  const scaling = ['attack', 'magicAttack', 'defense', 'magicDefense', 'maxHp', 'maxMp'].includes(bonus.stat) ? 1 + Math.floor(item.level / 4) * 0.15 : 1;
  return { ...bonus, value: Math.round(bonus.value * scaling), targetClass: target };
};

export const getEffectiveGearStats = (item: GameItem, characterClass?: CharacterClassId) => {
  const stats = { ...item.stats };
  if (item.baseAttack && stats.attack === undefined) stats.attack = item.baseAttack;
  if (item.baseDefense && stats.defense === undefined) stats.defense = item.baseDefense;
  if (item.baseMagicDef && stats.magicDefense === undefined) stats.magicDefense = item.baseMagicDef;
  for (const stat of ['attack', 'magicAttack', 'defense', 'magicDefense']) {
    if (stats[stat] !== undefined) stats[stat] = Math.round(stats[stat] * sharpeningMultiplier(item.upgradeLevel));
  }
  const bonus = getClassGearBonus(item);
  if (bonus && bonus.targetClass === characterClass) stats[bonus.stat] = (stats[bonus.stat] || 0) + bonus.value;
  return stats;
};
