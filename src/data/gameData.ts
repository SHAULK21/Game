import { regionalEnemyStats } from '../utils/pveBalance';
import { regionalSealName } from '../utils/regionalProgress';
import { 
  CharacterClassId, 
  ItemRarity,
  ItemType,
  Monster, 
  MiningNode, 
  AlchemyRecipe,
  BasicCraftRecipe, 
  Quest, 
  Achievement, 
  Pet, 
  ArenaOpponent,
  Skill,
  Talent,
  GameItem,
  RegionModifier
} from '../types/game';
import { createTalentTree } from './talents';
import { CLASS_EQUIPMENT, CLASS_GEAR_IDS } from '../utils/classEquipment';

// Generated assets
import heroHunterImg from '../assets/images/game_hero_hunter_1790595108742.jpg';
import bossDragonImg from '../assets/images/game_monster_dragon_1790595120603.jpg';
import dungeonCaveImg from '../assets/images/game_dungeon_cave_1790595131021.jpg';
import relicWeaponImg from '../assets/images/game_relic_weapon_1790595141902.jpg';
import charWarriorImg from '../assets/images/char_warrior_paladin_1790595905774.jpg';
import charMageImg from '../assets/images/char_mage_sorceress_1790595917068.jpg';
import charRogueImg from '../assets/images/char_rogue_assassin_1790595929467.jpg';
import mobWolfImg from '../assets/images/mob_forest_wolf_1790595941216.jpg';
import mobGoblinImg from '../assets/images/mob_goblin_shaman_1790595953042.jpg';
import mobDeathKnightImg from '../assets/images/mob_death_knight_1790595963615.jpg';
import itemRelicShieldImg from '../assets/images/item_relic_shield_1790595973300.jpg';
import itemRelicHelmImg from '../assets/images/item_relic_helm_1790595985059.jpg';

export const ASSETS = {
  heroHunter: heroHunterImg,
  bossDragon: bossDragonImg,
  dungeonCave: dungeonCaveImg,
  relicWeapon: relicWeaponImg,
  charWarrior: charWarriorImg,
  charMage: charMageImg,
  charRogue: charRogueImg,
  mobWolf: mobWolfImg,
  mobGoblin: mobGoblinImg,
  mobDeathKnight: mobDeathKnightImg,
  itemRelicShield: itemRelicShieldImg,
  itemRelicHelm: itemRelicHelmImg,
};

export interface ClassDefinition {
  id: CharacterClassId;
  name: string;
  role: string;
  description: string;
  passive: { name: string; description: string };
  icon: string;
  image?: string;
  baseAttributes: {
    strength: number;
    agility: number;
    intelligence: number;
    vitality: number;
    luck: number;
    spirit: number;
    willpower: number;
  };
  startingSkills: Skill[];
  talents: Talent[];
}

export const CLASSES: Record<CharacterClassId, ClassDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Воин',
    role: 'Танк / Тяжелый боец',
    description: 'Мастер тяжелой брони и щита. Непоколебим в обороне и наносит сокрушительные удары в ближнем бою.',
    passive: { name: 'Железная воля', description: 'Получает на 10% меньше прямого урона. При HP ниже 35% дополнительно +12% защиты.' },
    icon: '🛡️',
    image: ASSETS.charWarrior,
    baseAttributes: { strength: 16, vitality: 15, willpower: 12, agility: 10, luck: 8, spirit: 7, intelligence: 6 },
    startingSkills: [
      {
        id: 'w_strike',
        name: 'Мощный удар',
        classId: 'warrior',
        description: 'Наносит 140% физического урона и оглушает с шансом 25%.',
        levelReq: 1,
        manaCost: 15,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.4,
        damageType: 'physical',
        icon: '⚔️',
        inflicts: { type: 'stun', chance: 0.25, duration: 1, power: 0 }
      },
      {
        id: 'w_shield',
        name: 'Железный оплот',
        classId: 'warrior',
        description: 'Дарует защитный барьер, поглощающий урон.',
        levelReq: 3,
        manaCost: 20,
        cooldown: 3,
        currentCooldown: 0,
        damageMultiplier: 0,
        damageType: 'physical',
        icon: '🛡️',
        inflicts: { type: 'shield', chance: 1.0, duration: 3, power: 80 }
      },
      {
        id: 'w_shatter',
        name: 'Сокрушение черепа',
        classId: 'warrior',
        description: 'Ультимативный сокрушительный удар, наносящий 240% урона и вызывающий кровотечение.',
        levelReq: 6,
        manaCost: 40,
        cooldown: 4,
        currentCooldown: 0,
        damageMultiplier: 2.4,
        damageType: 'physical',
        isUltimate: true,
        icon: '💥',
        inflicts: { type: 'bleed', chance: 0.8, duration: 3, power: 35 }
      }
    ],
    talents: createTalentTree('warrior')
  },
  berserker: {
    id: 'berserker',
    name: 'Берсерк',
    role: 'Физический DPS',
    description: 'Жертвует защитой ради колоссального физического урона. Чем ниже его здоровье, тем сильнее удары.',
    passive: { name: 'Ярость крови', description: 'Урон +18%, а при HP ниже 50% ещё +22% к урону.' },
    icon: '🪓',
    image: ASSETS.charWarrior,
    baseAttributes: { strength: 18, agility: 12, intelligence: 5, vitality: 12, luck: 10, spirit: 6, willpower: 11 },
    startingSkills: [
      {
        id: 'b_frenzy',
        name: 'Яростный взмах',
        classId: 'berserker',
        description: 'Наносит 160% физического урона, вызывая кровотечение.',
        levelReq: 1,
        manaCost: 18,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.6,
        damageType: 'physical',
        icon: '🩸',
        inflicts: { type: 'bleed', chance: 0.6, duration: 3, power: 30 }
      },
      {
        id: 'b_roar',
        name: 'Боевой раж',
        classId: 'berserker',
        description: 'Вводит в состояние неистовства (+30% атаки на 3 хода).',
        levelReq: 3,
        manaCost: 25,
        cooldown: 4,
        currentCooldown: 0,
        damageMultiplier: 0.5,
        damageType: 'physical',
        icon: '🔥',
        inflicts: { type: 'fury', chance: 1.0, duration: 3, power: 30 }
      },
      {
        id: 'b_execute',
        name: 'Палаческий удар',
        classId: 'berserker',
        description: 'Казнь врага. Наносит 280% урона!',
        levelReq: 6,
        manaCost: 45,
        cooldown: 4,
        currentCooldown: 0,
        damageMultiplier: 2.8,
        damageType: 'physical',
        isUltimate: true,
        icon: '☠️'
      }
    ],
    talents: createTalentTree('berserker')
  },
  knight: {
    id: 'knight',
    name: 'Рыцарь',
    role: 'Защитник / Бастион',
    description: 'Стойкий защитник порядка в латных доспехах. Обладает высочайшим сопротивлением урону.',
    passive: { name: 'Бастион', description: '+15% физической и магической защиты и +10 ко всем базовым сопротивлениям.' },
    icon: '🏰',
    image: ASSETS.charWarrior,
    baseAttributes: { strength: 14, agility: 9, intelligence: 7, vitality: 18, luck: 6, spirit: 9, willpower: 13 },
    startingSkills: [
      {
        id: 'k_smite',
        name: 'Удар правосудия',
        classId: 'knight',
        description: 'Наносит 130% урона светом.',
        levelReq: 1,
        manaCost: 15,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.3,
        damageType: 'holy',
        icon: '⚔️'
      },
      {
        id: 'k_bastion',
        name: 'Нерушимость',
        classId: 'knight',
        description: 'Создает щит прочностью 120 ед.',
        levelReq: 3,
        manaCost: 20,
        cooldown: 3,
        currentCooldown: 0,
        damageMultiplier: 0,
        damageType: 'holy',
        icon: '🛡️',
        inflicts: { type: 'shield', chance: 1.0, duration: 4, power: 120 }
      }
    ],
    talents: createTalentTree('knight')
  },
  rogue: {
    id: 'rogue',
    name: 'Разбойник',
    role: 'Скорость / Крит',
    description: 'Мастер кинжалов, скрытности и ядов. Высокий шанс критического удара и уклонения.',
    passive: { name: 'Охотник за слабостями', description: '+8% уклонения и +10% критического урона; после критического удара следующий удар получает +12% урона.' },
    icon: '🗡️',
    image: ASSETS.charRogue,
    baseAttributes: { strength: 11, agility: 18, intelligence: 7, vitality: 10, luck: 15, spirit: 6, willpower: 8 },
    startingSkills: [
      {
        id: 'r_strike',
        name: 'Удар из тени',
        classId: 'rogue',
        description: 'Наносит 150% урона с удвоенным шансом критического удара.',
        levelReq: 1,
        manaCost: 16,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.5,
        damageType: 'physical',
        icon: '🗡️'
      },
      {
        id: 'r_poison',
        name: 'Отравленный клинок',
        classId: 'rogue',
        description: 'Наносит 120% урона и отравляет врага ядом на 4 хода.',
        levelReq: 3,
        manaCost: 22,
        cooldown: 3,
        currentCooldown: 0,
        damageMultiplier: 1.2,
        damageType: 'poison',
        icon: '🧪',
        inflicts: { type: 'poison', chance: 0.9, duration: 4, power: 25 }
      },
      {
        id: 'r_dance',
        name: 'Танец теней',
        classId: 'rogue',
        description: 'Серия молниеносных выпадов, наносящая 260% урона.',
        levelReq: 6,
        manaCost: 40,
        cooldown: 4,
        currentCooldown: 0,
        damageMultiplier: 2.6,
        damageType: 'physical',
        isUltimate: true,
        icon: '🌪️'
      }
    ],
    talents: createTalentTree('rogue')
  },
  assassin: {
    id: 'assassin',
    name: 'Ассасин',
    role: 'Burst Урон / Яды',
    description: 'Хладнокровный ликвидатор. Способен уничтожить противника до того, как тот успеет среагировать.',
    passive: { name: 'Палач', description: 'По врагам с HP ниже 40% наносит на 25% больше урона и получает +10% пробивания брони.' },
    icon: '🥷',
    image: ASSETS.charRogue,
    baseAttributes: { strength: 12, agility: 19, intelligence: 8, vitality: 9, luck: 14, spirit: 5, willpower: 9 },
    startingSkills: [
      {
        id: 'a_backstab',
        name: 'Удар в спину',
        classId: 'assassin',
        description: 'Наносит 175% физ. урона. Пробивает броню врага.',
        levelReq: 1,
        manaCost: 20,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.75,
        damageType: 'physical',
        icon: '🗡️'
      }
    ],
    talents: createTalentTree('assassin')
  },
  archer: {
    id: 'archer',
    name: 'Лучник',
    role: 'Дальний бой / Точность',
    description: 'Мастер стрельбы из лука. Никогда не промахивается и расстреливает врагов с дистанции.',
    passive: { name: 'Орлиный глаз', description: '+12 точности и +6% критического шанса; дальняя атака игнорирует ещё 10% защиты.' },
    icon: '🏹',
    image: ASSETS.heroHunter,
    baseAttributes: { strength: 11, agility: 17, intelligence: 8, vitality: 10, luck: 12, spirit: 8, willpower: 9 },
    startingSkills: [
      {
        id: 'arc_shot',
        name: 'Прицельный выстрел',
        classId: 'archer',
        description: 'Наносит 150% урона с игнорированием 30% брони.',
        levelReq: 1,
        manaCost: 15,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.5,
        damageType: 'physical',
        icon: '🎯'
      }
    ],
    talents: createTalentTree('archer')
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    role: 'Магический Burst',
    description: 'Повелитель стихийного огня, молнии и льда. Наносит огромный урон по площади и одиночным целям.',
    passive: { name: 'Элементальный резонанс', description: '+15% магического урона и +20% MP-регенерации. Урон ожога сильнее на 15%.' },
    icon: '🔮',
    image: ASSETS.charMage,
    baseAttributes: { strength: 6, agility: 9, intelligence: 19, vitality: 9, luck: 10, spirit: 15, willpower: 12 },
    startingSkills: [
      {
        id: 'm_fireball',
        name: 'Огненный шар',
        classId: 'mage',
        description: 'Наносит 170% магического огненного урона и поджигает цель.',
        levelReq: 1,
        manaCost: 20,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.7,
        damageType: 'fire',
        icon: '🔥',
        inflicts: { type: 'burn', chance: 0.75, duration: 3, power: 30 }
      },
      {
        id: 'm_frost',
        name: 'Ледяная стрела',
        classId: 'mage',
        description: 'Наносит 130% урона льдом и замораживает (пропуск хода с шансом 40%).',
        levelReq: 3,
        manaCost: 24,
        cooldown: 3,
        currentCooldown: 0,
        damageMultiplier: 1.3,
        damageType: 'ice',
        icon: '❄️',
        inflicts: { type: 'freeze', chance: 0.4, duration: 1, power: 0 }
      },
      {
        id: 'm_apocalypse',
        name: 'Зов кометы',
        classId: 'mage',
        description: 'Обрушивает небесный огонь, нанося 310% магического урона!',
        levelReq: 6,
        manaCost: 55,
        cooldown: 5,
        currentCooldown: 0,
        damageMultiplier: 3.1,
        damageType: 'fire',
        isUltimate: true,
        icon: '☄️'
      }
    ],
    talents: createTalentTree('mage')
  },
  necromancer: {
    id: 'necromancer',
    name: 'Некромант',
    role: 'Темная магия / Вампиризм',
    description: 'Жрец смерти. Истощает жизненные силы врагов и обращает их плоть в проклятую пыль.',
    passive: { name: 'Пожиратель душ', description: '+8% вампиризма. При убийстве восстанавливает 12% максимального HP и MP.' },
    icon: '💀',
    image: ASSETS.charMage,
    baseAttributes: { strength: 7, agility: 9, intelligence: 18, vitality: 10, luck: 11, spirit: 14, willpower: 14 },
    startingSkills: [
      {
        id: 'n_drain',
        name: 'Вытягивание жизни',
        classId: 'necromancer',
        description: 'Наносит 135% урона тьмой и восстанавливает здоровье заклинателя.',
        levelReq: 1,
        manaCost: 22,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.35,
        damageType: 'dark',
        healMultiplier: 0.5,
        icon: '🩸'
      }
    ],
    talents: createTalentTree('necromancer')
  },
  paladin: {
    id: 'paladin',
    name: 'Паладин',
    role: 'Святой воин / Исцеление',
    description: 'Сочетает непревзойденную броню, сокрушительный святой урон и молитвы исцеления.',
    passive: { name: 'Божественная аура', description: '+10% защиты, +12% HP-регенерации и +15% сопротивления тьме. Лечение сильнее на 15%.' },
    icon: '✝️',
    image: ASSETS.charWarrior,
    baseAttributes: { strength: 14, agility: 9, intelligence: 12, vitality: 15, luck: 8, spirit: 13, willpower: 14 },
    startingSkills: [
      {
        id: 'p_holy',
        name: 'Священный удар',
        classId: 'paladin',
        description: 'Наносит 145% урона светом и сжигает тьму.',
        levelReq: 1,
        manaCost: 18,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.45,
        damageType: 'holy',
        icon: '✨'
      },
      {
        id: 'p_heal',
        name: 'Свет исцеления',
        classId: 'paladin',
        description: 'Восстанавливает 100 ед. здоровья.',
        levelReq: 3,
        manaCost: 25,
        cooldown: 3,
        currentCooldown: 0,
        damageMultiplier: 0,
        damageType: 'holy',
        healMultiplier: 1.0,
        icon: '💖'
      }
    ],
    talents: createTalentTree('paladin')
  },
  druid: {
    id: 'druid',
    name: 'Друид',
    role: 'Природа / Гибрид',
    description: 'Хранитель первобытных рощ. Управляет силами природы и ядовитыми лозами.',
    passive: { name: 'Дух природы', description: '+10% HP/MP-регенерации и +20 к сопротивлению яду. При HP ниже 45% получает +15% защиты.' },
    icon: '🌿',
    image: ASSETS.heroHunter,
    baseAttributes: { strength: 11, agility: 11, intelligence: 14, vitality: 13, luck: 10, spirit: 15, willpower: 12 },
    startingSkills: [
      {
        id: 'd_thorns',
        name: 'Колючие лозы',
        classId: 'druid',
        description: 'Наносит 135% урона природы и опутывает врага.',
        levelReq: 1,
        manaCost: 18,
        cooldown: 2,
        currentCooldown: 0,
        damageMultiplier: 1.35,
        damageType: 'poison',
        icon: '🌿',
        inflicts: { type: 'poison', chance: 0.7, duration: 3, power: 22 }
      }
    ],
    talents: createTalentTree('druid')
  }
};

// Existing skills gain the same declarative combat effects as newly added skills.
const SKILL_EFFECTS: Record<string, Partial<Skill>> = {
  w_strike: { comboFrom: 'w_shield', comboMultiplier: 1.25 },
  b_execute: { comboFrom: 'b_roar', comboMultiplier: 1.25, executeThreshold: 0.3, executeMultiplier: 1.5 },
  k_smite: { comboFrom: 'k_bastion', comboMultiplier: 1.25 },
  r_dance: { hits: 3, comboFrom: 'r_poison', comboMultiplier: 1.2 },
  a_backstab: { comboFrom: 'a_stealth', comboMultiplier: 1.3, executeThreshold: 0.4, executeMultiplier: 1.4 },
  arc_shot: { comboFrom: 'arc_mark', comboMultiplier: 1.25 },
  m_fireball: { comboFrom: 'm_frost', comboMultiplier: 1.25 },
  n_drain: { comboFrom: 'n_curse', comboMultiplier: 1.25 },
  p_holy: { comboFrom: 'p_heal', comboMultiplier: 1.25 },
  d_thorns: { comboFrom: 'd_spores', comboMultiplier: 1.2 }
};
for (const classDef of Object.values(CLASSES)) {
  classDef.startingSkills = classDef.startingSkills.map(s => ({ ...s, ...SKILL_EFFECTS[s.id] }));
}

export interface RegionDefinition {
  id: string;
  name: string;
  levelRange: string;
  minLevel: number;
  description: string;
  icon: string;
  bgGradient: string;
  monsters: string[]; // monster ids
  caves: string[];
  isStarter?: boolean;
  availableMods: string[];
  defaultModId: string;
}

export const REGION_MODIFIERS: Record<string, RegionModifier> = {
  mod_standard: {
    id: 'mod_standard',
    name: 'Обычный поход',
    description: 'Стандартный баланс монстров и наград. Безопасные тропы.',
    icon: '🌿',
    badgeColor: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300',
    energyCost: 5,
    ambushChance: 0.12,
    damageMultiplier: 1.0,
    expMultiplier: 1.0,
    goldMultiplier: 1.0,
    silverMultiplier: 1.0,
    rareDropMultiplier: 1.0
  },
  mod_blood_moon: {
    id: 'mod_blood_moon',
    name: 'Кровавая Луна',
    description: 'Яростная охота: HP врагов ×1,75, урон ×1,85, защита ×1,2. Шанс редких находок ×2,2.',
    icon: '🩸',
    badgeColor: 'border-rose-500/50 bg-rose-950/40 text-rose-300',
    energyCost: 8,
    ambushChance: 0.28,
    damageMultiplier: 1.85,
    hpMultiplier: 1.75,
    defenseMultiplier: 1.2,
    expMultiplier: 1.35,
    goldMultiplier: 1.3,
    silverMultiplier: 1.5,
    rareDropMultiplier: 2.2,
    bonusVampirism: 5
  },
  mod_dense_fog: {
    id: 'mod_dense_fog',
    name: 'Густой Туман (Засады)',
    description: 'Опасные засады: HP врагов ×1,3, урон ×1,5, защита ×1,15. Засада 50%, золото ×1,8, серебро ×2.',
    icon: '🌫️',
    badgeColor: 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300',
    energyCost: 6,
    ambushChance: 0.50,
    damageMultiplier: 1.5,
    hpMultiplier: 1.3,
    defenseMultiplier: 1.15,
    expMultiplier: 1.25,
    goldMultiplier: 1.8,
    silverMultiplier: 2.0,
    rareDropMultiplier: 1.35
  },
  mod_abyss_curse: {
    id: 'mod_abyss_curse',
    name: 'Осквернение Бездны',
    description: 'Предельная опасность: HP врагов ×2,4, урон ×2,4, защита ×1,5 и +25 пробития брони. Опыт ×1,8, редкие находки ×2,5.',
    icon: '💀',
    badgeColor: 'border-purple-500/50 bg-purple-950/40 text-purple-300',
    energyCost: 10,
    ambushChance: 0.35,
    damageMultiplier: 2.4,
    hpMultiplier: 2.4,
    defenseMultiplier: 1.5,
    expMultiplier: 1.8,
    goldMultiplier: 1.5,
    silverMultiplier: 1.8,
    rareDropMultiplier: 2.5,
    bonusArmorPenetration: 25,
    bonusVampirism: 10
  },
  mod_sanctuary: {
    id: 'mod_sanctuary',
    name: 'Священный Свет',
    description: 'HP врагов ×1,15, урон ×1,1. Благословение восстанавливает HP/MP в бою; опыт ×1,6.',
    icon: '✨',
    badgeColor: 'border-amber-400/50 bg-amber-950/40 text-amber-300',
    energyCost: 4,
    ambushChance: 0.05,
    damageMultiplier: 1.1,
    hpMultiplier: 1.15,
    defenseMultiplier: 1,
    expMultiplier: 1.6,
    goldMultiplier: 1.1,
    silverMultiplier: 1.2,
    rareDropMultiplier: 1.3,
    bonusRegen: 15
  }
};

export const REGIONS: RegionDefinition[] = [
  {
    id: 'reg_plains',
    name: 'Зеленые равнины: Пастбища Новичков',
    levelRange: 'Ур. 1 - 8',
    minLevel: 1,
    description: 'Мирные цветущие луга королевства, ныне потревоженные дикими зверями и бродячими гоблинами.',
    icon: '🌾',
    bgGradient: 'from-emerald-950/40 via-slate-950 to-slate-950',
    monsters: ['m_wolf', 'm_goblin', 'm_boar', 'm_bandit'],
    caves: ['cave_bat'],
    isStarter: true,
    availableMods: ['mod_standard', 'mod_sanctuary', 'mod_dense_fog'],
    defaultModId: 'mod_standard'
  },
  {
    id: 'reg_whisper_woods',
    name: 'Шепчущий лес: Земли Волков',
    levelRange: 'Ур. 5 - 12',
    minLevel: 5,
    description: 'Лесная чаща у подножия гор. Здесь обитают стаи свирепых волков и гоблины-шаманы.',
    icon: '🐺',
    bgGradient: 'from-blue-950/40 via-slate-950 to-slate-950',
    monsters: ['m_wolf', 'm_goblin', 'm_bandit', 'm_spider'],
    caves: ['cave_bat', 'cave_spider'],
    isStarter: true,
    availableMods: ['mod_standard', 'mod_blood_moon', 'mod_dense_fog'],
    defaultModId: 'mod_dense_fog'
  },
  {
    id: 'reg_forgotten_crypt',
    name: 'Забытый склеп Скелетов',
    levelRange: 'Ур. 8 - 18',
    minLevel: 8,
    description: 'Древние катакомбы под равнинами. Гробницы полны нежити и ценных реликвий былых эпох.',
    icon: '⚰️',
    bgGradient: 'from-indigo-950/40 via-slate-950 to-slate-950',
    monsters: ['m_bandit', 'm_spider', 'm_stone_golem', 'm_queen_bat'],
    caves: ['cave_spider', 'cave_catacombs'],
    isStarter: true,
    availableMods: ['mod_standard', 'mod_abyss_curse', 'mod_blood_moon'],
    defaultModId: 'mod_abyss_curse'
  },
  {
    id: 'reg_forest',
    name: 'Тёмный лес (Логово пауков)',
    levelRange: 'Ур. 12 - 25',
    minLevel: 12,
    description: 'Вековые кроны не пропускают солнце. Здесь бродят гигантские тарантулы, каменные големы и темные духи.',
    icon: '🌲',
    bgGradient: 'from-teal-950/40 via-slate-950 to-slate-950',
    monsters: ['m_spider', 'm_stone_golem', 'm_spider_queen'],
    caves: ['cave_spider', 'cave_mine'],
    availableMods: ['mod_standard', 'mod_blood_moon', 'mod_dense_fog', 'mod_abyss_curse'],
    defaultModId: 'mod_standard'
  },
  {
    id: 'reg_swamp',
    name: 'Гиблые болота',
    levelRange: 'Ур. 25 - 40',
    minLevel: 25,
    description: 'Ядовитые топи, испускающие трупный газ. Из глубин ила поднимаются гигантские пиявки и болотные твари.',
    icon: '🍄',
    bgGradient: 'from-lime-950/40 via-slate-950 to-slate-950',
    monsters: ['m_spider', 'm_stone_golem', 'm_spider_queen'],
    caves: ['cave_catacombs'],
    availableMods: ['mod_standard', 'mod_blood_moon', 'mod_abyss_curse'],
    defaultModId: 'mod_standard'
  },
  {
    id: 'reg_desert',
    name: 'Пылающая пустыня',
    levelRange: 'Ур. 40 - 55',
    minLevel: 40,
    description: 'Раскаленные барханы, древние пирамиды и скорпионы величиной с боевую повозку.',
    icon: '🏜️',
    bgGradient: 'from-amber-950/40 via-slate-950 to-slate-950',
    monsters: ['m_stone_golem', 'm_death_knight_boss'],
    caves: ['cave_mine'],
    availableMods: ['mod_standard', 'mod_blood_moon', 'mod_sanctuary'],
    defaultModId: 'mod_standard'
  },
  {
    id: 'reg_cursed',
    name: 'Проклятые земли',
    levelRange: 'Ур. 55 - 75',
    minLevel: 55,
    description: 'Земля, оскверненная некромантией. Орды скелетов, вампиры и Рыцарь Смерти Мортред ведут вечную войну.',
    icon: '💀',
    bgGradient: 'from-purple-950/40 via-slate-950 to-slate-950',
    monsters: ['m_death_knight_boss', 'm_demon_lord'],
    caves: ['cave_catacombs', 'cave_rift'],
    availableMods: ['mod_standard', 'mod_abyss_curse', 'mod_blood_moon'],
    defaultModId: 'mod_abyss_curse'
  },
  {
    id: 'reg_rift',
    name: 'Демонический разлом',
    levelRange: 'Ур. 75 - 90',
    minLevel: 75,
    description: 'Трещина в ткани мироздания, источающая адское пламя и первобытный хаос.',
    icon: '🔥',
    bgGradient: 'from-rose-950/40 via-slate-950 to-slate-950',
    monsters: ['m_demon_lord', 'm_dragon_boss'],
    caves: ['cave_rift'],
    availableMods: ['mod_standard', 'mod_abyss_curse', 'mod_blood_moon'],
    defaultModId: 'mod_blood_moon'
  },
  {
    id: 'reg_dragon',
    name: 'Драконий сандор',
    levelRange: 'Ур. 90 - 120',
    minLevel: 90,
    description: 'Пики вечных скал, где восседает Древний Дракон Аэтельгор. Эндгейм зона величайшей славы.',
    icon: '🐉',
    bgGradient: 'from-cyan-950/40 via-slate-950 to-slate-950',
    monsters: ['m_demon_lord', 'm_dragon_boss'],
    caves: ['cave_dragon'],
    availableMods: ['mod_standard', 'mod_blood_moon', 'mod_abyss_curse', 'mod_sanctuary'],
    defaultModId: 'mod_blood_moon'
  }
];

export interface CaveDefinition {
  id: string;
  name: string;
  regionId: string;
  minLevel: number;
  roomsCount: number;
  description: string;
  icon: string;
  bossMonsterId: string;
}

export const CAVES: Record<string, CaveDefinition> = {
  cave_bat: {
    id: 'cave_bat',
    name: 'Пещера летучих мышей',
    regionId: 'reg_plains',
    minLevel: 3,
    roomsCount: 5,
    description: 'Темные сырые своды, кишащие кровососущими мышами и их грозной Королевой.',
    icon: '🦇',
    bossMonsterId: 'm_queen_bat'
  },
  cave_mine: {
    id: 'cave_mine',
    name: 'Заброшенная шахта',
    regionId: 'reg_forest',
    minLevel: 14,
    roomsCount: 6,
    description: 'Штольни, полные нежити погибших рудокопов и сторожевых каменных големов.',
    icon: '⛏️',
    bossMonsterId: 'm_stone_golem'
  },
  cave_spider: {
    id: 'cave_spider',
    name: 'Паучье логово',
    regionId: 'reg_forest',
    minLevel: 20,
    roomsCount: 7,
    description: 'Липкая паутина скрывает коконы незадачливых странников и гигантскую Матку пауков.',
    icon: '🕷️',
    bossMonsterId: 'm_spider_queen'
  },
  cave_catacombs: {
    id: 'cave_catacombs',
    name: 'Катакомбы древних королей',
    regionId: 'reg_cursed',
    minLevel: 45,
    roomsCount: 8,
    description: 'Мрачные склепы с некромантами и древним Рыцарем Смерти.',
    icon: '⚰️',
    bossMonsterId: 'm_death_knight_boss'
  },
  cave_rift: {
    id: 'cave_rift',
    name: 'Демонический разлом',
    regionId: 'reg_rift',
    minLevel: 75,
    roomsCount: 8,
    description: 'Адский прорыв в Бездну. Лавовые реки и владыка демонического легиона.',
    icon: '👿',
    bossMonsterId: 'm_demon_lord'
  },
  cave_dragon: {
    id: 'cave_dragon',
    name: 'Пещера Аэтельгора',
    regionId: 'reg_dragon',
    minLevel: 90,
    roomsCount: 10,
    description: 'Логово первородного черного дракона. Золотые горы и пепел павших героев.',
    icon: '🐲',
    bossMonsterId: 'm_dragon_boss'
  }
};

export const MONSTERS: Record<string, Monster> = {
  m_wolf: {
    id: 'm_wolf',
    name: 'Свирепый лесной волк',
    regionId: 'reg_plains',
    level: 2,
    hp: 95,
    maxHp: 95,
    mp: 20,
    maxMp: 20,
    attack: 16,
    magicAttack: 0,
    defense: 4,
    magicDefense: 2,
    speed: 14,
    critChance: 8,
    evasion: 10,
    damageType: 'physical',
    resistances: { physical: 5, poison: 10 },
    avatar: ASSETS.mobWolf,
    expReward: 25,
    goldReward: 18,
    drops: [
      { itemName: 'Волчья шкура', type: 'material', rarity: 'common', chance: 0.8, minQty: 1, maxQty: 2 },
      { itemName: 'Острый клык', type: 'material', rarity: 'uncommon', chance: 0.4, minQty: 1, maxQty: 1 },
      { itemName: 'Кожаный жилет охотника', type: 'armor', rarity: 'uncommon', chance: 0.15, minQty: 1, maxQty: 1 },
      { itemName: 'Лечебная трава', type: 'material', rarity: 'common', chance: 0.65, minQty: 1, maxQty: 2 },
    ]
  },
  m_goblin: {
    id: 'm_goblin',
    name: 'Гоблин-разведчик',
    regionId: 'reg_plains',
    level: 4,
    hp: 140,
    maxHp: 140,
    mp: 30,
    maxMp: 30,
    attack: 22,
    magicAttack: 5,
    defense: 8,
    magicDefense: 5,
    speed: 16,
    critChance: 12,
    evasion: 12,
    damageType: 'physical',
    resistances: { physical: 5, fire: 5 },
    avatar: ASSETS.mobGoblin,
    expReward: 45,
    goldReward: 35,
    drops: [
      { itemName: 'Ржавый кинжал', type: 'weapon', rarity: 'common', chance: 0.35, minQty: 1, maxQty: 1 },
      { itemName: 'Малое зелье исцеления', type: 'potion', rarity: 'common', chance: 0.5, minQty: 1, maxQty: 2 },
      { itemName: 'Медная монета гоблинов', type: 'material', rarity: 'common', chance: 0.7, minQty: 1, maxQty: 3 }
    ]
  },
  m_boar: {
    id: 'm_boar',
    name: 'Клыкастый вепрь',
    regionId: 'reg_plains',
    level: 6,
    hp: 210,
    maxHp: 210,
    mp: 10,
    maxMp: 10,
    attack: 30,
    magicAttack: 0,
    defense: 16,
    magicDefense: 4,
    speed: 10,
    critChance: 10,
    evasion: 5,
    damageType: 'physical',
    resistances: { physical: 12 },
    avatar: '🐗',
    expReward: 70,
    goldReward: 50,
    drops: [
      { itemName: 'Мясо вепря', type: 'material', rarity: 'common', chance: 0.9, minQty: 1, maxQty: 2 },
      { itemName: 'Пояс из шкуры вепря', type: 'belt', rarity: 'rare', chance: 0.12, minQty: 1, maxQty: 1 }
    ]
  },
  m_bandit: {
    id: 'm_bandit',
    name: 'Разбойник с большой дороги',
    regionId: 'reg_plains',
    level: 8,
    hp: 280,
    maxHp: 280,
    mp: 40,
    maxMp: 40,
    attack: 42,
    magicAttack: 0,
    defense: 18,
    magicDefense: 10,
    speed: 18,
    critChance: 15,
    evasion: 14,
    damageType: 'physical',
    resistances: { physical: 8 },
    avatar: '🗡️',
    expReward: 110,
    goldReward: 95,
    drops: [
      { itemName: 'Стальной тесак', type: 'weapon', rarity: 'uncommon', chance: 0.25, minQty: 1, maxQty: 1 },
      { itemName: 'Кожаные сапоги ловкача', type: 'boots', rarity: 'rare', chance: 0.1, minQty: 1, maxQty: 1 }
    ]
  },
  m_queen_bat: {
    id: 'm_queen_bat',
    name: 'Королева мышей (Босс)',
    regionId: 'reg_plains',
    level: 10,
    hp: 680,
    maxHp: 680,
    mp: 120,
    maxMp: 120,
    attack: 58,
    magicAttack: 25,
    defense: 25,
    magicDefense: 20,
    speed: 25,
    critChance: 18,
    evasion: 20,
    damageType: 'dark',
    resistances: { physical: 5, dark: 20 },
    isBoss: true,
    avatar: '🦇',
    expReward: 420,
    goldReward: 350,
    drops: [
      { itemName: 'Крылья Королевы Мышей', type: 'cloak', rarity: 'epic', chance: 0.25, minQty: 1, maxQty: 1 },
      { itemName: 'Кольцо эхолокации', type: 'ring', rarity: 'rare', chance: 0.5, minQty: 1, maxQty: 1 },
      { itemName: 'Алмазный самородок', type: 'ore', rarity: 'epic', chance: 0.4, minQty: 1, maxQty: 2 },
      { itemName: 'Лунная пыльца', type: 'material', rarity: 'uncommon', chance: 0.5, minQty: 1, maxQty: 2 },
    ]
  },
  m_spider: {
    id: 'm_spider',
    name: 'Ядовитый тарантул',
    regionId: 'reg_forest',
    level: 12,
    hp: 360,
    maxHp: 360,
    mp: 50,
    maxMp: 50,
    attack: 52,
    magicAttack: 20,
    defense: 22,
    magicDefense: 18,
    speed: 22,
    critChance: 14,
    evasion: 16,
    damageType: 'poison',
    resistances: { poison: 35 },
    avatar: '🕷️',
    expReward: 160,
    goldReward: 120,
    drops: [
      { itemName: 'Ядовитая железа', type: 'material', rarity: 'uncommon', chance: 0.7, minQty: 1, maxQty: 2 },
      { itemName: 'Паутинные наручи', type: 'gloves', rarity: 'rare', chance: 0.15, minQty: 1, maxQty: 1 }
    ]
  },
  m_stone_golem: {
    id: 'm_stone_golem',
    name: 'Каменный голем (Босс)',
    regionId: 'reg_forest',
    level: 18,
    hp: 1450,
    maxHp: 1450,
    mp: 60,
    maxMp: 60,
    attack: 85,
    magicAttack: 10,
    defense: 75,
    magicDefense: 40,
    speed: 8,
    critChance: 10,
    evasion: 2,
    damageType: 'physical',
    resistances: { physical: 15, magic: 15, lightning: -10 },
    isBoss: true,
    avatar: '🗿',
    expReward: 950,
    goldReward: 800,
    drops: [
      { itemName: 'Сердце монолита', type: 'artifact', rarity: 'epic', chance: 0.35, minQty: 1, maxQty: 1 },
      { itemName: 'Булава сокрушителя камней', type: 'weapon', rarity: 'rare', chance: 0.5, minQty: 1, maxQty: 1 },
      { itemName: 'Мифриловая руда', type: 'ore', rarity: 'rare', chance: 0.8, minQty: 3, maxQty: 6 },
      { itemName: 'Горный корень', type: 'material', rarity: 'uncommon', chance: 0.55, minQty: 1, maxQty: 2 },
    ]
  },
  m_spider_queen: {
    id: 'm_spider_queen',
    name: 'Матка арахнидов (Босс)',
    regionId: 'reg_forest',
    level: 22,
    hp: 1890,
    maxHp: 1890,
    mp: 200,
    maxMp: 200,
    attack: 98,
    magicAttack: 65,
    defense: 45,
    magicDefense: 50,
    speed: 30,
    critChance: 22,
    evasion: 24,
    damageType: 'poison',
    resistances: { physical: 10, poison: 45 },
    isBoss: true,
    avatar: '🕸️',
    expReward: 1400,
    goldReward: 1100,
    drops: [
      { itemName: 'Клинок Черной Вдовы', type: 'weapon', rarity: 'legendary', chance: 0.15, minQty: 1, maxQty: 1 },
      { itemName: 'Шлем из хитина Матки', type: 'helmet', rarity: 'epic', chance: 0.4, minQty: 1, maxQty: 1 }
    ]
  },
  m_death_knight_boss: {
    id: 'm_death_knight_boss',
    name: 'Рыцарь Смерти Мортред (Босс)',
    regionId: 'reg_cursed',
    level: 50,
    hp: 5800,
    maxHp: 5800,
    mp: 400,
    maxMp: 400,
    attack: 260,
    magicAttack: 180,
    defense: 160,
    magicDefense: 130,
    speed: 35,
    critChance: 25,
    evasion: 15,
    damageType: 'dark',
    resistances: { physical: 20, dark: 40, ice: 25, holy: -15 },
    isBoss: true,
    avatar: ASSETS.mobDeathKnight,
    expReward: 6500,
    goldReward: 4800,
    drops: [
      { itemName: 'Меч Ледяной Скорби', type: 'weapon', rarity: 'legendary', chance: 0.2, minQty: 1, maxQty: 1 },
      { itemName: 'Латный доспех Рыцаря Смерти', type: 'armor', rarity: 'epic', chance: 0.5, minQty: 1, maxQty: 1 },
      { itemName: 'Магическая эссенция', type: 'material', rarity: 'rare', chance: 0.45, minQty: 1, maxQty: 2 },
    ]
  },
  m_demon_lord: {
    id: 'm_demon_lord',
    name: 'Повелитель Бездны Малгор (Босс)',
    regionId: 'reg_rift',
    level: 80,
    hp: 14500,
    maxHp: 14500,
    mp: 1200,
    maxMp: 1200,
    attack: 540,
    magicAttack: 480,
    defense: 320,
    magicDefense: 300,
    speed: 48,
    critChance: 30,
    evasion: 20,
    damageType: 'fire',
    resistances: { physical: 15, fire: 25, dark: 35, holy: -20 },
    isBoss: true,
    avatar: '👿',
    expReward: 22000,
    goldReward: 16000,
    drops: [
      { itemName: 'Корона Инферно', type: 'helmet', rarity: 'mythic', chance: 0.1, minQty: 1, maxQty: 1 },
      { itemName: 'Адская коса погибели', type: 'weapon', rarity: 'legendary', chance: 0.35, minQty: 1, maxQty: 1 },
      { itemName: 'Огненный цветок', type: 'material', rarity: 'rare', chance: 0.55, minQty: 1, maxQty: 2 },
      { itemName: 'Магическая эссенция', type: 'material', rarity: 'rare', chance: 0.65, minQty: 1, maxQty: 3 },
    ]
  },
  m_dragon_boss: {
    id: 'm_dragon_boss',
    name: 'Древний дракон Аэтельгор (Мировой Босс)',
    regionId: 'reg_dragon',
    level: 100,
    hp: 38000,
    maxHp: 38000,
    mp: 3000,
    maxMp: 3000,
    attack: 980,
    magicAttack: 920,
    defense: 620,
    magicDefense: 580,
    speed: 55,
    critChance: 35,
    evasion: 22,
    damageType: 'fire',
    resistances: { physical: 25, magic: 35, fire: 60, ice: 10, lightning: 20, dark: 20, holy: -10 },
    isBoss: true,
    avatar: ASSETS.bossDragon,
    expReward: 85000,
    goldReward: 60000,
    drops: [
      { itemName: 'Глаз Прадракона', type: 'artifact', rarity: 'divine', chance: 0.05, minQty: 1, maxQty: 1 },
      { itemName: 'Крушитель Богов Аэтельгарда', type: 'weapon', rarity: 'ancient', chance: 0.15, minQty: 1, maxQty: 1 },
      { itemName: 'Чешуйчатый доспех дракона', type: 'armor', rarity: 'mythic', chance: 0.3, minQty: 1, maxQty: 1 },
      { itemName: 'Драконит', type: 'ore', rarity: 'ancient', chance: 0.9, minQty: 5, maxQty: 15 },
      { itemName: 'Магическая эссенция', type: 'material', rarity: 'epic', chance: 0.75, minQty: 2, maxQty: 5 },
    ]
  }
};

// Regular enemies keep high-level hunting separate from boss attempts.
const veteranEnemies = [
  ['reg_desert','m_sand_scorpion','Барханный скорпион','🦂',40,'m_stone_golem'],
  ['reg_desert','m_sand_guard','Песчаный страж','🏺',45,'m_death_knight_boss'],
  ['reg_cursed','m_cursed_soldier','Проклятый легионер','💀',55,'m_death_knight_boss'],
  ['reg_cursed','m_blood_hound','Кровавый гончий','🐺',62,'m_demon_lord'],
  ['reg_rift','m_ash_imp','Пепельный бес','👹',75,'m_demon_lord'],
  ['reg_rift','m_rift_drake','Дракончик разлома','🐲',82,'m_dragon_boss'],
  ['reg_dragon','m_peak_guard','Страж драконьего пика','🛡️',90,'m_demon_lord'],
  ['reg_dragon','m_scale_hunter','Чешуйчатый охотник','🐉',100,'m_dragon_boss']
] as const;
for (const [regionId,id,name,avatar,level,sourceId] of veteranEnemies) {
  // Boss trophies remain available through regular regional hunts, with lower rates.
  MONSTERS[id] = { id, regionId, name, avatar, level, hp: 180 + level * 24,
    maxHp: 180 + level * 24, mp: 40 + level, maxMp: 40 + level,
    attack: 20 + level * 3, magicAttack: 15 + level * 2.5,
    defense: 10 + level * 1.4, magicDefense: 10 + level,
    speed: 12 + Math.floor(level / 5), critChance: 8, evasion: 6,
    expReward: 120 + level * 55, goldReward: 30 + level * 12,
    drops: [], isBoss: false };
  REGIONS.find(r => r.id === regionId)!.monsters.unshift(id);
}

REGIONS[0].monsters.push('m_queen_bat');

// Two ordinary targets and one elite establish the same hunt ladder in every zone.
for (const region of REGIONS) {
  let ordinary = region.monsters.map(id => MONSTERS[id]).filter(m => !m.isBoss && !m.isElite);
  if (ordinary.length < 2) {
    const id = `m_${region.id}_scout`;
    const level = region.minLevel;
    MONSTERS[id] = { ...MONSTERS.m_bandit, id, regionId: region.id, name: 'Региональный разведчик',
      level, hp: 180 + level * 24, maxHp: 180 + level * 24, attack: 20 + level * 3,
      magicAttack: 15 + level * 2.5, defense: 10 + level * 1.4, magicDefense: 10 + level,
      isBoss: false, isElite: false, drops: [], expReward: 120 + level * 55, goldReward: 30 + level * 12 };
    region.monsters.unshift(id);
    ordinary = region.monsters.map(id => MONSTERS[id]).filter(m => !m.isBoss && !m.isElite);
  }
  const source = ordinary[0];
  const id = `elite_${region.id}`;
  MONSTERS[id] = { ...source, id, regionId: region.id, name: `Ветеран: ${source.name}`,
    level: region.minLevel, isElite: true, isBoss: false, drops: [],
    expReward: Math.round((120 + region.minLevel * 55) * 1.5), goldReward: Math.round((30 + region.minLevel * 12) * 1.6) };
  region.monsters.push(id);
  if (!region.monsters.some(id => MONSTERS[id].isBoss)) {
    const bossId = `boss_${region.id}`;
    MONSTERS[bossId] = {...MONSTERS.m_queen_bat,id:bossId,regionId:region.id,name:`Вожак: ${region.name.split(':')[0]}`,level:region.minLevel+3,drops:[],expReward:(120+region.minLevel*55)*3,goldReward:(30+region.minLevel*12)*3};
    region.monsters.push(bossId);
  }
  region.defaultModId = 'mod_standard';
}

// Each material has a concrete mob and a concrete region. Reused monster templates
// get a different trophy when encountered in a later zone.
export const REGIONAL_TROPHIES: Record<string, Record<string, { name: string; rarity: ItemRarity; chance: number }>> = {
  reg_plains: {
    m_wolf: { name: 'Волчья шкура', rarity: 'common', chance: 0.8 },
    m_goblin: { name: 'Гоблинский механизм', rarity: 'common', chance: 0.75 },
    m_boar: { name: 'Крепкая шкура вепря', rarity: 'common', chance: 0.8 },
    m_bandit: { name: 'Знак разбойника', rarity: 'uncommon', chance: 0.65 }
  },
  reg_whisper_woods: {
    m_wolf: { name: 'Шкура сумеречного волка', rarity: 'uncommon', chance: 0.75 },
    m_goblin: { name: 'Тотем лесного гоблина', rarity: 'uncommon', chance: 0.7 },
    m_bandit: { name: 'Пряжка лесного налётчика', rarity: 'uncommon', chance: 0.7 },
    m_spider: { name: 'Лесная паутина', rarity: 'uncommon', chance: 0.7 }
  },
  reg_forgotten_crypt: {
    m_bandit: { name: 'Ключ расхитителя гробниц', rarity: 'uncommon', chance: 0.7 },
    m_spider: { name: 'Склепный хитин', rarity: 'uncommon', chance: 0.75 },
    m_stone_golem: { name: 'Сердцевина склепного стража', rarity: 'rare', chance: 0.7 },
    m_queen_bat: { name: 'Перепонка ночной королевы', rarity: 'rare', chance: 0.75 }
  },
  reg_forest: {
    m_spider: { name: 'Нить древнего паука', rarity: 'uncommon', chance: 0.8 },
    m_stone_golem: { name: 'Обломок лесного голема', rarity: 'rare', chance: 0.8 },
    m_spider_queen: { name: 'Хитин лесной матки', rarity: 'rare', chance: 0.8 }
  },
  reg_swamp: {
    m_spider: { name: 'Болотная ядовитая железа', rarity: 'rare', chance: 0.8 },
    m_stone_golem: { name: 'Топкая сердцевина', rarity: 'rare', chance: 0.8 },
    m_spider_queen: { name: 'Хитин болотной матки', rarity: 'rare', chance: 0.8 }
  },
  reg_desert: {
    m_stone_golem: { name: 'Песчаное ядро голема', rarity: 'rare', chance: 0.8 },
    m_death_knight_boss: { name: 'Печать пустынного рыцаря', rarity: 'epic', chance: 0.85 }
  },
  reg_cursed: {
    m_death_knight_boss: { name: 'Осколок проклятой брони', rarity: 'epic', chance: 0.85 },
    m_demon_lord: { name: 'Проклятая кровь демона', rarity: 'epic', chance: 0.85 }
  },
  reg_rift: {
    m_demon_lord: { name: 'Пепельное сердце демона', rarity: 'epic', chance: 0.9 },
    m_dragon_boss: { name: 'Чешуя дракона разлома', rarity: 'ancient', chance: 0.9 }
  },
  reg_dragon: {
    m_demon_lord: { name: 'Сердце драконьего стража', rarity: 'ancient', chance: 0.9 },
    m_dragon_boss: { name: 'Первородная чешуя Аэтельгора', rarity: 'ancient', chance: 0.9 }
  }
};

for (const [regionId,id,,,,sourceId] of veteranEnemies) {
  const trophy = REGIONAL_TROPHIES[regionId]?.[sourceId];
  if (trophy) REGIONAL_TROPHIES[regionId][id] = { ...trophy, chance: 0.55 };
}

export const REGION_CRAFT_TIERS = [
  { regionId: 'reg_plains', level: 1, miningLevel: 1, ore: 'Уголь', catalyst: 'Кварц', weaponMaterial: 'Волчья шкура', armorMaterial: 'Гоблинский механизм', weaponName: 'Клинок равнинного охотника', armorName: 'Доспех пастбищного дозорного', rarity: 'common' },
  { regionId: 'reg_whisper_woods', level: 5, miningLevel: 1, ore: 'Медная руда', catalyst: 'Медный кристалл', weaponMaterial: 'Шкура сумеречного волка', armorMaterial: 'Тотем лесного гоблина', weaponName: 'Клинок сумеречного леса', armorName: 'Доспех лесного следопыта', rarity: 'uncommon' },
  { regionId: 'reg_forgotten_crypt', level: 8, miningLevel: 5, ore: 'Железная руда', catalyst: 'Магнетит', weaponMaterial: 'Склепный хитин', armorMaterial: 'Сердцевина склепного стража', weaponName: 'Клинок забытого склепа', armorName: 'Доспех склепного стража', rarity: 'uncommon' },
  { regionId: 'reg_forest', level: 12, miningLevel: 15, ore: 'Серебряная руда', catalyst: 'Осколок лунного камня', weaponMaterial: 'Нить древнего паука', armorMaterial: 'Обломок лесного голема', weaponName: 'Клинок древнего леса', armorName: 'Доспех лесного голема', rarity: 'rare' },
  { regionId: 'reg_swamp', level: 25, miningLevel: 25, ore: 'Золотая руда', catalyst: 'Янтарный кристалл', weaponMaterial: 'Болотная ядовитая железа', armorMaterial: 'Топкая сердцевина', weaponName: 'Клинок гиблых болот', armorName: 'Доспех болотного стража', rarity: 'rare' },
  { regionId: 'reg_desert', level: 40, miningLevel: 40, ore: 'Мифриловая руда', catalyst: 'Арканная пыль', weaponMaterial: 'Песчаное ядро голема', armorMaterial: 'Печать пустынного рыцаря', weaponName: 'Клинок пылающей пустыни', armorName: 'Доспех песчаного рыцаря', rarity: 'epic' },
  { regionId: 'reg_cursed', level: 55, miningLevel: 60, ore: 'Адамантит', catalyst: 'Осколок титана', weaponMaterial: 'Проклятая кровь демона', armorMaterial: 'Осколок проклятой брони', weaponName: 'Клинок проклятых земель', armorName: 'Доспех проклятого рыцаря', rarity: 'epic' },
  { regionId: 'reg_rift', level: 75, miningLevel: 72, ore: 'Кровавый обсидиан', catalyst: 'Демонический уголь', weaponMaterial: 'Пепельное сердце демона', armorMaterial: 'Чешуя дракона разлома', weaponName: 'Клинок демонического разлома', armorName: 'Доспех разлома', rarity: 'mythic' },
  { regionId: 'reg_dragon', level: 90, miningLevel: 85, ore: 'Драконит', catalyst: 'Осколок драконьей чешуи', weaponMaterial: 'Сердце драконьего стража', armorMaterial: 'Первородная чешуя Аэтельгора', weaponName: 'Клинок Аэтельгора', armorName: 'Доспех драконьего пика', rarity: 'ancient' },
  { regionId: 'reg_dragon', level: 100, miningLevel: 95, ore: 'Эфириум', catalyst: 'Эфирная пыль', weaponMaterial: 'Первородная чешуя Аэтельгора', armorMaterial: 'Сердце драконьего стража', weaponName: 'Эфирный клинок Прадракона', armorName: 'Эфирный доспех Прадракона', rarity: 'divine' }
] as const;

// A catalyst is a secondary find from the same mine node as its ore.
export const MINE_CATALYST_BY_ORE: Record<string, string> = {
  'Уголь': 'Кварц',
  'Медная руда': 'Медный кристалл',
  'Железная руда': 'Магнетит',
  'Серебряная руда': 'Осколок лунного камня',
  'Золотая руда': 'Янтарный кристалл',
  'Кобальтовая руда': 'Синяя кристаллическая пыль',
  'Мифриловая руда': 'Арканная пыль',
  'Адамантит': 'Осколок титана',
  'Кровавый обсидиан': 'Демонический уголь',
  'Драконит': 'Осколок драконьей чешуи',
  'Эфириум': 'Эфирная пыль'
};

// Pick a varied recipe once in the game data. Every player sees the same
// ingredients, and crafting never rerolls them.
const buildFixedCraftIngredients = (recipe: BasicCraftRecipe) => {
  if (!recipe.regionId) return recipe.ingredients;
  const tier = REGION_CRAFT_TIERS.find(t => t.regionId === recipe.regionId && t.level === recipe.levelReq);
  if (!tier) return recipe.ingredients;
  // The base kit never depends on a boss, previous region or rare catalyst.
  return [
    { name: tier.weaponMaterial, count: 3 },
    { name: tier.armorMaterial, count: 2 },
    { name: tier.ore, count: 4 + Math.floor(tier.level / 40) }
  ];
};

export const CRAFT_RARITY_CHANCES = [
  { rarity: 'common', chance: 0.50, multiplier: 1 },
  { rarity: 'uncommon', chance: 0.27, multiplier: 1.15 },
  { rarity: 'rare', chance: 0.14, multiplier: 1.35 },
  { rarity: 'epic', chance: 0.07, multiplier: 1.65 },
  { rarity: 'legendary', chance: 0.02, multiplier: 2.1 }
] as const;

export const rollCraftRarity = (roll = Math.random()) => {
  let threshold = 0;
  for (const entry of CRAFT_RARITY_CHANCES) {
    threshold += Math.round(entry.chance * 100);
    if (roll * 100 < threshold) return entry;
  }
  return CRAFT_RARITY_CHANCES[CRAFT_RARITY_CHANCES.length - 1];
};

export const getCraftTierForLevel = (level: number) =>
  [...REGION_CRAFT_TIERS].reverse().find(tier => level >= tier.level) || REGION_CRAFT_TIERS[0];

export const getEquipmentLevelRange = (level: number) => {
  const min = 1 + Math.floor((Math.max(1, Math.floor(level)) - 1) / 4) * 4;
  return { min, max: min + 3 };
};

const EQUIPMENT_TIER_NAMES = [
  'новобранца', 'дозорного', 'следопыта', 'лесного стража', 'склепного охотника',
  'ночного разведчика', 'болотного хранителя', 'ядовитого ловца', 'сумеречного рыцаря',
  'песчаного странника', 'пустынного воителя', 'огненного стража', 'пепельного охотника',
  'проклятого рыцаря', 'грозового вестника', 'ледяного хранителя', 'рунического мастера',
  'теневого палача', 'стража разлома', 'демонического победителя', 'владыки Бездны',
  'драконьего охотника', 'стража драконьего пика', 'наследника Аэтельгора',
  'эфирного рыцаря', 'звёздного хранителя', 'небесного воителя', 'первозданного стража',
  'повелителя вечности', 'Прадракона'
];

const EQUIPMENT_BASE_NAMES: Partial<Record<ItemType, string>> = {
  weapon: 'Клинок', offhand: 'Щит', helmet: 'Шлем', armor: 'Доспех',
  pants: 'Поножи', gloves: 'Перчатки', boots: 'Сапоги', amulet: 'Амулет',
  ring: 'Кольцо', belt: 'Пояс', cloak: 'Плащ', artifact: 'Реликвия'
};

export const getLeveledEquipmentName = (name: string, type: ItemType, level: number, targetClass?: CharacterClassId) => {
  let base = EQUIPMENT_BASE_NAMES[type];
  if (!base) return name;
  if (type === 'weapon') {
    base = /посох|жезл/i.test(name) ? 'Посох' : /лук|арбалет/i.test(name) ? 'Лук' : /кинжал/i.test(name) ? 'Кинжал' : 'Клинок';
  }
  if (targetClass && (type === 'weapon' || type === 'armor')) {
    base = type === 'weapon' ? CLASS_EQUIPMENT[targetClass].weapon : CLASS_EQUIPMENT[targetClass].armor;
  }
  const range = getEquipmentLevelRange(level);
  const index = (range.min - 1) / 4;
  return `${base} ${EQUIPMENT_TIER_NAMES[index] || `покорителя ступени ${index + 1}`}`;
};

// 5% total chance: +1 2%, +2 1.5%, +3 0.9%, +4 0.45%, +5 0.15%.
export const rollCraftUpgrade = (roll = Math.random()) => {
  if (roll < 0.0015) return 5;
  if (roll < 0.006) return 4;
  if (roll < 0.015) return 3;
  if (roll < 0.03) return 2;
  if (roll < 0.05) return 1;
  return 0;
};

export const getUpgradeRequirements = (item: GameItem, upgradeLevel: number) => {
  const tier = getCraftTierForLevel(item.level);
  return {
    ore: tier.ore,
    oreCount: 3 + Math.floor(upgradeLevel / 4),
    trophy: item.type === 'armor' || item.type === 'offhand' || item.type === 'helmet'
      ? tier.armorMaterial : tier.weaponMaterial,
    trophyCount: 1 + Math.floor(upgradeLevel / 8),
    catalyst: upgradeLevel >= 10 ? MINE_CATALYST_BY_ORE[tier.ore] : null,
    catalystCount: upgradeLevel >= 10 ? 1 + Math.floor(upgradeLevel / 10) : 0,
    regionId: tier.regionId
  };
};

const REGIONAL_CRAFT_RECIPES: BasicCraftRecipe[] = REGION_CRAFT_TIERS.flatMap((tier): BasicCraftRecipe[] => {
  const region = REGIONS.find(entry => entry.id === tier.regionId)!;
  const common = {
    levelReq: tier.level,
    miningLevelReq: tier.miningLevel,
    regionId: tier.regionId,
    description: `Трофеи из «${region.name}» и ресурсы шахты.`,
  };
  return [
    {
      ...common,
      id: `regional_${tier.level}_weapon`,
      name: tier.weaponName,
      icon: '⚔️',
      ingredients: [
        { name: tier.weaponMaterial, count: 3 },
        { name: tier.armorMaterial, count: 2 },
        { name: tier.ore, count: 5 },
        { name: tier.catalyst, count: 1 }
      ],
      result: { name: tier.weaponName, type: 'weapon', rarity: tier.rarity, icon: '⚔️', level: tier.level,
        stats: { attack: 12 + tier.level * 3, critChance: 2 + Math.floor(tier.level / 20) }, sellPrice: 40 + tier.level * 20, count: 1 }
    },
    {
      ...common,
      id: `regional_${tier.level}_armor`,
      name: tier.armorName,
      icon: '🛡️',
      ingredients: [
        { name: tier.armorMaterial, count: 3 },
        { name: tier.weaponMaterial, count: 2 },
        { name: tier.ore, count: 6 },
        { name: tier.catalyst, count: 1 }
      ],
      result: { name: tier.armorName, type: 'armor', rarity: tier.rarity, icon: '🛡️', level: tier.level,
        stats: { defense: 6 + tier.level * 2, magicDefense: 4 + tier.level, maxHp: 25 + tier.level * 9 }, sellPrice: 45 + tier.level * 22, count: 1 }
    },
    {
      ...common,
      id: `regional_${tier.level}_helmet`,
      name: tier.armorName.replace('Доспех', 'Шлем'),
      icon: '🪖',
      ingredients: [
        { name: tier.armorMaterial, count: 2 },
        { name: tier.weaponMaterial, count: 2 },
        { name: tier.ore, count: 4 },
        { name: tier.catalyst, count: 1 }
      ],
      result: { name: tier.armorName.replace('Доспех', 'Шлем'), type: 'helmet', rarity: tier.rarity, icon: '🪖', level: tier.level,
        stats: { defense: 3 + tier.level, magicDefense: 3 + tier.level, maxHp: 12 + tier.level * 4 }, sellPrice: 30 + tier.level * 14, count: 1 }
    },
    {
      ...common,
      id: `regional_${tier.level}_boots`,
      name: tier.armorName.replace('Доспех', 'Сапоги'),
      icon: '👢',
      ingredients: [
        { name: tier.weaponMaterial, count: 2 },
        { name: tier.armorMaterial, count: 2 },
        { name: tier.ore, count: 4 },
        { name: tier.catalyst, count: 1 }
      ],
      result: { name: tier.armorName.replace('Доспех', 'Сапоги'), type: 'boots', rarity: tier.rarity, icon: '👢', level: tier.level,
        stats: { defense: 2 + tier.level, magicDefense: 2 + Math.floor(tier.level / 2), speed: 2 + Math.floor(tier.level / 15) }, sellPrice: 30 + tier.level * 14, count: 1 }
    }
  ];
});

const ADVANCED_REGIONAL_RECIPES: BasicCraftRecipe[] = REGIONAL_CRAFT_RECIPES.flatMap(recipe =>
  (['elite', 'boss'] as const).map(huntStage => ({
    ...recipe, id: `${recipe.id}_${huntStage}`, huntStage,
    description: `${huntStage === 'elite' ? 'Усиленный' : 'Мастерский'} комплект региона. Качество не ниже редкого.`,
    ingredients: [...buildFixedCraftIngredients(recipe),
      { name: regionalSealName(recipe.regionId!, huntStage === 'boss'), count: huntStage === 'boss' ? 1 : 2 },
      { name: MINE_CATALYST_BY_ORE[REGION_CRAFT_TIERS.find(t => t.level === recipe.levelReq)!.ore], count: 1 }],
    result: { ...recipe.result!, rarity: 'rare' as const,
      stats: Object.fromEntries(Object.entries(recipe.result!.stats).map(([key, value]) =>
        [key, ['speed','critChance','evasion'].includes(key) ? value : Math.round(value * (huntStage === 'boss' ? 1.25 : 1.12))])) }
  })));

// Shared monster templates adapt to the region where they are encountered.
export const getRegionMonster = (monster: Monster, region: RegionDefinition, minimumLevel = region.minLevel): Monster => {
  const range = region.levelRange.match(/\d+/g)?.map(Number);
  const maxLevel = Math.max(region.minLevel, range?.[1] ?? region.minLevel);
  const encounterLevel = monster.isBoss ? Math.min(monster.level, region.minLevel + 3) : monster.level;
  const level = Math.min(maxLevel, Math.max(region.minLevel, encounterLevel, minimumLevel));
  const factor = level / Math.max(1, monster.level);
  const scale = (value: number, multiplier = factor) => Math.round(value * multiplier);
  return {
    ...monster,
    regionId: region.id,
    level,
    hp: scale(monster.maxHp, Math.pow(factor, 1.25)),
    maxHp: scale(monster.maxHp, Math.pow(factor, 1.25)),
    mp: scale(monster.maxMp),
    maxMp: scale(monster.maxMp),
    attack: scale(monster.attack),
    magicAttack: scale(monster.magicAttack),
    defense: scale(monster.defense),
    magicDefense: scale(monster.magicDefense),
    expReward: scale(monster.expReward),
    goldReward: scale(monster.goldReward),
    ...regionalEnemyStats(monster, level),
    drops: [
      ...(!monster.isBoss && !monster.isElite ? REGION_CRAFT_TIERS.filter(t => t.regionId === region.id).flatMap(t => {
        const ordinary = region.monsters.filter(id => !MONSTERS[id].isBoss && !MONSTERS[id].isElite);
        const name = monster.id === ordinary[0] ? t.weaponMaterial : monster.id === ordinary[1] ? t.armorMaterial : null;
        return name && name !== REGIONAL_TROPHIES[region.id]?.[monster.id]?.name
          ? [{ itemName: name, type: 'material' as const, rarity: 'uncommon' as const, chance: .65, minQty: 1, maxQty: 1 }] : [];
      }).filter((drop, index, drops) => drops.findIndex(d => d.itemName === drop.itemName) === index) : []),
      ...monster.drops.filter(drop => (drop.type !== 'material' && drop.type !== 'ore') || monster.regionId === region.id)
        .filter(drop => drop.itemName !== REGIONAL_TROPHIES[region.id]?.[monster.id]?.name),
      ...(REGIONAL_TROPHIES[region.id]?.[monster.id] ? [{
        itemName: REGIONAL_TROPHIES[region.id][monster.id].name,
        type: 'material' as const,
        rarity: REGIONAL_TROPHIES[region.id][monster.id].rarity,
        chance: REGIONAL_TROPHIES[region.id][monster.id].chance,
        minQty: 1,
        maxQty: 2
      }] : [])
    ]
  };
};

export const MINING_NODES: MiningNode[] = [
  { id: 'ore_coal', name: 'Угольная жила', levelReq: 1, oreYield: 'Уголь', staminaCost: 3, icon: '🪨', color: '#64748b', baseYieldMin: 1, baseYieldMax: 7, gemChance: 0.05 },
  { id: 'ore_copper', name: 'Медная жила', levelReq: 1, oreYield: 'Медная руда', staminaCost: 4, icon: '🟤', color: '#b45309', baseYieldMin: 1, baseYieldMax: 6, gemChance: 0.08 },
  { id: 'ore_iron', name: 'Железная жила', levelReq: 5, oreYield: 'Железная руда', staminaCost: 5, icon: '⚪', color: '#94a3b8', baseYieldMin: 1, baseYieldMax: 5, gemChance: 0.12 },
  { id: 'ore_silver', name: 'Серебряная жила', levelReq: 15, oreYield: 'Серебряная руда', staminaCost: 7, icon: '✨', color: '#cbd5e1', baseYieldMin: 1, baseYieldMax: 4, gemChance: 0.18 },
  { id: 'ore_gold', name: 'Золотая жила', levelReq: 25, oreYield: 'Золотая руда', staminaCost: 8, icon: '🪙', color: '#eab308', baseYieldMin: 1, baseYieldMax: 3, gemChance: 0.25 },
  { id: 'ore_cobalt', name: 'Кобальтовая жила', levelReq: 35, oreYield: 'Кобальтовая руда', staminaCost: 9, icon: '🔷', color: '#2563eb', baseYieldMin: 1, baseYieldMax: 4, gemChance: 0.28 },
  { id: 'ore_mithril', name: 'Мифриловая жила', levelReq: 40, oreYield: 'Мифриловая руда', staminaCost: 10, icon: '💎', color: '#38bdf8', baseYieldMin: 1, baseYieldMax: 3, gemChance: 0.35 },
  { id: 'ore_adamantite', name: 'Адамантитовая жила', levelReq: 60, oreYield: 'Адамантит', staminaCost: 14, icon: '🟣', color: '#a855f7', baseYieldMin: 1, baseYieldMax: 3, gemChance: 0.45 },
  { id: 'ore_blood_obsidian', name: 'Жила кровавого обсидиана', levelReq: 72, oreYield: 'Кровавый обсидиан', staminaCost: 16, icon: '🩸', color: '#991b1b', baseYieldMin: 1, baseYieldMax: 2, gemChance: 0.48 },
  { id: 'ore_draconite', name: 'Драконитовая жила', levelReq: 85, oreYield: 'Драконит', staminaCost: 20, icon: '🔥', color: '#f43f5e', baseYieldMin: 1, baseYieldMax: 3, gemChance: 0.60 },
  { id: 'ore_aetherium', name: 'Эфириумная жила', levelReq: 95, oreYield: 'Эфириум', staminaCost: 24, icon: '🌌', color: '#7c3aed', baseYieldMin: 1, baseYieldMax: 2, gemChance: 0.72 }
];

export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  {
    id: 'alc_hp_small',
    resultItem: 'Малое зелье исцеления',
    resultCount: 2,
    name: 'Малое зелье исцеления',
    description: 'Восстанавливает 120 ед. здоровья в бою или путешествии.',
    levelReq: 1,
    craftTimeSeconds: 1,
    icon: '🧪',
    ingredients: [
      { name: 'Уголь', count: 2 }
    ]
  },
  {
    id: 'alc_mp_small',
    resultItem: 'Малое зелье маны',
    resultCount: 2,
    name: 'Малое зелье маны',
    description: 'Восстанавливает 80 ед. маны.',
    levelReq: 1,
    craftTimeSeconds: 1,
    icon: '💧',
    ingredients: [
      { name: 'Медная руда', count: 2 }
    ]
  },
  {
    id: 'alc_hp_great',
    resultItem: 'Великое зелье исцеления',
    resultCount: 1,
    name: 'Великое зелье исцеления',
    description: 'Восстанавливает 650 ед. здоровья.',
    levelReq: 15,
    craftTimeSeconds: 2,
    icon: '💖',
    ingredients: [
      { name: 'Лечебная трава', count: 6 },
      { name: 'Ядовитая железа', count: 2 },
      { name: 'Магическая эссенция', count: 1 }
    ]
  },
  {
    id: 'alc_berserk',
    resultItem: 'Эликсир берсерка',
    resultCount: 1,
    name: 'Эликсир берсерка',
    description: '+25% к атаке и +15% к криту на время боя.',
    levelReq: 20,
    craftTimeSeconds: 3,
    icon: '🩸',
    ingredients: [
      { name: 'Острый клык', count: 4 },
      { name: 'Огненный цветок', count: 2 }
    ]
  },
  {
    id: 'alc_stoneskin',
    resultItem: 'Эликсир каменной кожи',
    resultCount: 1,
    name: 'Эликсир каменной кожи',
    description: '+40% к защите и сопротивлению магии.',
    levelReq: 30,
    craftTimeSeconds: 3,
    icon: '🗿',
    ingredients: [
      { name: 'Железная руда', count: 3 },
      { name: 'Горный корень', count: 3 }
    ]
  },
  {
    id: 'alc_dragon_blood',
    resultItem: 'Кровь прадракона',
    resultCount: 1,
    name: 'Кровь прадракона',
    description: 'Мифическое зелье: восстанавливает всё HP и дарует неуязвимость на 1 ход.',
    levelReq: 50,
    craftTimeSeconds: 5,
    icon: '🍷',
    ingredients: [
      { name: 'Драконит', count: 1 },
      { name: 'Магическая эссенция', count: 5 }
    ]
  }
];

for (const tier of REGION_CRAFT_TIERS.filter(t => t.level >= 5)) {
  const levelReq = Math.max(1, Math.floor(tier.level / 4));
  for (const kind of ['hp','mp'] as const) {
    const amount = kind === 'hp' ? 150 + tier.level * 25 : 80 + tier.level * 10;
    const name = `${kind === 'hp' ? 'Настой здоровья' : 'Настой маны'} · ур. ${tier.level}`;
    ALCHEMY_RECIPES.push({ id: `alc_regional_${tier.level}_${kind}`, name, resultItem: name, resultCount: 2,
      description: `Восстанавливает ${amount} ${kind === 'hp' ? 'HP' : 'MP'}. Материалы обычной охоты и шахты.`,
      levelReq, heroLevelReq: tier.level, regionId: tier.regionId, craftTimeSeconds: 2,
      icon: kind === 'hp' ? '🧪' : '💧', resultStats: kind === 'hp' ? {heal: amount} : {manaRestore: amount},
      ingredients: [{name: kind === 'hp' ? tier.armorMaterial : tier.weaponMaterial, count: 2}, {name: tier.ore, count: 2}] });
  }
}

const RAW_BASIC_CRAFT_RECIPES: BasicCraftRecipe[] = [
  {
    id: 'basic_boar_ration',
    name: 'Сытный паёк из вепря',
    description: 'Переработать мясо в компактный боевой расходник. Восстанавливает 100 HP.',
    icon: '🍖',
    ingredients: [{ name: 'Мясо вепря', count: 3 }],
    result: {
      name: 'Сытный паёк из вепря',
      type: 'potion',
      rarity: 'common',
      icon: '🍖',
      stats: { heal: 100 },
      sellPrice: 12,
      count: 1
    }
  },
  {
    id: 'basic_wolf_gloves',
    name: 'Перчатки следопыта',
    description: 'Простая экипировка из волчьих шкур.',
    icon: '🧤',
    ingredients: [{ name: 'Волчья шкура', count: 4 }, { name: 'Уголь', count: 2 }],
    result: {
      name: 'Перчатки следопыта',
      type: 'gloves',
      rarity: 'uncommon',
      icon: '🧤',
      stats: { defense: 4, maxHp: 12 },
      sellPrice: 28,
      count: 1
    }
  },
  {
    id: 'basic_wolf_boots',
    name: 'Сапоги охотника',
    description: 'Базовые сапоги из обработанной волчьей шкуры.',
    icon: '👢',
    ingredients: [{ name: 'Волчья шкура', count: 5 }, { name: 'Уголь', count: 2 }],
    result: {
      name: 'Сапоги охотника',
      type: 'boots',
      rarity: 'uncommon',
      icon: '👢',
      stats: { defense: 3, speed: 2 },
      sellPrice: 32,
      count: 1
    }
  },
  {
    id: 'basic_goblin_coin_exchange',
    name: 'Переплавить монеты гоблинов',
    description: 'Ненужные медные монеты превращаются в обычное серебро.',
    icon: '🥈',
    ingredients: [{ name: 'Медная монета гоблинов', count: 5 }],
    silverReward: 30
  },
  ...[...REGIONAL_CRAFT_RECIPES, ...ADVANCED_REGIONAL_RECIPES].flatMap((recipe): BasicCraftRecipe[] => {
    const fixed = { ...recipe, ingredients: recipe.huntStage ? recipe.ingredients : buildFixedCraftIngredients(recipe) };
    if (recipe.result?.type !== 'weapon' && recipe.result?.type !== 'armor') return [fixed];
    const result = recipe.result;
    return CLASS_GEAR_IDS.map(targetClass => ({
      ...fixed,
      id: `${recipe.id}_${targetClass}`,
      name: getLeveledEquipmentName(result.name, result.type, result.level || 1, targetClass),
      result: { ...result, targetClass }
    }));
  })
];

// Store canonical names and levels in the recipes themselves, so every
// consumer sees the same item that crafting will create. Starter equipment
// belongs to the first region instead of appearing in every endgame list.
export const BASIC_CRAFT_RECIPES: BasicCraftRecipe[] = RAW_BASIC_CRAFT_RECIPES.map(recipe => {
  if (!recipe.result || !EQUIPMENT_BASE_NAMES[recipe.result.type]) return recipe;
  const level = recipe.result.level ?? recipe.levelReq ?? 1;
  const name = getLeveledEquipmentName(recipe.result.name, recipe.result.type, level, recipe.result.targetClass);
  return {
    ...recipe,
    name,
    regionId: recipe.regionId || 'reg_plains',
    levelReq: recipe.levelReq ?? level,
    miningLevelReq: recipe.miningLevelReq ?? 1,
    result: { ...recipe.result, name, level }
  };
});

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'q_plains_wolves',
    title: 'Охота на лесных волков',
    category: 'hunting',
    description: 'Отправляйтесь в Зеленые равнины и уничтожьте 3 Свирепых лесных волков, угрожающих караванам.',
    targetCount: 3,
    currentCount: 0,
    completed: false,
    claimed: false,
    targetMonsterId: 'm_wolf',
    targetMonsterName: 'Свирепый лесной волк',
    targetRegionId: 'reg_plains',
    targetRegionName: 'Зеленые равнины',
    rewardGold: 250,
    rewardSilver: 550,
    rewardExp: 150,
    rewardItems: ['Острый клык', 'Малое зелье исцеления']
  },
  {
    id: 'q_plains_goblins',
    title: 'Засада гоблинов-разведчиков',
    category: 'hunting',
    description: 'Шайка гоблинов шпионит у границ деревни. Истребите 4 Гоблинов-разведчиков в Зеленых равнинах.',
    targetCount: 4,
    currentCount: 0,
    completed: false,
    claimed: false,
    targetMonsterId: 'm_goblin',
    targetMonsterName: 'Гоблин-разведчик',
    targetRegionId: 'reg_plains',
    targetRegionName: 'Зеленые равнины',
    rewardGold: 350,
    rewardSilver: 830,
    rewardExp: 220,
    rewardItems: ['Ржавый кинжал']
  },
  {
    id: 'q_plains_boars',
    title: 'Клыкастая угроза',
    category: 'hunting',
    description: 'Вепри топчут крестьянские поля в Зеленых равнинах. Победите 3 Клыкастых вепрей.',
    targetCount: 3,
    currentCount: 0,
    completed: false,
    claimed: false,
    targetMonsterId: 'm_boar',
    targetMonsterName: 'Клыкастый вепрь',
    targetRegionId: 'reg_plains',
    targetRegionName: 'Зеленые равнины',
    rewardGold: 450,
    rewardSilver: 880,
    rewardExp: 300
  },
  {
    id: 'q_forest_spiders',
    title: 'Паутина Зачарованного леса',
    category: 'hunting',
    description: 'Совершите переход в Зачарованный темный лес и уничтожьте 3 Ядовитых тарантулов.',
    targetCount: 3,
    currentCount: 0,
    completed: false,
    claimed: false,
    targetMonsterId: 'm_spider',
    targetMonsterName: 'Ядовитый тарантул',
    targetRegionId: 'reg_forest',
    targetRegionName: 'Зачарованный темный лес',
    rewardGold: 600,
    rewardSilver: 1200,
    rewardExp: 500,
    rewardItems: ['Ядовитая железа']
  },
  {
    id: 'q_caves_bat_queen',
    title: 'Владычица подземных сводов',
    category: 'boss',
    description: 'Спуститесь в Пещеру летучих мышей в Зеленых равнинах и сокрушите могучую Королеву мышей (Босс).',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    claimed: false,
    targetMonsterId: 'm_queen_bat',
    targetMonsterName: 'Королева мышей (Босс)',
    targetRegionId: 'reg_plains',
    targetRegionName: 'Зеленые равнины',
    rewardGold: 1200,
    rewardSilver: 2150,
    rewardExp: 1000,
    rewardItems: ['Крылья Королевы Мышей']
  },
  {
    id: 'q_cursed_deathknight',
    title: 'Проклятие павшего рыцаря',
    category: 'boss',
    description: 'Соберите волю в кулак, отправляйтесь в Проклятые земли и одолейте грозного Рыцаря Смерти Мортреда.',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    claimed: false,
    targetMonsterId: 'm_death_knight_boss',
    targetMonsterName: 'Рыцарь Смерти Мортред (Босс)',
    targetRegionId: 'reg_cursed',
    targetRegionName: 'Проклятые земли',
    rewardGold: 2500,
    rewardSilver: 4500,
    rewardExp: 3500,
    rewardItems: ['Меч Ледяной Скорби']
  },
  {
    id: 'q_mining_iron',
    title: 'Снабжение кузницы рудой',
    category: 'mining',
    description: 'Добудьте 15 единиц любой руды в рудниках для поддержания арсенала королевства.',
    targetCount: 15,
    currentCount: 0,
    completed: false,
    claimed: false,
    rewardGold: 400,
    rewardSilver: 920,
    rewardExp: 250
  },
  {
    id: 'q_daily_slayer',
    title: 'Ежедневная зачистка окрестностей',
    category: 'daily',
    description: 'Победите 10 любых монстров сегодня, чтобы обезопасить торговые тракты.',
    targetCount: 10,
    currentCount: 0,
    completed: false,
    claimed: false,
    rewardGold: 600,
    rewardSilver: 1500,
    rewardExp: 450
  }
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_1',
    title: 'Первая кровь',
    description: 'Одержите свою первую победу над монстром.',
    icon: '⚔️',
    progress: 0,
    maxProgress: 1,
    completed: false,
    claimed: false,
    permanentBonusDesc: '+2% к физ. урону навсегда',
    rewardGold: 200,
    rewardSilver: 400
  },
  {
    id: 'ach_2',
    title: 'Гроза монстров',
    description: 'Убейте 50 монстров в боях.',
    icon: '💀',
    progress: 0,
    maxProgress: 50,
    completed: false,
    claimed: false,
    permanentBonusDesc: '+5% к опыту навсегда',
    rewardGold: 1000,
    rewardSilver: 1000
  },
  {
    id: 'ach_3',
    title: 'Сокрушитель боссов',
    description: 'Убейте своего первого подземельного босса.',
    icon: '👑',
    progress: 0,
    maxProgress: 1,
    completed: false,
    claimed: false,
    permanentBonusDesc: '+5% к выпадению редких предметов',
    rewardGold: 2500,
    rewardSilver: 2000
  },
  {
    id: 'ach_4',
    title: 'Мастер горного дела',
    description: 'Добудьте 100 единиц руды.',
    icon: '⛏️',
    progress: 0,
    maxProgress: 100,
    completed: false,
    claimed: false,
    permanentBonusDesc: '+10% к шансу критической добычи',
    rewardGold: 1500,
    rewardSilver: 1200
  },
  {
    id: 'ach_5',
    title: 'Легендарный кузнец',
    description: 'Заточите любой предмет до +10 и выше.',
    icon: '🔨',
    progress: 0,
    maxProgress: 10,
    completed: false,
    claimed: false,
    permanentBonusDesc: '+3% к шансу успешной заточки',
    rewardGold: 5000,
    rewardSilver: 4000
  }
];

export const PETS_LIST: Pet[] = [
  {
    id: 'pet_wolf',
    name: 'Снежный лютоволк',
    level: 1,
    rarity: 'rare',
    icon: '🐺',
    passiveBonus: '+8% физического урона',
    stats: { attack: 15, speed: 5 },
    activeSkillName: 'Рвущий укус',
    activeSkillDesc: 'Наносит до 80 урона в начале боя, оставляя минимум 1 HP.'
  },
  {
    id: 'pet_dragon',
    name: 'Огненный дракончик',
    level: 1,
    rarity: 'epic',
    icon: '🐉',
    passiveBonus: '+12% к огненному урону и +5% к криту',
    stats: { magicAttack: 25, critChance: 5 },
    activeSkillName: 'Дыхание пламени',
    activeSkillDesc: 'Поджигает противника на 2 хода: 12 урона за ход.'
  },
  {
    id: 'pet_fairy',
    name: 'Астральная фея',
    level: 1,
    rarity: 'rare',
    icon: '🧚',
    passiveBonus: '+15% к восстановлению маны и +5 реген HP',
    stats: { mpRegen: 5, hpRegen: 5 },
    activeSkillName: 'Свет исцеления',
    activeSkillDesc: 'Каждый третий ход восстанавливает 50 HP.'
  },
  {
    id: 'pet_golem',
    name: 'Адамантитовый големчик',
    level: 1,
    rarity: 'epic',
    icon: '🗿',
    passiveBonus: '+35 защиты и +180 HP',
    stats: { defense: 35, maxHp: 180 },
    activeSkillName: 'Каменный заслон',
    activeSkillDesc: 'В начале боя: на 15% меньше урона в течение 2 ходов.'
  },
  {
    id: 'pet_voidling',
    name: 'Эфирный пустотник',
    level: 1,
    rarity: 'mythic',
    icon: '🌌',
    passiveBonus: '+40 магической атаки и +7% крита',
    stats: { magicAttack: 40, critChance: 7 },
    activeSkillName: 'Разрыв эфира',
    activeSkillDesc: 'В начале боя снижает базовое сопротивление магии на 10 п.п.'
  }
];

export const ARENA_BOTS: ArenaOpponent[] = [
  {
    id: 'opp_1',
    name: 'Рагнар Железнобокий',
    characterClass: 'warrior',
    level: 3,
    powerRating: 240,
    rating: 1050,
    avatar: '🛡️',
    league: 'Бронза',
    stats: { hp: 280, attack: 35, defense: 22, speed: 12, critChance: 8 }
  },
  {
    id: 'opp_2',
    name: 'Ванесса Теневой Клинок',
    characterClass: 'rogue',
    level: 5,
    powerRating: 380,
    rating: 1120,
    avatar: '🗡️',
    league: 'Бронза',
    stats: { hp: 320, attack: 48, defense: 14, speed: 20, critChance: 18 }
  },
  {
    id: 'opp_3',
    name: 'Архимаг Элириан',
    characterClass: 'mage',
    level: 8,
    powerRating: 620,
    rating: 1240,
    avatar: '🔮',
    league: 'Серебро',
    stats: { hp: 440, attack: 72, defense: 25, speed: 18, critChance: 14 }
  },
  {
    id: 'opp_4',
    name: 'Мортис Пожиратель Душ',
    characterClass: 'necromancer',
    level: 12,
    powerRating: 980,
    rating: 1390,
    avatar: '💀',
    league: 'Серебро',
    stats: { hp: 650, attack: 95, defense: 40, speed: 22, critChance: 16 }
  },
  {
    id: 'opp_5',
    name: 'Кровавый Берсерк Корг',
    characterClass: 'berserker',
    level: 18,
    powerRating: 1650,
    rating: 1560,
    avatar: '🪓',
    league: 'Золото',
    stats: { hp: 1100, attack: 165, defense: 55, speed: 26, critChance: 24 }
  },
  {
    id: 'opp_6',
    name: 'Лорд-Командующий Валориан',
    characterClass: 'paladin',
    level: 25,
    powerRating: 2800,
    rating: 1850,
    avatar: '✝️',
    league: 'Платина',
    stats: { hp: 2200, attack: 240, defense: 180, speed: 28, critChance: 20 }
  }
];

export const RARITY_COLORS: Record<ItemRarity, { border: string; text: string; bg: string; glow: string; label: string }> = {
  common: {
    border: 'border-slate-600',
    text: 'text-slate-300',
    bg: 'bg-slate-900/60',
    glow: 'shadow-none',
    label: 'Обычный'
  },
  uncommon: {
    border: 'border-emerald-600',
    text: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    glow: 'shadow-emerald-900/20',
    label: 'Необычный'
  },
  rare: {
    border: 'border-cyan-500',
    text: 'text-cyan-400',
    bg: 'bg-cyan-950/30',
    glow: 'shadow-cyan-500/20',
    label: 'Редкий'
  },
  epic: {
    border: 'border-purple-500',
    text: 'text-purple-400',
    bg: 'bg-purple-950/30',
    glow: 'shadow-purple-500/20',
    label: 'Эпический'
  },
  legendary: {
    border: 'border-amber-400',
    text: 'text-amber-400',
    bg: 'bg-amber-950/30',
    glow: 'shadow-amber-500/30',
    label: 'Легендарный'
  },
  mythic: {
    border: 'border-rose-500',
    text: 'text-rose-400',
    bg: 'bg-rose-950/30',
    glow: 'shadow-rose-500/30',
    label: 'Мифический'
  },
  ancient: {
    border: 'border-teal-300',
    text: 'text-teal-300',
    bg: 'bg-teal-950/30',
    glow: 'shadow-teal-400/30',
    label: 'Древний'
  },
  divine: {
    border: 'border-yellow-200',
    text: 'text-yellow-200',
    bg: 'bg-gradient-to-br from-yellow-950/40 via-purple-950/40 to-slate-900',
    glow: 'shadow-yellow-300/40',
    label: 'Божественный'
  }
};

export const STARTER_ITEMS: Record<CharacterClassId, GameItem[]> = {
  warrior: [
    {
      id: 'item_start_w1',
      templateId: 'blade_recruit',
      name: 'Меч рекрута',
      type: 'weapon',
      rarity: 'common',
      level: 1,
      upgradeLevel: 0,
      icon: '🗡️',
      description: 'Базовый стальной меч ополченца.',
      baseAttack: 14,
      stats: { attack: 14, strength: 3 },
      sellPrice: 20,
      disassembleYield: { ore: 2, silver: 1 }
    },
    {
      id: 'item_start_w2',
      templateId: 'shield_iron',
      name: 'Кованый щит',
      type: 'offhand',
      rarity: 'common',
      level: 1,
      upgradeLevel: 0,
      icon: '🛡️',
      description: 'Крепкий щит из полос железа.',
      baseDefense: 10,
      stats: { defense: 10, vitality: 2 },
      sellPrice: 25,
      disassembleYield: { ore: 3 }
    },
    {
      id: 'item_start_w3',
      templateId: 'armor_leather',
      name: 'Кольчужная рубаха',
      type: 'armor',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🦺',
      description: 'Защищает жизненно важные органы.',
      baseDefense: 15,
      stats: { defense: 15, maxHp: 30 },
      sellPrice: 40,
      disassembleYield: { ore: 4, silver: 2 }
    }
  ],
  berserker: [
    {
      id: 'item_start_b1',
      templateId: 'axe_double',
      name: 'Двуручная секира ярости',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🪓',
      description: 'Тяжелый топор с зазубренным лезвием.',
      baseAttack: 22,
      stats: { attack: 22, critDamage: 10 },
      sellPrice: 35,
      disassembleYield: { ore: 4, silver: 1 }
    }
  ],
  knight: [
    {
      id: 'item_start_k1',
      templateId: 'lance_guard',
      name: 'Меч рыцаря ордена',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '⚔️',
      baseAttack: 16,
      stats: { attack: 16, defense: 8 },
      sellPrice: 30,
      disassembleYield: { ore: 3 }
    }
  ],
  rogue: [
    {
      id: 'item_start_r1',
      templateId: 'dagger_bandit',
      name: 'Пара кинжалов теней',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🗡️',
      description: 'Легкие и сбалансированные клинки.',
      baseAttack: 16,
      stats: { attack: 16, critChance: 6, speed: 4 },
      sellPrice: 35,
      disassembleYield: { ore: 2, silver: 2 }
    }
  ],
  assassin: [
    {
      id: 'item_start_a1',
      templateId: 'dagger_venom',
      name: 'Кинжал ликвидатора',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🗡️',
      baseAttack: 18,
      stats: { attack: 18, critChance: 8 },
      sellPrice: 40,
      disassembleYield: { ore: 2, silver: 2 }
    }
  ],
  archer: [
    {
      id: 'item_start_arc1',
      templateId: 'bow_elm',
      name: 'Ильмовый лук следопыта',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🏹',
      baseAttack: 17,
      stats: { attack: 17, accuracy: 10, agility: 3 },
      sellPrice: 35,
      disassembleYield: { ore: 2 }
    }
  ],
  mage: [
    {
      id: 'item_start_m1',
      templateId: 'staff_novice',
      name: 'Посох стихийного ученика',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🔮',
      description: 'Концентрирует магическую энергию стихий.',
      baseAttack: 8,
      stats: { magicAttack: 22, intelligence: 4, maxMp: 25 },
      sellPrice: 40,
      disassembleYield: { silver: 4 }
    },
    {
      id: 'item_start_m2',
      templateId: 'robe_apprentice',
      name: 'Мантия адепта',
      type: 'armor',
      rarity: 'common',
      level: 1,
      upgradeLevel: 0,
      icon: '🥋',
      baseDefense: 6,
      stats: { magicDefense: 15, mpRegen: 2 },
      sellPrice: 30,
      disassembleYield: { silver: 2 }
    }
  ],
  necromancer: [
    {
      id: 'item_start_n1',
      templateId: 'scythe_bone',
      name: 'Костяной жезл могильщика',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '💀',
      baseAttack: 10,
      stats: { magicAttack: 20, vampirism: 4 },
      sellPrice: 40,
      disassembleYield: { silver: 3 }
    }
  ],
  paladin: [
    {
      id: 'item_start_p1',
      templateId: 'hammer_radiant',
      name: 'Священный боевой молот',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🔨',
      baseAttack: 16,
      stats: { attack: 16, magicAttack: 10, defense: 6 },
      sellPrice: 40,
      disassembleYield: { ore: 3, silver: 2 }
    }
  ],
  druid: [
    {
      id: 'item_start_d1',
      templateId: 'staff_oak',
      name: 'Дубовый посох хранителя',
      type: 'weapon',
      rarity: 'uncommon',
      level: 1,
      upgradeLevel: 0,
      icon: '🌿',
      baseAttack: 12,
      stats: { attack: 12, magicAttack: 16, hpRegen: 3 },
      sellPrice: 35,
      disassembleYield: { silver: 3 }
    }
  ]
};
