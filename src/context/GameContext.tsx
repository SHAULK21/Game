import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PlayerCharacter, 
  GameItem, 
  ItemType, 
  ItemRarity,
  CharacterClassId, 
  CombatStats, 
  Monster, 
  MonsterSkill,
  BattleLogEntry, 
  AutoBattleSettings,
  StatusEffect,
  DungeonRun,
  Quest,
  Achievement,
  ChatMessage,
  ArenaOpponent,
  TravelState,
  RegionModifier,
  MiningExpeditionReward
} from '../types/game';
import { 
  CLASSES, 
  REGIONS, 
  CAVES, 
  MONSTERS, 
  getRegionMonster,
  getUpgradeRequirements,
  rollCraftRarity,
  rollCraftUpgrade,
  getEquipmentLevelRange,
  getLeveledEquipmentName,
  RARITY_COLORS,
  STARTER_ITEMS, 
  INITIAL_QUESTS, 
  INITIAL_ACHIEVEMENTS, 
  PETS_LIST, 
  ARENA_BOTS,
  ASSETS,
  REGION_MODIFIERS,
  MINING_NODES,
  ALCHEMY_RECIPES,
  BASIC_CRAFT_RECIPES
} from '../data/gameData';
import { sound } from '../utils/audio';
import { getTelegramUser, getTelegramWebApp, triggerHaptic, TelegramUser } from '../utils/telegram';
import { generateCombatLoot } from '../utils/lootGenerator';
import { getEnergyElixirPrice, getDungeonCompletionReward, rollDungeonChest, rollDungeonBlessing } from '../utils/dungeonRewards';
import { applyClassGear, getEffectiveGearStats } from '../utils/classEquipment';
import { addExperience, getNextExperience } from '../utils/progression';
import { applyStatusEffect, getStatusModifiers, tickStatusEffects } from '../utils/statusEffects';
import { apiRequest } from '../utils/api';
import { CLASS_SKILLS, HIDDEN_SKILLS, hiddenSkillReady, reconcileSkills, skillTier } from '../data/classEvolution';

interface GameContextType {
  player: PlayerCharacter | null;
  activeMonster: Monster | null;
  combatChain: { total: number; defeated: number; remaining: number } | null;
  battleLog: BattleLogEntry[];
  combatRound: number;
  lastCombatReward: { gold: number; silver: number; exp: number; items: GameItem[] } | null;
  isInCombat: boolean;
  isCombatEnded: boolean;
  combatOutcome: 'victory' | 'defeat' | 'flee' | null;
  combatPlayerHp: number;
  combatPlayerMp: number;
  turnPhase: 'player' | 'monster' | 'ended';
  playerEffects: StatusEffect[];
  monsterEffects: StatusEffect[];
  monsterIntent: MonsterSkill | null;
  comboReady: string[];
  autoBattle: AutoBattleSettings;
  activeDungeonRun: DungeonRun | null;
  quests: Quest[];
  achievements: Achievement[];
  chatMessages: ChatMessage[];
  onlinePlayersCount: number;
  combatStats: CombatStats;
  offlineReport: { minutes: number; gold: number; exp: number; kills: number; itemsCount: number; miningRewards?: MiningExpeditionReward[] } | null;
  travelState: TravelState;
  premium: { active: boolean; premiumUntil: string | null; priceStars: number; periodDays: number; loading: boolean; invoiceLink?: string | null };
  
  // Actions
  createCharacter: (name: string, classId: CharacterClassId) => void;
  resetCharacter: () => void;
  allocateAttribute: (attr: keyof PlayerCharacter['attributes']) => void;
  unlockTalent: (talentId: string) => void;
  equipItem: (item: GameItem) => void;
  unequipItem: (type: ItemType) => void;
  sellItem: (item: GameItem) => void;
  disassembleItem: (item: GameItem) => void;
  toggleItemLock: (itemId: string) => void;
  refreshServerInventory: () => Promise<void>;
  expandInventory: () => void;
  upgradeItem: (item: GameItem, useProtection: boolean) => { success: boolean; message: string };
  meditateOrRefillEnergy: (mode: 'meditate' | 'silver' | 'potion') => void;
  setActiveRegionMod: (modId: string) => void;
  setActivePet: (petId: string) => boolean;
  craftPet: (petId: string) => { success: boolean; message: string };
  
  // Combat
  startBattleWithMonster: (monster: Monster, options?: { chain?: boolean; energyCost?: number }) => boolean;
  startNextCombatBattle: () => boolean;
  performPlayerAction: (actionType: 'attack' | 'skill' | 'defend' | 'potion' | 'flee', skillId?: string) => void;
  toggleAutoBattle: () => void;
  updateAutoBattleSettings: (settings: Partial<AutoBattleSettings>) => void;
  exitCombat: () => void;

  // Exploration & Dungeons
  setCurrentRegion: (regionId: string) => void;
  startTravel: (regionId: string, modId?: string) => { success: boolean; message: string };
  enterDungeon: (caveId: string, difficulty?: DungeonRun['difficulty']) => void;
  proceedDungeonRoom: (choice?: 'fight' | 'open' | 'pray' | 'disarm') => void;
  exitDungeon: () => void;

  // Gathering & Crafting
  mineNode: (nodeId: string) => { success: boolean; yieldCount: number; isCrit: boolean; oreName: string };
  startMiningExpedition: (hours: 1 | 3 | 7) => { success: boolean; message: string };
  claimMiningExpedition: () => { success: boolean; message: string };
  leaveMiningExpedition: () => { success: boolean; message: string };
  craftAlchemy: (recipeId: string) => boolean;
  listMarketItem: (item: GameItem, quantity: number, priceGold: number) => Promise<{ success: boolean; message: string }>;
  refreshMarketIncome: () => Promise<void>;
  buyMarketListing: (listingId: string, expectedPriceGold?: number) => Promise<{ success: boolean; message: string }>;
  buyBasicConsumable: (templateId: string, priceGold: number) => boolean;
  craftBasicItem: (recipeId: string) => { success: boolean; message: string };
  refreshPremiumStatus: () => Promise<void>;
  preparePremiumInvoice: () => Promise<string | null>;
  purchasePremium: (preparedInvoiceLink?: string | null) => Promise<{ success: boolean; message: string }>;

  // Arena & Clan
  challengeArena: (opponent: ArenaOpponent) => boolean;
  claimQuestReward: (questId: string) => void;
  claimAchievementReward: (achievementId: string) => void;
  sendChatMessage: (text: string, channel: 'global' | 'clan') => void;
  dismissOfflineReport: () => void;

  // Admin
  adminAddGold: (amt: number) => void;
  adminAddSilver: (amt: number) => void;
  adminLevelUp: () => void;
  adminSpawnLegendaryItem: () => void;
  adminHealAll: () => void;
}

interface CombatChainState {
  total: number;
  defeated: number;
  queue: Monster[];
}

const getMonsterCombatSkills = (monster: Monster): MonsterSkill[] => {
  if (monster.skills?.length) return monster.skills.map(s => ({ ...s, currentCooldown: s.currentCooldown || 0 }));
  const common: MonsterSkill[] = [
    { id: monster.id + '_heavy', name: 'Сокрушительный удар', icon: '💥', manaCost: 0, cooldown: 3, damageMultiplier: 1.45, damageType: monster.damageType || 'physical', description: 'Сильная атака с повышенным уроном.' },
    { id: monster.id + '_guard', name: 'Укрепление', icon: '🛡️', manaCost: 15, cooldown: 5, damageMultiplier: 0.55, damageType: monster.damageType || 'physical', effect: 'fortify', effectChance: 1, effectDuration: 2, effectPower: 25, description: 'Атака и укрепление защиты.' }
  ];
  if (monster.damageType === 'poison' || monster.id.includes('spider')) {
    common[0] = { id: monster.id + '_venom', name: 'Ядовитый плевок', icon: '☠️', manaCost: 12, cooldown: 3, damageMultiplier: 1.25, damageType: 'poison', effect: 'poison', effectChance: 0.9, effectDuration: 3, effectPower: Math.max(10, Math.round(monster.attack * 0.25)), description: 'Наносит урон и накладывает яд.' };
  } else if (monster.damageType === 'fire') {
    common[0] = { id: monster.id + '_flame', name: 'Пылающий взрыв', icon: '🔥', manaCost: 20, cooldown: 3, damageMultiplier: 1.55, damageType: 'fire', effect: 'burn', effectChance: 0.75, effectDuration: 3, effectPower: Math.max(12, Math.round(monster.magicAttack * 0.2)), description: 'Огненная атака с поджиганием.' };
  } else if (monster.damageType === 'dark') {
    common[0] = { id: monster.id + '_curse', name: 'Проклятие тьмы', icon: '🌑', manaCost: 20, cooldown: 4, damageMultiplier: 1.35, damageType: 'dark', effect: 'vulnerability', effectChance: 0.65, effectDuration: 2, effectPower: 20, description: 'Тёмный удар, ослабляющий защиту.' };
  } else if (monster.isBoss) {
    common[0] = { id: monster.id + '_ultimate', name: 'Королевский натиск', icon: '👑', manaCost: 35, cooldown: 4, damageMultiplier: 1.85, damageType: monster.damageType || 'physical', effect: 'stun', effectChance: 0.25, effectDuration: 1, effectPower: 0, description: 'Особый приём босса с шансом оглушения.' };
  }
  return common;
};

const getMonsterPlannedSkill = (monster: Monster): MonsterSkill | null => {
  const readySkills = (monster.skills || []).filter(skill => (skill.currentCooldown || 0) <= 0 && monster.mp >= skill.manaCost);
  if (!readySkills.length) return null;
  return [...readySkills].sort((a, b) =>
    (b.damageMultiplier + (b.effect ? 0.2 : 0)) - (a.damageMultiplier + (a.effect ? 0.2 : 0))
  )[0] || null;
};

const prepareMonsterForCombat = (monster: Monster): Monster => {
  const levelFactor = 1 + Math.min(0.55, monster.level * 0.006);
  const roleFactor = monster.isBoss ? 1.35 : monster.isElite ? 1.18 : 1;
  const hpMultiplier = 2.15 * levelFactor * roleFactor;
  const damageMultiplier = 1.35 * Math.sqrt(levelFactor) * (monster.isBoss ? 1.12 : 1);
  const defenseMultiplier = 1.28 * Math.sqrt(levelFactor);

  return {
    ...monster,
    hp: Math.max(1, Math.round(monster.maxHp * hpMultiplier)),
    maxHp: Math.max(1, Math.round(monster.maxHp * hpMultiplier)),
    mp: monster.maxMp,
    maxMp: monster.maxMp,
    attack: Math.max(1, Math.round(monster.attack * damageMultiplier)),
    magicAttack: Math.max(0, Math.round(monster.magicAttack * damageMultiplier)),
    defense: Math.max(0, Math.round(monster.defense * defenseMultiplier)),
    magicDefense: Math.max(0, Math.round(monster.magicDefense * defenseMultiplier)),
    expReward: Math.max(1, Math.round(monster.expReward * 1.2)),
    goldReward: Math.max(1, Math.round(monster.goldReward * 1.12)),
    skills: getMonsterCombatSkills(monster)
  };
};

const buildCombatChain = (firstMonster: Monster, _player: PlayerCharacter, _stats: CombatStats, regionId: string) => {
  const region = REGIONS.find(r => r.id === regionId) || REGIONS[0];
  const normalPool = region.monsters
    .map(id => MONSTERS[id])
    .filter((m): m is Monster => Boolean(m) && !m.isBoss && !m.isElite)
    .map(m => getRegionMonster(m, region));
  const pool = normalPool.length > 0 ? normalPool : [firstMonster];
  const count = firstMonster.isBoss || firstMonster.isElite ? 1 : 2 + Math.floor(Math.random() * 6);
  const chain: Monster[] = [prepareMonsterForCombat(firstMonster)];
  for (let i = 1; i < count; i += 1) {
    const candidate = pool[Math.floor(Math.random() * pool.length)] || firstMonster;
    chain.push(prepareMonsterForCombat(candidate));
  }
  return chain;
};

const countIngredient = (inventory: GameItem[], name: string) =>
  inventory.reduce((sum, item) => sum + (item.name === name ? (item.stackCount ?? 1) : 0), 0);

const consumeIngredients = (inventory: GameItem[], ingredients: Array<{ name: string; count: number }>) => {
  let next = inventory.map(item => ({ ...item }));
  for (const ingredient of ingredients) {
    let remaining = ingredient.count;
    next = next.map(item => {
      if (remaining <= 0 || item.name !== ingredient.name) return item;
      const take = Math.min(item.stackCount ?? 1, remaining);
      remaining -= take;
      return { ...item, stackCount: (item.stackCount ?? 1) - take };
    }).filter(item => (item.stackCount ?? 1) > 0);
  }
  return next;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

const clampResistance = (value: number) => Math.max(-75, Math.min(85, value));

const getDamagePower = (damageType: import('../types/game').DamageType, stats: CombatStats) =>
  damageType === 'physical' ? stats.attack :
  damageType === 'true' ? Math.max(stats.attack, stats.magicAttack) :
  stats.magicAttack;

const getTargetResistance = (
  damageType: import('../types/game').DamageType,
  resistances: import('../types/game').ResistanceMap | Partial<import('../types/game').ResistanceMap> | undefined
) => {
  if (!resistances || damageType === 'true') return 0;
  return clampResistance(resistances[damageType as keyof import('../types/game').ResistanceMap] ?? 0);
};

const calculateTypedDamage = ({
  power,
  multiplier,
  damageType,
  targetDefense,
  targetMagicDefense,
  armorPenetration,
  targetResistances,
  extraDamageMultiplier = 1
}: {
  power: number;
  multiplier: number;
  damageType: import('../types/game').DamageType;
  targetDefense: number;
  targetMagicDefense: number;
  armorPenetration: number;
  targetResistances?: Partial<import('../types/game').ResistanceMap>;
  extraDamageMultiplier?: number;
}) => {
  if (damageType === 'true') {
    return Math.max(1, Math.round(power * multiplier * extraDamageMultiplier));
  }

  const raw = Math.max(1, power * multiplier);
  const defense = damageType === 'physical'
    ? Math.max(0, targetDefense - armorPenetration)
    : Math.max(0, targetMagicDefense);
  const mitigation = defense / (defense + (damageType === 'physical' ? 75 : 90));
  const resistance = getTargetResistance(damageType, targetResistances);
  return Math.max(
    1,
    Math.round(raw * (1 - mitigation) * (1 - resistance / 100) * extraDamageMultiplier)
  );
};

const addOrStackInventoryItem = (inventory: GameItem[], item: GameItem, maxSlots: number) => {
  const existingIndex = inventory.findIndex(i =>
    i.templateId === item.templateId &&
    i.type === item.type &&
    i.name === item.name &&
    i.rarity === item.rarity
  );

  const stackable = item.type === 'material' || item.type === 'ore' || item.type === 'potion';
  if (existingIndex >= 0 && stackable) {
    const next = [...inventory];
    next[existingIndex] = {
      ...next[existingIndex],
      stackCount: (next[existingIndex].stackCount || 1) + (item.stackCount || 1)
    };
    return { inventory: next, added: true };
  }

  if (inventory.length >= maxSlots) return { inventory, added: false };
  return { inventory: [...inventory, item], added: true };
};

const MINING_EXPEDITION_POOLS: Array<{
  name: string;
  icon: string;
  type: 'ore' | 'material';
  rarity: ItemRarity;
  minLevel: number;
  weight: number;
}> = [
  { name: 'Уголь', icon: '🪨', type: 'ore', rarity: 'common', minLevel: 1, weight: 18 },
  { name: 'Медная руда', icon: '🟤', type: 'ore', rarity: 'common', minLevel: 1, weight: 17 },
  { name: 'Железная руда', icon: '⚪', type: 'ore', rarity: 'common', minLevel: 5, weight: 15 },
  { name: 'Лечебная трава', icon: '🌿', type: 'material', rarity: 'common', minLevel: 1, weight: 11 },
  { name: 'Чистая вода', icon: '💧', type: 'material', rarity: 'common', minLevel: 1, weight: 10 },
  { name: 'Горный корень', icon: '🌱', type: 'material', rarity: 'uncommon', minLevel: 5, weight: 8 },
  { name: 'Серебряная руда', icon: '✨', type: 'ore', rarity: 'uncommon', minLevel: 15, weight: 8 },
  { name: 'Лунная пыльца', icon: '🌙', type: 'material', rarity: 'uncommon', minLevel: 15, weight: 6 },
  { name: 'Золотая руда', icon: '🪙', type: 'ore', rarity: 'rare', minLevel: 25, weight: 5 },
  { name: 'Сырой самоцвет', icon: '💎', type: 'material', rarity: 'rare', minLevel: 25, weight: 4 },
  { name: 'Мифриловая руда', icon: '💠', type: 'ore', rarity: 'rare', minLevel: 40, weight: 3 },
  { name: 'Магическая эссенция', icon: '🔮', type: 'material', rarity: 'rare', minLevel: 40, weight: 2 },
  { name: 'Адамантит', icon: '🟣', type: 'ore', rarity: 'epic', minLevel: 60, weight: 1.5 },
  { name: 'Кобальтовая руда', icon: '🔷', type: 'ore', rarity: 'rare', minLevel: 35, weight: 4 },
  { name: 'Кровавый обсидиан', icon: '🩸', type: 'ore', rarity: 'epic', minLevel: 72, weight: 1.2 },
  { name: 'Драконит', icon: '🔥', type: 'ore', rarity: 'ancient', minLevel: 85, weight: 0.5 },
  { name: 'Эфириум', icon: '🌌', type: 'ore', rarity: 'ancient', minLevel: 95, weight: 0.35 },
  { name: 'Арканная пыль', icon: '✨', type: 'material', rarity: 'rare', minLevel: 40, weight: 2.3 },
  { name: 'Руническое ядро', icon: '🧿', type: 'material', rarity: 'epic', minLevel: 60, weight: 0.8 },
  { name: 'Осколок драконьей чешуи', icon: '🐲', type: 'material', rarity: 'epic', minLevel: 85, weight: 0.7 },
  { name: 'Эфирная пыль', icon: '🌌', type: 'material', rarity: 'ancient', minLevel: 95, weight: 0.45 }
];

const MINING_BONUS_MATERIALS: Record<string, Array<{
  name: string;
  icon: string;
  rarity: ItemRarity;
  chance: number;
  minQty: number;
  maxQty: number;
}>> = {
  ore_coal: [
    { name: 'Каменная пыль', icon: '🌫️', rarity: 'common', chance: 0.32, minQty: 1, maxQty: 3 },
    { name: 'Кварц', icon: '🔹', rarity: 'common', chance: 0.18, minQty: 1, maxQty: 2 }
  ],
  ore_copper: [
    { name: 'Кварц', icon: '🔹', rarity: 'common', chance: 0.24, minQty: 1, maxQty: 2 },
    { name: 'Медный кристалл', icon: '🟠', rarity: 'uncommon', chance: 0.12, minQty: 1, maxQty: 1 }
  ],
  ore_iron: [
    { name: 'Соляной кристалл', icon: '🧂', rarity: 'common', chance: 0.25, minQty: 1, maxQty: 2 },
    { name: 'Магнетит', icon: '🧲', rarity: 'uncommon', chance: 0.13, minQty: 1, maxQty: 1 },
    { name: 'Железный пирит', icon: '🪨', rarity: 'uncommon', chance: 0.09, minQty: 1, maxQty: 2 }
  ],
  ore_silver: [
    { name: 'Осколок лунного камня', icon: '🌙', rarity: 'uncommon', chance: 0.22, minQty: 1, maxQty: 2 },
    { name: 'Лунная пыльца', icon: '✨', rarity: 'uncommon', chance: 0.10, minQty: 1, maxQty: 1 },
    { name: 'Серебряная нить', icon: '🧵', rarity: 'rare', chance: 0.08, minQty: 1, maxQty: 1 }
  ],
  ore_gold: [
    { name: 'Янтарный кристалл', icon: '🟡', rarity: 'uncommon', chance: 0.20, minQty: 1, maxQty: 2 },
    { name: 'Сырой самоцвет', icon: '💎', rarity: 'rare', chance: 0.10, minQty: 1, maxQty: 1 },
    { name: 'Золотая слюда', icon: '✨', rarity: 'rare', chance: 0.09, minQty: 1, maxQty: 1 }
  ],
  ore_cobalt: [
    { name: 'Синяя кристаллическая пыль', icon: '🔷', rarity: 'uncommon', chance: 0.24, minQty: 1, maxQty: 2 },
    { name: 'Рунический осколок', icon: '🔹', rarity: 'rare', chance: 0.11, minQty: 1, maxQty: 1 },
    { name: 'Кобальтовая призма', icon: '🔷', rarity: 'rare', chance: 0.09, minQty: 1, maxQty: 1 }
  ],
  ore_mithril: [
    { name: 'Арканная пыль', icon: '✨', rarity: 'rare', chance: 0.25, minQty: 1, maxQty: 2 },
    { name: 'Магическая эссенция', icon: '🔮', rarity: 'rare', chance: 0.10, minQty: 1, maxQty: 1 },
    { name: 'Мифриловый шёлк', icon: '🧵', rarity: 'epic', chance: 0.08, minQty: 1, maxQty: 1 }
  ],
  ore_adamantite: [
    { name: 'Руническое ядро', icon: '🧿', rarity: 'epic', chance: 0.18, minQty: 1, maxQty: 1 },
    { name: 'Осколок титана', icon: '🪨', rarity: 'rare', chance: 0.24, minQty: 1, maxQty: 2 },
    { name: 'Адамантовый зубец', icon: '🔩', rarity: 'epic', chance: 0.10, minQty: 1, maxQty: 1 }
  ],
  ore_blood_obsidian: [
    { name: 'Демонический уголь', icon: '🌋', rarity: 'epic', chance: 0.22, minQty: 1, maxQty: 1 },
    { name: 'Кровавый кристалл', icon: '🩸', rarity: 'epic', chance: 0.14, minQty: 1, maxQty: 1 },
    { name: 'Пепел Бездны', icon: '🌑', rarity: 'epic', chance: 0.11, minQty: 1, maxQty: 1 }
  ],
  ore_draconite: [
    { name: 'Осколок драконьей чешуи', icon: '🐲', rarity: 'epic', chance: 0.28, minQty: 1, maxQty: 2 },
    { name: 'Драконья искра', icon: '🔥', rarity: 'ancient', chance: 0.10, minQty: 1, maxQty: 1 },
    { name: 'Сердце драконида', icon: '🐉', rarity: 'mythic', chance: 0.08, minQty: 1, maxQty: 1 }
  ],
  ore_aetherium: [
    { name: 'Эфирная пыль', icon: '🌌', rarity: 'ancient', chance: 0.34, minQty: 1, maxQty: 2 },
    { name: 'Звёздное ядро', icon: '⭐', rarity: 'mythic', chance: 0.12, minQty: 1, maxQty: 1 },
    { name: 'Небесная слеза', icon: '💠', rarity: 'ancient', chance: 0.10, minQty: 1, maxQty: 1 },
    { name: 'Осколок вечности', icon: '🌠', rarity: 'divine', chance: 0.045, minQty: 1, maxQty: 1 }
  ]
};

const PET_CRAFT_RECIPES: Record<string, {
  miningLevelReq: number;
  ingredients: Array<{ name: string; count: number }>;
}> = {
  pet_dragon: {
    miningLevelReq: 85,
    ingredients: [
      { name: 'Драконит', count: 12 },
      { name: 'Осколок драконьей чешуи', count: 8 },
      { name: 'Драконья искра', count: 2 }
    ]
  },
  pet_fairy: {
    miningLevelReq: 40,
    ingredients: [
      { name: 'Мифриловая руда', count: 10 },
      { name: 'Арканная пыль', count: 8 },
      { name: 'Магическая эссенция', count: 4 }
    ]
  },
  pet_golem: {
    miningLevelReq: 60,
    ingredients: [
      { name: 'Адамантит', count: 10 },
      { name: 'Руническое ядро', count: 4 },
      { name: 'Осколок титана', count: 8 }
    ]
  },
  pet_voidling: {
    miningLevelReq: 95,
    ingredients: [
      { name: 'Эфириум', count: 10 },
      { name: 'Эфирная пыль', count: 12 },
      { name: 'Звёздное ядро', count: 3 }
    ]
  }
};

const generateMiningExpeditionRewards = (
  hours: number,
  miningLevel: number,
  premiumMultiplier = 1
): MiningExpeditionReward[] => {
  const available = MINING_EXPEDITION_POOLS.filter(entry => entry.minLevel <= Math.max(1, miningLevel));
  const rolls = hours >= 7 ? 9 : hours >= 3 ? 6 : 4;
  const qtyBase = Math.max(1, Math.round(hours * premiumMultiplier));
  const merged = new Map<string, MiningExpeditionReward>();

  for (let roll = 0; roll < rolls; roll += 1) {
    const rareBoost = hours >= 7 ? 1.8 : hours >= 3 ? 1.25 : 1;
    const weighted = available.map(entry => ({
      ...entry,
      adjustedWeight: entry.rarity === 'common' ? entry.weight : entry.weight * rareBoost
    }));
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.adjustedWeight, 0);
    let cursor = Math.random() * totalWeight;
    let picked = weighted[0];
    for (const entry of weighted) {
      cursor -= entry.adjustedWeight;
      if (cursor <= 0) {
        picked = entry;
        break;
      }
    }

    const rarityFactor =
      picked.rarity === 'common' ? 1 :
      picked.rarity === 'uncommon' ? 0.8 :
      picked.rarity === 'rare' ? 0.55 :
      picked.rarity === 'epic' ? 0.35 : 0.2;
    const count = Math.max(1, Math.round((qtyBase + Math.random() * (hours + 2)) * rarityFactor));
    const existing = merged.get(picked.name);
    if (existing) existing.count += count;
    else merged.set(picked.name, {
      name: picked.name,
      icon: picked.icon,
      type: picked.type,
      rarity: picked.rarity,
      count
    });
  }

  return [...merged.values()];
};

const addMiningRewardsToInventory = (
  inventory: GameItem[],
  rewards: MiningExpeditionReward[],
  maxSlots: number
): { inventory: GameItem[]; added: boolean } => {
  let next = inventory.map(item => ({ ...item }));
  for (const reward of rewards) {
    const item: GameItem = {
      id: 'expedition_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      templateId: 'expedition_' + reward.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_'),
      name: reward.name,
      type: reward.type,
      rarity: reward.rarity,
      level: 1,
      upgradeLevel: 0,
      icon: reward.icon,
      description: 'Добыто в шахтёрской экспедиции.',
      stats: {},
      sellPrice: Math.max(2, reward.count * 2),
      disassembleYield: reward.type === 'ore' ? { ore: 1 } : { silver: 2 },
      stackCount: reward.count
    };
    const added = addOrStackInventoryItem(next, item, maxSlots);
    if (!added.added) return { inventory, added: false };
    next = added.inventory;
  }
  return { inventory: next, added: true };
};

const isCurrentUserAdmin = () => {
  const adminTelegramId = import.meta.env.VITE_ADMIN_TELEGRAM_ID || '';
  return Boolean(adminTelegramId) && String(getTelegramUser().id) === String(adminTelegramId);
};

const SAVE_KEY = 'aethelgard_save_v1_data';
const ENERGY_COSTS = { travel: 10, dungeon: 15, combat: 2, upgrade: 4, inventory: 0, quest: 2 };

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerCharacter | null>(null);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [combatChain, setCombatChain] = useState<CombatChainState | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [combatRound, setCombatRound] = useState<number>(1);
  const [lastCombatReward, setLastCombatReward] = useState<{ gold: number; silver: number; exp: number; items: GameItem[] } | null>(null);
  const [pendingChainItems, setPendingChainItems] = useState<GameItem[]>([]);
  const [isInCombat, setIsInCombat] = useState<boolean>(false);
  const [isCombatEnded, setIsCombatEnded] = useState<boolean>(false);
  const [combatOutcome, setCombatOutcome] = useState<'victory' | 'defeat' | 'flee' | null>(null);
  const [combatPlayerHp, setCombatPlayerHp] = useState<number>(100);
  const [combatPlayerMp, setCombatPlayerMp] = useState<number>(50);
  const [turnPhase, setTurnPhase] = useState<'player' | 'monster' | 'ended'>('player');
  const [playerEffects, setPlayerEffects] = useState<StatusEffect[]>([]);
  const [monsterEffects, setMonsterEffects] = useState<StatusEffect[]>([]);
  const [monsterIntent, setMonsterIntent] = useState<MonsterSkill | null>(null);
  const [lastCast, setLastCast] = useState<{ id: string; turn: number } | null>(null);
  const [warriorMomentum, setWarriorMomentum] = useState(0);
  const [rogueFocus, setRogueFocus] = useState(false);
  const [activeDungeonRun, setActiveDungeonRun] = useState<DungeonRun | null>(null);
  useEffect(() => {
    if (!activeDungeonRun || combatOutcome !== 'victory' || !isCombatEnded) return;
    setActiveDungeonRun(run => run && (run.savedHp !== combatPlayerHp || run.savedMp !== combatPlayerMp)
      ? { ...run, savedHp: combatPlayerHp, savedMp: combatPlayerMp } : run);
  }, [activeDungeonRun, combatOutcome, isCombatEnded, combatPlayerHp, combatPlayerMp]);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlinePlayersCount, setOnlinePlayersCount] = useState<number>(142);
  const [offlineReport, setOfflineReport] = useState<{ minutes: number; gold: number; exp: number; kills: number; itemsCount: number; miningRewards?: MiningExpeditionReward[] } | null>(null);
  const [pendingOfflineMinutes, setPendingOfflineMinutes] = useState(0);
  const [premium, setPremium] = useState({
    active: false,
    premiumUntil: null as string | null,
    priceStars: 150,
    periodDays: 30,
    loading: true,
    invoiceLink: null as string | null
  });

  const [autoBattle, setAutoBattle] = useState<AutoBattleSettings>({
    enabled: false,
    healAtHpPercent: 40,
    useSkills: true,
    useUltimate: true,
    fleeAtHpPercent: 15,
    autoRebattle: true,
    maxBattles: 50
  });

  const [travelState, setTravelState] = useState<TravelState>({
    isTraveling: false,
    targetRegionId: '',
    targetRegionName: '',
    progress: 0,
    isAmbush: false,
    message: ''
  });

  const refreshPremiumStatus = useCallback(async () => {
    if (!player) return;
    setPremium(prev => ({ ...prev, loading: true }));
    try {
      const status = await apiRequest<{ active: boolean; premiumUntil: string | null; priceStars: number; periodDays: number }>('/api/premium/status');
      setPremium(prev => ({ ...prev, ...status, loading: false }));
    } catch {
      setPremium(prev => ({ ...prev, active: false, loading: false }));
    }
  }, [player?.userId]);

  useEffect(() => {
    if (!player) return;
    refreshPremiumStatus();
  }, [player?.userId, refreshPremiumStatus]);

  useEffect(() => {
    if (!premium.active) {
      setAutoBattle(prev => prev.enabled ? { ...prev, enabled: false } : prev);
    }
  }, [premium.active]);

  useEffect(() => {
    if (!player || premium.loading || pendingOfflineMinutes <= 0) return;

    const minutes = pendingOfflineMinutes;
    setPendingOfflineMinutes(0);

    // Automatic offline mining is a Premium-only benefit.
    if (!premium.active || minutes < 30) return;

    const hours = Math.max(1, Math.min(8, minutes / 60));
    const rewards = generateMiningExpeditionRewards(hours, player.miningLevel, 1.15);
    const added = addMiningRewardsToInventory(player.inventory, rewards, player.maxInventorySlots);
    if (!added.added) {
      setOfflineReport({
        minutes,
        gold: 0,
        exp: 0,
        kills: 0,
        itemsCount: 0,
        miningRewards: []
      });
      return;
    }

    const minedCount = rewards.reduce((sum, reward) => sum + reward.count, 0);
    setPlayer(prev => prev ? {
      ...prev,
      inventory: added.inventory,
      miningExp: prev.miningExp + Math.max(5, Math.round(hours * 12)),
      statsSummary: {
        ...prev.statsSummary,
        oresMined: prev.statsSummary.oresMined + minedCount
      }
    } : prev);

    setQuests(prev => prev.map(q => q.category === 'mining'
      ? { ...q, currentCount: Math.min(q.targetCount, q.currentCount + minedCount), completed: q.currentCount + minedCount >= q.targetCount }
      : q
    ));
    setAchievements(prev => prev.map(a => {
      if (a.id !== 'ach_4') return a;
      const progress = Math.min(a.maxProgress, a.progress + minedCount);
      return { ...a, progress, completed: progress >= a.maxProgress };
    }));

    setOfflineReport({
      minutes,
      gold: 0,
      exp: 0,
      kills: 0,
      itemsCount: rewards.length,
      miningRewards: rewards
    });
  }, [player?.id, premium.loading, premium.active, pendingOfflineMinutes]);

  const preparePremiumInvoice = useCallback(async (): Promise<string | null> => {
    if (premium.active) return null;
    try {
      const invoice = await apiRequest<{ invoiceLink?: string; alreadyActive?: boolean; premiumUntil?: string }>('/api/premium/invoice', {
        method: 'POST',
        body: '{}'
      });
      if (invoice.alreadyActive) {
        await refreshPremiumStatus();
        return null;
      }
      const link = invoice.invoiceLink || null;
      setPremium(prev => ({ ...prev, invoiceLink: link }));
      return link;
    } catch (error) {
      console.error('Premium invoice preparation failed:', error);
      setPremium(prev => ({ ...prev, invoiceLink: null }));
      throw error;
    }
  }, [premium.active, refreshPremiumStatus]);

  const purchasePremium = useCallback(async (preparedInvoiceLink?: string | null): Promise<{ success: boolean; message: string }> => {
    try {
      if (premium.active) return { success: true, message: 'Premium уже активен.' };

      const invoiceLink = preparedInvoiceLink || premium.invoiceLink || await preparePremiumInvoice();
      if (!invoiceLink) {
        return { success: false, message: 'Не удалось создать счёт Premium. Попробуйте ещё раз.' };
      }

      const tg = getTelegramWebApp();
      if (!tg?.openInvoice) {
        if (tg?.openTelegramLink) {
          tg.openTelegramLink(invoiceLink);
        } else {
          window.location.assign(invoiceLink);
        }
        return { success: true, message: 'Открываю оплату Telegram Stars…' };
      }

      const invoiceStatus = await new Promise<'paid' | 'cancelled' | 'failed' | 'pending'>((resolve) => {
        tg.openInvoice!(invoiceLink, resolve);
      });

      if (invoiceStatus !== 'paid') {
        return {
          success: false,
          message: invoiceStatus === 'cancelled' ? 'Оплата отменена.' : 'Оплата не завершена.'
        };
      }

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 450));
        try {
          const status = await apiRequest<{ active: boolean; premiumUntil: string | null; priceStars: number; periodDays: number }>('/api/premium/status');
          setPremium(prev => ({ ...prev, ...status, loading: false }));
          if (status.active) return { success: true, message: 'Premium активирован на 30 дней.' };
        } catch {}
      }

      return { success: true, message: 'Платёж принят. Premium появится после подтверждения Telegram.' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Не удалось открыть оплату Premium.' };
    }
  }, [premium.active, premium.invoiceLink, preparePremiumInvoice, refreshPremiumStatus]);

  const listMarketItem = useCallback(async (item: GameItem, quantity: number, priceGold: number) => {
    if (!player) return { success: false, message: 'Персонаж не создан.' };
    if (item.serverOwned) return { success: false, message: 'Серверные предметы пока нельзя выставить на старый рынок.' };
    if (item.isLocked || item.boundToClan) return { success: false, message: 'Запертый или клановый предмет нельзя выставить на рынок.' };
    if (!player.inventory.some(i => i.id === item.id && !i.isLocked && !i.boundToClan)) return { success: false, message: 'Предмета нет в инвентаре.' };
    const stack = item.stackCount || 1;
    if (quantity < 1 || quantity > stack) return { success: false, message: 'Недостаточное количество.' };
    try {
      await apiRequest('/api/market/list', { method: 'POST', body: JSON.stringify({ item, quantity, price_gold: priceGold }) });
      setPlayer(prev => {
        if (!prev) return prev;
        let left = quantity;
        const inventory = prev.inventory.map(i => {
          if (i.id !== item.id || left <= 0) return i;
          const take = Math.min(left, i.stackCount || 1); left -= take;
          return { ...i, stackCount: (i.stackCount || 1) - take };
        }).filter(i => (i.stackCount || 1) > 0);
        return { ...prev, inventory };
      });
      return { success: true, message: 'Лот выставлен на рынок.' };
    } catch (e) { return { success: false, message: e instanceof Error ? e.message : 'Не удалось выставить лот.' }; }
  }, [player]);

  const refreshMarketIncome = useCallback(async () => {
    if (!player) return;
    const userId = player.userId;
    const income = await apiRequest<{ totalGold: number }>('/api/market/income');
    setPlayer(prev => {
      if (!prev || prev.userId !== userId) return prev;
      const received = prev.marketIncomeReceived || 0;
      const delta = Math.max(0, income.totalGold - received);
      if (!delta) return prev;
      return { ...prev, gold: prev.gold + delta, marketIncomeReceived: income.totalGold };
    });
  }, [player?.userId]);

  const buyMarketListing = useCallback(async (listingId: string, expectedPriceGold?: number) => {
    if (!player) return { success: false, message: 'Персонаж не создан.' };
    if (expectedPriceGold !== undefined && player.gold < expectedPriceGold) return { success: false, message: 'Недостаточно золота.' };
    try {
      const result = await apiRequest<{ item: Partial<GameItem>; quantity: number; priceGold: number }>('/api/market/' + listingId + '/buy', { method: 'POST', body: '{}' });
      if (!player) return { success: false, message: 'Персонаж не создан.' };
      if (player.gold < result.priceGold) return { success: false, message: 'Недостаточно золота.' };
      const raw = result.item;
      const rawMarketItem: GameItem = {
        id: String(raw.id || 'market_' + Date.now()), templateId: String(raw.templateId || 'market_item'), name: String(raw.name || 'Предмет'),
        targetClass: raw.targetClass,
        type: (raw.type || 'material') as ItemType, rarity: (raw.rarity || 'common') as ItemRarity, level: Number(raw.level || 1),
        upgradeLevel: Number(raw.upgradeLevel || 0), icon: String(raw.icon || '📦'), description: raw.description,
        armorClass: raw.armorClass, weaponClass: raw.weaponClass,
        stats: raw.stats || {}, sellPrice: Number(raw.sellPrice || 1), disassembleYield: {}, stackCount: result.quantity
      };
      const item = applyClassGear(rawMarketItem);
      item.name = getLeveledEquipmentName(item.name, item.type, item.level, item.targetClass);
      const added = addOrStackInventoryItem(player.inventory, item, player.maxInventorySlots);
      if (!added.added) return { success: false, message: 'В инвентаре нет места.' };
      setPlayer(prev => prev ? { ...prev, gold: prev.gold - result.priceGold, inventory: added.inventory } : prev);
      return { success: true, message: 'Покупка завершена.' };
    } catch (e) { return { success: false, message: e instanceof Error ? e.message : 'Покупка не удалась.' }; }
  }, [player]);

  const buyBasicConsumable = useCallback((templateId: string, priceGold: number) => {
    if (!player || player.gold < priceGold) return false;
    const catalog: Record<string, GameItem> = {
      pot_hp_small: { id: 'shop_hp', templateId: 'pot_hp_small', name: 'Малое зелье исцеления', type: 'potion', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🧪', stats: { heal: 120 }, sellPrice: 10, disassembleYield: { silver: 4 }, stackCount: 1 },
      pot_mp_small: { id: 'shop_mp', templateId: 'pot_mp_small', name: 'Малое зелье маны', type: 'potion', rarity: 'common', level: 1, upgradeLevel: 0, icon: '💧', stats: { manaRestore: 80 }, sellPrice: 12, disassembleYield: { silver: 4 }, stackCount: 1 }
    };
    const item = catalog[templateId]; if (!item) return false;
    const added = addOrStackInventoryItem(player.inventory, item, player.maxInventorySlots);
    if (!added.added) return false;
    setPlayer(prev => prev ? { ...prev, gold: prev.gold - priceGold, inventory: added.inventory } : prev);
    return true;
  }, [player]);

  // Energy is intentionally scarce: active play is designed to last roughly 15 minutes.
  // Regeneration is deliberately slow: +1 energy every 120 seconds.
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayer(prev => {
        if (!prev) return prev;
        if (prev.energy >= prev.maxEnergy) return prev;
        return {
          ...prev,
          energy: Math.min(prev.maxEnergy, prev.energy + 1),
          lastEnergyRegenTimestamp: Date.now()
        };
      });
    }, 120000);
    return () => clearInterval(timer);
  }, []);

  // Separate mining energy regeneration (+1 every 10 seconds).
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayer(prev => {
        if (!prev || prev.stamina >= prev.maxStamina) return prev;
        return { ...prev, stamina: Math.min(prev.maxStamina, prev.stamina + 1) };
      });
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Separate alchemy energy regeneration (+1 every 20 seconds).
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayer(prev => {
        if (!prev || prev.alchemyEnergy >= prev.maxAlchemyEnergy) return prev;
        return { ...prev, alchemyEnergy: Math.min(prev.maxAlchemyEnergy, prev.alchemyEnergy + 1) };
      });
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  // Load saved state or check Telegram User
  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    const tgUser: TelegramUser = getTelegramUser();
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.player) {
          // Check offline time
          const now = Date.now();
          const elapsedMs = now - (parsed.player.lastActiveTimestamp || now);
          const elapsedMins = Math.floor(elapsedMs / (1000 * 60));
          
          if (elapsedMins >= 2) {
            setPendingOfflineMinutes(Math.min(elapsedMins, 480));
          }
          parsed.player.lastActiveTimestamp = now;

          // Migrate old saves to the two-currency economy.
          const legacyShards = Number(parsed.player.shards || 0);
          const legacyCrystals = Number(parsed.player.crystals || 0);
          parsed.player.silver = Number(parsed.player.silver || 0) + legacyShards * 10 + legacyCrystals * 40;
          delete parsed.player.shards;
          delete parsed.player.crystals;
          delete parsed.player.arcaneEnergy;

          const migrateSalvage = (item: any) => {
            if (!item) return item;
            if (!item.serverOwned) {
              item = applyClassGear(item);
              item.name = getLeveledEquipmentName(item.name, item.type, item.level || 1, item.targetClass);
            }
            const salvage = item.disassembleYield || {};
            const oldShards = Number(salvage.shards || 0);
            const oldCrystals = Number(salvage.crystals || 0);
            if (oldShards || oldCrystals) {
              item.disassembleYield = {
                ...salvage,
                silver: Number(salvage.silver || 0) + oldShards * 10 + oldCrystals * 40
              };
            }
            delete item.disassembleYield?.shards;
            delete item.disassembleYield?.crystals;
            return item;
          };
          parsed.player.inventory = (parsed.player.inventory || []).map(migrateSalvage);
          Object.keys(parsed.player.equipped || {}).forEach(key => {
            parsed.player.equipped[key] = migrateSalvage(parsed.player.equipped[key]);
          });

          parsed.player.silver = parsed.player.silver ?? 80;
          parsed.player.energy = parsed.player.energy ?? 60;
          parsed.player.maxEnergy = parsed.player.maxEnergy ?? 60;
          parsed.player.stamina = parsed.player.stamina ?? 100;
          parsed.player.maxStamina = parsed.player.maxStamina ?? 100;
          parsed.player.alchemyEnergy = parsed.player.alchemyEnergy ?? 100;
          parsed.player.maxAlchemyEnergy = parsed.player.maxAlchemyEnergy ?? 100;
          parsed.player.craftedPetIds = Array.isArray(parsed.player.craftedPetIds)
            ? parsed.player.craftedPetIds
            : [parsed.player.activePet?.id || 'pet_wolf'];
          parsed.player.lastMeditationTimestamp = Number(parsed.player.lastMeditationTimestamp || 0);
          const arenaDay = new Date().toISOString().slice(0, 10);
          if (!parsed.player.lastArenaTicketRefresh || parsed.player.lastArenaTicketRefresh !== arenaDay) {
            parsed.player.arenaTickets = 5;
            parsed.player.lastArenaTicketRefresh = arenaDay;
          }
          parsed.player.activeRegionModId = parsed.player.activeRegionModId || 'mod_standard';
          const savedRegion = REGIONS.find(region => region.id === parsed.player.currentRegionId);
          if (!savedRegion || parsed.player.level < savedRegion.minLevel) {
            parsed.player.currentRegionId = REGIONS[0].id;
            parsed.player.activeRegionModId = REGIONS[0].defaultModId;
          }
          // Migrate old saves to the current steep XP curve.
          parsed.player.nextExp = getNextExperience(parsed.player.level);
          parsed.player = addExperience(parsed.player, 0).player;

          setPlayer(CLASSES[parsed.player.classId as CharacterClassId]
            ? reconcileSkills(parsed.player, CLASSES[parsed.player.classId as CharacterClassId].startingSkills)
            : parsed.player);
          if (parsed.quests) {
            const savedQuestIds = new Set(parsed.quests.map((q: Quest) => q.id));
            const missingQuests = INITIAL_QUESTS.filter(q => !savedQuestIds.has(q.id));
            setQuests([...parsed.quests, ...missingQuests]);
          } else {
            setQuests(INITIAL_QUESTS);
          }
          if (parsed.achievements) setAchievements(parsed.achievements);
          if (parsed.chatMessages) setChatMessages(parsed.chatMessages);
          if (parsed.activeDungeonRun && !parsed.activeDungeonRun.completed) setActiveDungeonRun(parsed.activeDungeonRun);
          return;
        }
      } catch (err) {
        console.error('Failed to parse save data', err);
      }
    }

    // Default chat messages
    setChatMessages([
      { id: '1', sender: 'Система', isVip: true, text: 'Добро пожаловать в мрачные хроники Аэтельгарда. Королевство в огне.', channel: 'global', timestamp: '12:00' },
      { id: '2', sender: 'ТеневойРыцарь', clanTag: 'NEXUS', text: 'Кто на Королеву Мышей в пещеру? Собираю группу ур. 8+', channel: 'global', timestamp: '12:04' },
      { id: '3', sender: 'МагистрОгня', text: 'Заточил посох на +9 с первой попытки! Невероятно повезло.', channel: 'global', timestamp: '12:11' }
    ]);
  }, []);

  // Arena tickets return each UTC day, including while the game stays open.
  useEffect(() => {
    const refreshTickets = () => {
      const today = new Date().toISOString().slice(0, 10);
      setPlayer(prev => prev && prev.lastArenaTicketRefresh !== today
        ? { ...prev, arenaTickets: 5, lastArenaTicketRefresh: today }
        : prev);
    };
    const timer = setInterval(refreshTickets, 60000);
    return () => clearInterval(timer);
  }, []);

  // Keep the public leaderboard profile synchronized without sending every inventory/gold change.
  useEffect(() => {
    if (!player) return;
    apiRequest('/api/profile/sync', {
      method: 'POST',
      body: JSON.stringify({ level: player.level, arenaRating: player.arenaRating })
    }).catch(() => undefined);
  }, [player?.id, player?.level, player?.arenaRating]);

  // Periodic Save
  useEffect(() => {
    if (!player) return;
    const saveState = {
      player: { ...player, lastActiveTimestamp: Date.now() },
      quests,
      achievements,
      chatMessages: chatMessages.slice(-50),
      activeDungeonRun
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveState));
    localStorage.setItem('aethelgard_market_income_' + player.userId, String(player.marketIncomeReceived || 0));
  }, [player, quests, achievements, chatMessages, activeDungeonRun]);

  // Online count simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setOnlinePlayersCount(prev => Math.max(80, Math.min(300, prev + Math.floor(Math.random() * 5) - 2)));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Compute Total Combat Stats
  const combatStats: CombatStats = useMemo(() => {
    if (!player) {
      return {
        hp: 100, maxHp: 100, mp: 50, maxMp: 50, energy: 60, maxEnergy: 60, stamina: 100, maxStamina: 100,
        attack: 10, magicAttack: 5, defense: 5, magicDefense: 5, speed: 10, accuracy: 90, evasion: 5,
        critChance: 5, critDamage: 150, armorPenetration: 0, vampirism: 0, hpRegen: 2, mpRegen: 2,
        dropBonus: 0, goldBonus: 0, expBonus: 0,
        resistances: { physical: 0, magic: 0, fire: 0, ice: 0, lightning: 0, poison: 0, dark: 0, holy: 0 }
      };
    }

    const attrs = player.attributes;
    // Base stats derived from attributes
    let maxHp = 120 + attrs.vitality * 14 + player.level * 18;
    let maxMp = 60 + attrs.intelligence * 10 + attrs.spirit * 6 + player.level * 8;
    let attack = 8 + attrs.strength * 2.2 + Math.floor(attrs.agility * 0.8);
    let magicAttack = 5 + attrs.intelligence * 2.5 + Math.floor(attrs.spirit * 0.8);
    let defense = 4 + attrs.vitality * 1.5 + Math.floor(attrs.strength * 0.5);
    let magicDefense = 4 + attrs.spirit * 1.8 + Math.floor(attrs.intelligence * 0.6);
    let speed = 10 + attrs.agility * 1.2;
    let accuracy = 85 + attrs.agility * 0.8;
    let evasion = 5 + attrs.agility * 0.5;
    let critChance = 5 + attrs.agility * 0.4 + attrs.luck * 0.3;
    let critDamage = 150 + attrs.luck * 1.2;
    let armorPen = 0;
    let vampirism = 0;
    let hpRegen = 2 + Math.floor(attrs.willpower * 0.5);
    let mpRegen = 2 + Math.floor(attrs.spirit * 0.5);
    let dropBonus = attrs.luck * 0.8;
    let goldBonus = attrs.luck * 0.5;
    let expBonus = 0;
    const resistances: import('../types/game').ResistanceMap = {
      physical: 10, magic: 10, fire: 5, ice: 5, lightning: 5, poison: 5, dark: 5, holy: 5
    };

    // Class identity passives: every class has a meaningful combat specialty.
    switch (player.classId) {
      case 'warrior': defense *= 1.10; break;
      case 'berserker': attack *= 1.18; break;
      case 'knight': defense *= 1.15; magicDefense *= 1.15; Object.keys(resistances).forEach(k => resistances[k as keyof typeof resistances] += 10); break;
      case 'rogue': evasion += 8; critDamage += 10; break;
      case 'assassin': armorPen += 10; break;
      case 'archer': accuracy += 12; critChance += 6; armorPen += 10; break;
      case 'mage': magicAttack *= 1.15; mpRegen *= 1.20; break;
      case 'necromancer': vampirism += 8; break;
      case 'paladin': defense *= 1.10; hpRegen *= 1.12; resistances.dark += 15; break;
      case 'druid': hpRegen *= 1.10; mpRegen *= 1.10; resistances.poison += 20; break;
    }

    // Apply Equipped Items stats + sharpening (+1 to +25)
    Object.values(player.equipped).forEach(item => {
      if (!item) return;
        Object.entries(getEffectiveGearStats(item, player.classId)).forEach(([stat, val]) => {
          if (stat === 'attack') attack += val;
          else if (stat === 'magicAttack') magicAttack += val;
          else if (stat === 'defense') defense += val;
          else if (stat === 'magicDefense') magicDefense += val;
          else if (stat === 'maxHp') maxHp += val;
          else if (stat === 'maxMp') maxMp += val;
          else if (stat === 'speed') speed += val;
          else if (stat === 'critChance') critChance += val;
          else if (stat === 'critDamage') critDamage += val;
          else if (stat === 'vampirism') vampirism += val;
          else if (stat === 'accuracy') accuracy += val;
          else if (stat === 'evasion') evasion += val;
          else if (stat === 'hpRegen') hpRegen += val;
          else if (stat === 'mpRegen') mpRegen += val;
          else if (stat === 'armorPenetration') armorPen += val;
          else if (stat === 'physicalResistance') resistances.physical += val;
          else if (stat === 'magicResistance') resistances.magic += val;
          else if (stat === 'fireResistance') resistances.fire += val;
          else if (stat === 'iceResistance') resistances.ice += val;
          else if (stat === 'lightningResistance') resistances.lightning += val;
          else if (stat === 'poisonResistance') resistances.poison += val;
          else if (stat === 'darkResistance') resistances.dark += val;
          else if (stat === 'holyResistance') resistances.holy += val;
        });
    });

    // Apply Talents
    player.talents.forEach(talent => {
      if (talent.currentRank > 0 && talent.effect) {
        const val = talent.effect.valuePerRank * talent.currentRank;
        if (talent.effect.stat === 'vitality') maxHp += val * 14;
        else if (talent.effect.stat === 'strength') attack += val * 2.2;
        else if (talent.effect.stat === 'agility') speed += val;
        else if (talent.effect.stat === 'intelligence') magicAttack += val * 2.5;
        else if (talent.effect.stat === 'critChance') critChance += val;
        else if (talent.effect.stat === 'critDamage') critDamage += val;
        else if (talent.effect.stat === 'vampirism') vampirism += val;
        else if (talent.effect.stat === 'hpRegen') hpRegen += val;
        else if (talent.effect.stat === 'mpRegen') mpRegen += val;
        else if (talent.effect.stat === 'defense') defense = Math.round(defense * (1 + val / 100));
        else if (talent.effect.stat === 'magicAttack') magicAttack = Math.round(magicAttack * (1 + val / 100));
      }
    });

    // Claimed achievements grant the permanent bonuses described in the UI.
    const claimedAchievementIds = new Set(achievements.filter(a => a.claimed).map(a => a.id));
    if (claimedAchievementIds.has('ach_1')) attack *= 1.02;
    if (claimedAchievementIds.has('ach_2')) expBonus += 5;
    if (claimedAchievementIds.has('ach_3')) dropBonus += 5;

    // Apply Active Pet
    if (player.activePet && player.activePet.stats) {
      if (player.activePet.stats.attack) attack += player.activePet.stats.attack;
      if (player.activePet.stats.magicAttack) magicAttack += player.activePet.stats.magicAttack;
      if (player.activePet.stats.critChance) critChance += player.activePet.stats.critChance;
      if (player.activePet.stats.hpRegen) hpRegen += player.activePet.stats.hpRegen;
      if (player.activePet.stats.mpRegen) mpRegen += player.activePet.stats.mpRegen;
    }

    if (activeDungeonRun?.temporaryBlessing && activeDungeonRun.temporaryBlessing.remainingBattles > 0) {
      attack *= 1.1;
      magicAttack *= 1.1;
      defense *= 1.1;
      magicDefense *= 1.1;
    }

    return {
      hp: maxHp,
      maxHp: Math.round(maxHp),
      mp: maxMp,
      maxMp: Math.round(maxMp),
      energy: player?.energy ?? 100,
      maxEnergy: player?.maxEnergy ?? 100,
      stamina: player?.stamina ?? 100,
      maxStamina: player?.maxStamina ?? 100,
      attack: Math.round(attack),
      magicAttack: Math.round(magicAttack),
      defense: Math.round(defense),
      magicDefense: Math.round(magicDefense),
      speed: Math.round(speed),
      accuracy: Math.round(accuracy),
      evasion: Math.round(evasion),
      critChance: Math.min(75, Math.round(critChance)),
      critDamage: Math.round(critDamage),
      armorPenetration: Math.round(armorPen),
      vampirism: Math.round(vampirism),
      hpRegen: Math.round(hpRegen),
      mpRegen: Math.round(mpRegen),
      dropBonus: Math.round(dropBonus),
      goldBonus: Math.round(goldBonus),
      expBonus: Math.round(expBonus),
      resistances
    };
  }, [player, achievements, activeDungeonRun?.temporaryBlessing]);

  // Character Creation
  const createCharacter = useCallback((name: string, classId: CharacterClassId) => {
    const classDef = CLASSES[classId];
    const starterGear = STARTER_ITEMS[classId] || [];
    const equipped: Partial<Record<ItemType, GameItem>> = {};
    const inventory: GameItem[] = [];

    // Equip primary weapon and armor, put others in bag
    starterGear.forEach((starterItem, index) => {
      const item = applyClassGear(starterItem, classId);
      item.name = getLeveledEquipmentName(item.name, item.type, item.level, item.targetClass);
      if (index === 0 && (item.type === 'weapon')) {
        equipped[item.type] = { ...item, isEquipped: true };
      } else if (item.type === 'armor' && !equipped.armor) {
        equipped[item.type] = { ...item, isEquipped: true };
      } else {
        inventory.push({ ...item, isEquipped: false });
      }
    });

    if (!equipped.armor) {
      const armor = applyClassGear({
        id: 'starter_armor_' + Date.now(), templateId: 'starter_armor_' + classId,
        name: 'Стартовый нагрудник', type: 'armor', rarity: 'common', level: 1,
        upgradeLevel: 0, icon: '🥋', stats: { defense: 4, magicDefense: 3, maxHp: 12 },
        sellPrice: 20, disassembleYield: { silver: 4 }, isEquipped: true
      }, classId);
      armor.name = getLeveledEquipmentName(armor.name, armor.type, armor.level, armor.targetClass);
      equipped.armor = armor;
    }

    // Starter alchemy materials for the first recipes.
    [
      { templateId: 'mat_healing_herb', name: 'Лечебная трава', count: 6, rarity: 'common' as const },
      { templateId: 'mat_clean_water', name: 'Чистая вода', count: 5, rarity: 'common' as const },
      { templateId: 'mat_moon_pollen', name: 'Лунная пыльца', count: 2, rarity: 'uncommon' as const }
    ].forEach(mat => {
      inventory.push({
        id: mat.templateId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        templateId: mat.templateId,
        name: mat.name,
        type: 'material',
        rarity: mat.rarity,
        level: 1,
        upgradeLevel: 0,
        icon: '🧩',
        description: 'Ингредиент для алхимии.',
        stats: {},
        sellPrice: 2,
        disassembleYield: {},
        stackCount: mat.count
      });
    });

    // Starter mining ores: basic alchemy is usable immediately, while the same ores remain needed for sharpening.
    [
      { templateId: 'ore_coal', name: 'Уголь', count: 2, icon: '🪨' },
      { templateId: 'ore_copper', name: 'Медная руда', count: 2, icon: '🟤' }
    ].forEach(ore => {
      inventory.push({
        id: ore.templateId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        templateId: ore.templateId,
        name: ore.name,
        type: 'ore',
        rarity: 'common',
        level: 1,
        upgradeLevel: 0,
        icon: ore.icon,
        description: 'Базовая руда для алхимии и заточки.',
        stats: {},
        sellPrice: 3,
        disassembleYield: { ore: 1 },
        stackCount: ore.count
      });
    });

    // Add starter potions
    inventory.push({
      id: 'pot_start_1',
      templateId: 'pot_hp_small',
      name: 'Малое зелье исцеления',
      type: 'potion',
      rarity: 'common',
      level: 1,
      upgradeLevel: 0,
      icon: '🧪',
      description: 'Восстанавливает 120 HP в бою.',
      stats: { heal: 120 },
      sellPrice: 10,
      disassembleYield: { silver: 4 },
      stackCount: 5
    });

    const newPlayer: PlayerCharacter = {
      id: 'char_' + Date.now(),
      userId: String(getTelegramUser().id),
      marketIncomeReceived: Number(localStorage.getItem('aethelgard_market_income_' + getTelegramUser().id) || 0),
      name: name.trim() || 'Теневой Воин',
      classId,
      level: 1,
      exp: 0,
      nextExp: getNextExperience(1),
      statPoints: 5,
      talentPoints: 1,
      gold: 120,
      silver: 80,
      energy: 60,
      maxEnergy: 60,
      lastEnergyRegenTimestamp: Date.now(),
      lastMeditationTimestamp: 0,
      stamina: 100,
      maxStamina: 100,
      attributes: { ...classDef.baseAttributes },
      equipped,
      inventory,
      maxInventorySlots: 40,
      talents: classDef.talents.map(t => ({ ...t })),
      skills: classDef.startingSkills.map(s => ({ ...s })),
      activePet: PETS_LIST[0],
      craftedPetIds: ['pet_wolf'],
      miningLevel: 1,
      miningExp: 0,
      alchemyLevel: 1,
      alchemyExp: 0,
      alchemyEnergy: 100,
      maxAlchemyEnergy: 100,
      arenaRating: 1000,
      arenaTickets: 5,
      lastArenaTicketRefresh: new Date().toISOString().slice(0, 10),
      arenaLeague: 'Бронза',
      clanId: undefined,
      statsSummary: {
        monstersKilled: 0,
        bossesDefeated: 0,
        battlesWon: 0,
        battlesLost: 0,
        totalDamageDealt: 0,
        highestCrit: 0,
        oresMined: 0,
        potionsCrafted: 0,
        itemsUpgraded: 0,
        maxUpgradeReached: 0,
        dungeonsCleared: 0
      },
      lastActiveTimestamp: Date.now(),
      currentRegionId: 'reg_plains',
      activeRegionModId: 'mod_standard'
    };

    setPlayer(reconcileSkills(newPlayer, classDef.startingSkills));
    sound.playLevelUp();
    triggerHaptic('success');
  }, []);

  const resetCharacter = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    setPlayer(null);
    setIsInCombat(false);
    setActiveMonster(null);
  }, []);

  const setActivePet = useCallback((petId: string): boolean => {
    const pet = PETS_LIST.find(p => p.id === petId);
    if (!pet || !player) return false;
    if (!(player.craftedPetIds || ['pet_wolf']).includes(petId)) {
      triggerHaptic('error');
      return false;
    }
    if (player.activePet?.id === pet.id) return true;
    setPlayer(prev => prev ? { ...prev, activePet: pet } : prev);
    sound.playClick();
    triggerHaptic('success');
    return true;
  }, [player]);

  const craftPet = useCallback((petId: string): { success: boolean; message: string } => {
    if (!player) return { success: false, message: 'Персонаж не найден.' };
    const pet = PETS_LIST.find(p => p.id === petId);
    const recipe = PET_CRAFT_RECIPES[petId];
    if (!pet || !recipe) return { success: false, message: 'Для этого питомца нет рецепта.' };
    if ((player.craftedPetIds || []).includes(petId)) return { success: false, message: 'Этот питомец уже создан.' };
    if (player.miningLevel < recipe.miningLevelReq) {
      return { success: false, message: `Нужен ${recipe.miningLevelReq} уровень горного дела.` };
    }

    for (const ingredient of recipe.ingredients) {
      const have = player.inventory.reduce((sum, item) =>
        sum + (item.name === ingredient.name ? (item.stackCount || 1) : 0), 0);
      if (have < ingredient.count) {
        return { success: false, message: `Не хватает: ${ingredient.name} ×${ingredient.count}. Есть: ${have}.` };
      }
    }

    let inventory = player.inventory.map(item => ({ ...item }));
    for (const ingredient of recipe.ingredients) {
      let remaining = ingredient.count;
      inventory = inventory.map(item => {
        if (remaining <= 0 || item.name !== ingredient.name) return item;
        const stack = item.stackCount || 1;
        const take = Math.min(stack, remaining);
        remaining -= take;
        return { ...item, stackCount: stack - take };
      }).filter(item => (item.stackCount || 0) > 0);
    }

    setPlayer(prev => prev ? {
      ...prev,
      inventory,
      craftedPetIds: [...new Set([...(prev.craftedPetIds || ['pet_wolf']), petId])],
      activePet: pet
    } : prev);
    sound.playUpgradeSuccess();
    triggerHaptic('success');
    return { success: true, message: `${pet.name} создан и сразу выбран активным питомцем.` };
  }, [player]);

  const allocateAttribute = useCallback((attr: keyof PlayerCharacter['attributes']) => {
    setPlayer(prev => {
      if (!prev || prev.statPoints <= 0) return prev;
      sound.playClick();
      triggerHaptic('light');
      return reconcileSkills({
        ...prev,
        statPoints: prev.statPoints - 1,
        attributes: {
          ...prev.attributes,
          [attr]: prev.attributes[attr] + 1
        }
      }, CLASSES[prev.classId].startingSkills);
    });
  }, []);

  const unlockTalent = useCallback((talentId: string) => {
    setPlayer(prev => {
      if (!prev || prev.talentPoints <= 0) return prev;
      const updatedTalents = prev.talents.map(t => {
        if (t.id === talentId && t.currentRank < t.maxRank) {
          sound.playUpgradeSuccess();
          triggerHaptic('medium');
          return { ...t, currentRank: t.currentRank + 1 };
        }
        return t;
      });
      return {
        ...prev,
        talentPoints: prev.talentPoints - 1,
        talents: updatedTalents
      };
    });
  }, []);

  const refreshServerInventory = useCallback(async () => {
    const response = await apiRequest<{ items: Array<{ id: string; item_json: GameItem; quantity: number; locked: boolean; bound_clan_id: string | null; equipped_slot: ItemType | null }> }>('/api/items/owned');
    const canonical = response.items.map(row => ({
      ...row.item_json, id: row.id, stackCount: row.quantity, isLocked: row.locked,
      name: getLeveledEquipmentName(row.item_json.name, row.item_json.type, row.item_json.level, row.item_json.targetClass),
      boundToClan: row.bound_clan_id || undefined, serverOwned: true,
      isEquipped: Boolean(row.equipped_slot), slot: row.equipped_slot
    }));
    setPlayer(prev => {
      if (!prev) return prev;
      const inventory = prev.inventory.filter(item => !item.serverOwned);
      const equipped = { ...prev.equipped };
      for (const [slot, item] of Object.entries(equipped)) if (item?.serverOwned) delete equipped[slot as ItemType];
      for (const item of canonical) {
        if (item.slot) {
          if (equipped[item.slot]) inventory.push({ ...equipped[item.slot]!, isEquipped: false });
          equipped[item.slot] = item;
        } else inventory.push(item);
      }
      return { ...prev, inventory, equipped };
    });
  }, []);

  useEffect(() => {
    if (!player?.userId) return;
    refreshServerInventory().catch(() => undefined);
  }, [player?.userId, refreshServerInventory]);

  // Equipment & Inventory management
  const equipItem = useCallback((item: GameItem) => {
    if (item.serverOwned) {
      if (!player || item.level > player.level) return;
      apiRequest('/api/items/' + encodeURIComponent(item.id) + '/equip', { method: 'POST', body: '{}' })
        .then(() => refreshServerInventory()).catch(error => console.error('Could not equip item:', error));
      return;
    }
    setPlayer(prev => {
      if (prev && prev.energy < ENERGY_COSTS.inventory) { triggerHaptic('error'); return prev; }
      if (!prev || item.isEquipped || item.level > prev.level) return prev;
      sound.playClick();
      triggerHaptic('medium');

      const currentEquipped = prev.equipped[item.type];
      const newInventory = prev.inventory.filter(i => i.id !== item.id);
      if (currentEquipped) {
        newInventory.push({ ...currentEquipped, isEquipped: false });
      }

      return {
        ...prev,
        equipped: {
          ...prev.equipped,
          [item.type]: { ...item, isEquipped: true }
        },
        inventory: newInventory,
        energy: Math.max(0, prev.energy - ENERGY_COSTS.inventory)
      };
    });
  }, [player, refreshServerInventory]);

  const unequipItem = useCallback((type: ItemType) => {
    const equippedItem = player?.equipped[type];
    if (equippedItem?.serverOwned) {
      apiRequest('/api/items/' + encodeURIComponent(equippedItem.id) + '/unequip', { method: 'POST', body: '{}' })
        .then(() => refreshServerInventory()).catch(error => console.error('Could not unequip item:', error));
      return;
    }
    setPlayer(prev => {
      if (!prev) return prev;
      if (prev.energy < ENERGY_COSTS.inventory) { triggerHaptic('error'); return prev; }
      const currentEquipped = prev.equipped[type];
      if (!currentEquipped) return prev;
      if (prev.inventory.length >= prev.maxInventorySlots) {
        triggerHaptic('error');
        return prev;
      }
      sound.playClick();
      triggerHaptic('light');
      const updatedEquipped = { ...prev.equipped };
      delete updatedEquipped[type];

      return {
        ...prev,
        equipped: updatedEquipped,
        inventory: [...prev.inventory, { ...currentEquipped, isEquipped: false }],
        energy: Math.max(0, prev.energy - ENERGY_COSTS.inventory)
      };
    });
  }, [player, refreshServerInventory]);

  const sellItem = useCallback((item: GameItem) => {
    if (item.serverOwned) {
      apiRequest<{ gold: number }>('/api/items/' + encodeURIComponent(item.id) + '/dispose', { method: 'POST', body: JSON.stringify({ action: 'sell' }) })
        .then(async result => { setPlayer(prev => prev ? { ...prev, gold: prev.gold + result.gold } : prev); await refreshServerInventory(); })
        .catch(error => console.error('Could not sell item:', error));
      return;
    }
    setPlayer(prev => {
      if (!prev || item.isEquipped || prev.inventory.find(i => i.id === item.id)?.isLocked) return prev;
      if (prev.energy < ENERGY_COSTS.inventory) { triggerHaptic('error'); return prev; }
      sound.playClick();
      triggerHaptic('light');
      const goldGain = item.sellPrice || 10;
      return {
        ...prev,
        gold: prev.gold + goldGain,
        inventory: prev.inventory.filter(i => i.id !== item.id),
        energy: Math.max(0, prev.energy - ENERGY_COSTS.inventory)
      };
    });
  }, [refreshServerInventory]);

  const disassembleItem = useCallback((item: GameItem) => {
    if (item.serverOwned) {
      apiRequest<{ silver: number; ore: number }>('/api/items/' + encodeURIComponent(item.id) + '/dispose', { method: 'POST', body: JSON.stringify({ action: 'disassemble' }) })
        .then(async result => {
          setPlayer(prev => {
            if (!prev) return prev;
            const material: GameItem = { id: crypto.randomUUID(), templateId:'iron_ore', name:'Железная руда', type:'ore', rarity:'common', level:1, upgradeLevel:0, icon:'⚪', stats:{}, sellPrice:12, disassembleYield:{ore:1}, stackCount:result.ore };
            const inventory = result.ore > 0 ? addOrStackInventoryItem(prev.inventory, material, prev.maxInventorySlots).inventory : prev.inventory;
            return { ...prev, inventory, silver: prev.silver + result.silver };
          });
          await refreshServerInventory();
        }).catch(error => console.error('Could not disassemble item:', error));
      return;
    }
    setPlayer(prev => {
      if (!prev || item.isEquipped || prev.inventory.find(i => i.id === item.id)?.isLocked) return prev;
      if (prev.energy < ENERGY_COSTS.inventory) { triggerHaptic('error'); return prev; }
      sound.playMining();
      triggerHaptic('medium');

      let inventory = prev.inventory.filter(i => i.id !== item.id);
      const add = (material: GameItem) => {
        inventory = addOrStackInventoryItem(inventory, material, prev.maxInventorySlots).inventory;
      };

      const salvageSilver = item.disassembleYield?.silver || 0;
      const ore = item.disassembleYield?.ore || 0;

      if (ore > 0) {
        add({
          id: 'mat_iron_ore_' + Date.now(),
          templateId: 'iron_ore',
          name: 'Железная руда',
          type: 'ore',
          rarity: 'common',
          level: 1,
          upgradeLevel: 0,
          icon: '⚪',
          description: 'Руда, полученная разбором снаряжения.',
          stats: {},
          sellPrice: 12,
          disassembleYield: { ore: 1 },
          stackCount: ore
        });
      }

      return {
        ...prev,
        inventory,
        energy: Math.max(0, prev.energy - ENERGY_COSTS.inventory),
        silver: prev.silver + salvageSilver
      };
    });
  }, [refreshServerInventory]);

  const toggleItemLock = useCallback((itemId: string) => {
    if (player?.inventory.some(i => i.id === itemId && i.serverOwned) || Object.values(player?.equipped || {}).some(i => i?.id === itemId && i.serverOwned)) {
      apiRequest('/api/items/' + encodeURIComponent(itemId) + '/lock', { method: 'POST', body: '{}' })
        .then(() => refreshServerInventory()).catch(error => console.error('Could not lock item:', error));
      return;
    }
    setPlayer(prev => prev ? {
      ...prev,
      inventory: prev.inventory.map(i => i.id === itemId ? { ...i, isLocked: !i.isLocked } : i),
      equipped: Object.fromEntries(Object.entries(prev.equipped).map(([slot, i]) => [slot, i?.id === itemId ? { ...i, isLocked: !i.isLocked } : i]))
    } : prev);
  }, [player]);

  const expandInventory = useCallback(() => {
    setPlayer(prev => {
      if (!prev) return prev;
      // Inventory expansion is a Premium-only benefit. Keep the check in the
      // game context as the source of truth so it cannot be bypassed by a UI
      // click or another caller.
      if (!premium.active) {
        triggerHaptic('error');
        return prev;
      }
      const cost = prev.maxInventorySlots * 60;
      if (prev.gold < cost) {
        triggerHaptic('error');
        return prev;
      }
      sound.playUpgradeSuccess();
      triggerHaptic('success');
      return {
        ...prev,
        gold: prev.gold - cost,
        maxInventorySlots: prev.maxInventorySlots + 5
      };
    });
  }, [premium.active]);

  // Blacksmith sharpening
  const upgradeItem = useCallback((item: GameItem, useProtection: boolean): { success: boolean; message: string } => {
    if (!player) return { success: false, message: 'Персонаж не найден.' };
    if (item.serverOwned) return { success: false, message: 'Заточка серверного предмета появится после переноса руды и кошелька на сервер.' };

    if (player.energy < ENERGY_COSTS.upgrade) return { success: false, message: `Недостаточно энергии (нужно ${ENERGY_COSTS.upgrade}).` };
    const currentLevel = item.upgradeLevel || 0;
    if (currentLevel >= 25) {
      return { success: false, message: 'Предмет достиг максимального уровня заточки (+25)!' };
    }

    const costGold = Math.round(120 * Math.pow(1.48, currentLevel));
    const costSilver = Math.round(80 * Math.pow(1.42, currentLevel));
    const protectionCost = useProtection ? Math.max(250, Math.round(costSilver * 1.5)) : 0;
    const requirements = getUpgradeRequirements(item, currentLevel);
    const ingredients = [
      { name: requirements.ore, count: requirements.oreCount },
      { name: requirements.trophy, count: requirements.trophyCount },
      ...(requirements.catalyst ? [{ name: requirements.catalyst, count: requirements.catalystCount }] : [])
    ];
    if (player.gold < costGold) {
      return { success: false, message: `Недостаточно золота (нужно ${costGold} 🪙)!` };
    }
    if (player.silver < costSilver + protectionCost) {
      return { success: false, message: `Недостаточно серебра (нужно ${costSilver + protectionCost} 🥈${useProtection ? ' с защитой' : ''})!` };
    }
    const missing = ingredients.find(ingredient => countIngredient(player.inventory, ingredient.name) < ingredient.count);
    if (missing) {
      return { success: false, message: `Нужно: ${missing.name} ×${missing.count}. Есть: ${countIngredient(player.inventory, missing.name)}.` };
    }

    let successRate = 1;
    if (currentLevel === 1) successRate = 0.90;
    else if (currentLevel === 2) successRate = 0.82;
    else if (currentLevel === 3) successRate = 0.74;
    else if (currentLevel === 4) successRate = 0.66;
    else if (currentLevel === 5) successRate = 0.58;
    else if (currentLevel === 6) successRate = 0.50;
    else if (currentLevel === 7) successRate = 0.43;
    else if (currentLevel === 8) successRate = 0.36;
    else if (currentLevel === 9) successRate = 0.30;
    else if (currentLevel >= 10 && currentLevel < 15) successRate = 0.22;
    else if (currentLevel >= 15 && currentLevel < 20) successRate = 0.14;
    else if (currentLevel >= 20) successRate = 0.07;

    if (achievements.some(a => a.id === 'ach_5' && a.claimed)) successRate = Math.min(0.98, successRate + 0.03);
    const isSuccess = Math.random() <= successRate;
    const newLevel = isSuccess || useProtection ? currentLevel + (isSuccess ? 1 : 0) : Math.max(0, currentLevel - 1);

    const updateItem = (i: GameItem) =>
      i.id === item.id ? { ...i, upgradeLevel: newLevel } : i;

    setPlayer(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        energy: Math.max(0, prev.energy - ENERGY_COSTS.upgrade),
        gold: prev.gold - costGold,
        silver: prev.silver - costSilver - protectionCost,
        equipped: Object.fromEntries(
          Object.entries(prev.equipped).map(([k, v]) => [k, v ? updateItem(v) : v])
        ) as Partial<Record<ItemType, GameItem>>,
        inventory: consumeIngredients(prev.inventory.map(updateItem), ingredients),
        statsSummary: isSuccess
          ? {
              ...prev.statsSummary,
              itemsUpgraded: prev.statsSummary.itemsUpgraded + 1,
              maxUpgradeReached: Math.max(prev.statsSummary.maxUpgradeReached, currentLevel + 1)
            }
          : prev.statsSummary
      };
    });

    if (isSuccess) {
      sound.playUpgradeSuccess();
      triggerHaptic('success');
      return { success: true, message: `Успех! ${item.name} заточен до +${currentLevel + 1}. Потрачено: ${ingredients.map(i => `${i.name} ×${i.count}`).join(', ')}, ${costGold} 🪙 и ${costSilver + protectionCost} 🥈${useProtection ? ' (с защитой)' : ''}.` };
    }

    sound.playUpgradeFail();
    triggerHaptic('warning');
    return {
      success: false,
      message: useProtection
        ? `Провал заточки! Уровень сохранён на +${currentLevel}.`
        : `Провал заточки! Уровень снижен до +${newLevel}.`
    };
  }, [player]);

  const setActiveRegionMod = useCallback((modId: string) => {
    setPlayer(prev => prev ? { ...prev, activeRegionModId: modId } : prev);
    triggerHaptic('light');
    sound.playClick();
  }, []);

  const meditateOrRefillEnergy = useCallback((mode: 'meditate' | 'silver' | 'potion') => {
    const now = Date.now();
    setPlayer(prev => {
      if (!prev) return prev;
      if (mode === 'meditate') {
        const cooldownMs = 30 * 60_000;
        const lastMeditation = prev.lastMeditationTimestamp || 0;
        if (now - lastMeditation < cooldownMs || prev.energy >= prev.maxEnergy) {
          triggerHaptic('error');
          return prev;
        }
        sound.playEnergyRefill();
        triggerHaptic('medium');
        return {
          ...prev,
          energy: Math.min(prev.maxEnergy, prev.energy + 10),
          lastMeditationTimestamp: now
        };
      } else if (mode === 'silver') {
        const price = getEnergyElixirPrice(premium.active);
        if (prev.silver < price || prev.energy >= prev.maxEnergy) {
          triggerHaptic('error');
          sound.playUpgradeFail();
          return prev;
        }
        sound.playCoinDrop();
        sound.playEnergyRefill();
        triggerHaptic('success');
        return {
          ...prev,
          silver: prev.silver - price,
          energy: Math.min(prev.maxEnergy, prev.energy + 30)
        };
      }
      return prev;
    });
  }, [premium.active]);

  // START BATTLE with Energy Check
  const startBattleWithMonster = useCallback((monster: Monster, options?: { chain?: boolean; energyCost?: number }): boolean => {
    const activeModId = player?.activeRegionModId || 'mod_standard';
    const activeMod = REGION_MODIFIERS[activeModId] || REGION_MODIFIERS.mod_standard;
    const energyCost = options?.energyCost ?? ENERGY_COSTS.combat;
    if (player?.miningExpedition && !premium.active) {
      sound.playUpgradeFail();
      triggerHaptic('error');
      return false;
    }
    const useChain = options?.chain !== false;

    if (player && player.energy < energyCost) {
      sound.playUpgradeFail();
      triggerHaptic('error');
      return false;
    }
    if (isInCombat && !isCombatEnded) return false;

    const chain = useChain && player ? buildCombatChain(monster, player, combatStats, monster.regionId || player.currentRegionId) : [prepareMonsterForCombat(monster)];

    setPlayer(prev => prev ? {
      ...prev,
      energy: Math.max(0, prev.energy - energyCost),
      skills: prev.skills.map(skill => ({ ...skill, currentCooldown: 0 }))
    } : prev);

    setCombatChain(useChain && player ? { total: chain.length, defeated: 0, queue: chain.slice(1) } : null);
    setActiveMonster({ ...chain[0], hp: chain[0].maxHp });
    const dungeonFight = !useChain && !!activeDungeonRun && energyCost === 0;
    setCombatPlayerHp(dungeonFight ? Math.max(1, activeDungeonRun.savedHp ?? combatStats.maxHp) : combatStats.maxHp);
    setCombatPlayerMp(dungeonFight ? Math.max(0, activeDungeonRun.savedMp ?? combatStats.maxMp) : combatStats.maxMp);
    setLastCast(null);
    setWarriorMomentum(0);
    setRogueFocus(false);
    setTurnPhase('player');
    setIsInCombat(true);
    setIsCombatEnded(false);
    setCombatOutcome(null);
    setMonsterIntent(null);
    setPlayerEffects([]);
    setMonsterEffects([]);
    setCombatRound(1);
    setLastCast(null);
    setLastCombatReward(null);
    setPendingChainItems([]);
    setBattleLog([
      {
        id: 'start_' + Date.now(),
        turn: 1,
        text: `⚔️ В бой вступает ${chain[0].name} (Ур. ${chain[0].level})! Серия: ${chain.length} противников. Режим: [${activeMod.name}]. Затрачено ${energyCost} ⚡.`,
        type: 'system'
      },
      ...(chain.length > 1 ? [{
        id: 'chain_' + Date.now(),
        turn: 1,
        text: `☠️ В этой вылазке ${chain.length} противников. После каждой победы можно продолжить без выхода из боя.`,
        type: 'system' as const
      }] : [])
    ]);
    sound.playClick();
    triggerHaptic('medium');
    return true;
  }, [player, premium.active, combatStats.maxHp, combatStats, isInCombat, isCombatEnded, activeDungeonRun]);

  const startNextCombatBattle = useCallback((): boolean => {
    if (!player || !isInCombat || !isCombatEnded || combatOutcome !== 'victory' || !combatChain || combatChain.queue.length === 0) return false;
    const nextMonster = combatChain.queue[0];
    const remaining = combatChain.queue.length - 1;
    setCombatChain(prev => prev ? { ...prev, queue: prev.queue.slice(1) } : prev);
    setActiveMonster({ ...nextMonster, hp: nextMonster.maxHp });
    setMonsterEffects([]);
    setCombatRound(1);
    setLastCombatReward(null);
    setCombatPlayerMp(prev => Math.min(combatStats.maxMp, prev + Math.floor(combatStats.maxMp * 0.05)));
    setIsCombatEnded(false);
    setCombatOutcome(null);
    setTurnPhase('player');
    setBattleLog(prev => [...prev, {
      id: 'next_enemy_' + Date.now(),
      turn: 1,
      text: `⚔️ Следующий противник: ${nextMonster.name} (Ур. ${nextMonster.level}). После этого останется ${remaining}.`,
      type: 'system'
    }]);
    sound.playClick();
    triggerHaptic('medium');
    return true;
  }, [player, isInCombat, isCombatEnded, combatOutcome, combatChain, combatStats.maxMp]);


  const startTravel = useCallback((targetRegionId: string, modId?: string) => {
    const targetReg = REGIONS.find(r => r.id === targetRegionId);
    if (!targetReg) return { success: false, message: 'Локация не найдена' };
    if (!player || player.level < targetReg.minLevel) {
      return { success: false, message: `Для перехода нужен ${targetReg.minLevel}-й уровень.` };
    }
    if (travelState.isTraveling) return { success: false, message: 'Путешествие уже идёт.' };
    if (isInCombat && !isCombatEnded) return { success: false, message: 'Сначала завершите текущий бой.' };
    if (activeDungeonRun) return { success: false, message: 'Сначала завершите поход в подземелье.' };
    if (player.miningExpedition && !premium.active) return { success: false, message: 'Сначала уйдите с шахтёрской экспедиции.' };

    const selectedModId = modId && targetReg.availableMods.includes(modId) ? modId : targetReg.defaultModId;
    const activeMod = REGION_MODIFIERS[selectedModId] || REGION_MODIFIERS.mod_standard;
    const energyCost = activeMod.energyCost;

    if (player && player.energy < energyCost) {
      triggerHaptic('error');
      sound.playUpgradeFail();
      return { success: false, message: `Недостаточно энергии! Требуется ${energyCost} ⚡, а у вас ${player.energy} ⚡.` };
    }

    // Deduct travel energy
    setPlayer(prev => prev ? { ...prev, energy: Math.max(0, prev.energy - energyCost) } : prev);

    setTravelState({
      isTraveling: true,
      targetRegionId,
      targetRegionName: targetReg.name,
      progress: 15,
      isAmbush: false,
      message: 'Вы ступили на тропу перехода... Шелест листвы настораживает...'
    });

    sound.playTravelStep();
    triggerHaptic('light');

    let currentProg = 15;
    const interval = setInterval(() => {
      currentProg += 25;
      if (currentProg < 85) {
        sound.playTravelStep();
        setTravelState(prev => ({
          ...prev,
          progress: currentProg,
          message: currentProg >= 40 && currentProg < 70 ? 'Вглядываетесь в чащу... Впереди подозрительное затишье...' : 'Вы уже близко к цели...'
        }));
      } else {
        clearInterval(interval);
        // Ambush roll
        const ambushChance = activeMod.ambushChance;
        const isAmbush = Math.random() < ambushChance;

        if (isAmbush) {
          sound.playAmbush();
          triggerHaptic('heavy');
          setTravelState(prev => ({
            ...prev,
            progress: 100,
            isAmbush: true,
            message: '⚠️ ВНЕЗАПНАЯ ЗАСАДА! Из тени выскочил разъяренный монстр!'
          }));

          setTimeout(() => {
            setTravelState(prev => ({ ...prev, isTraveling: false }));
            const monsterId = targetReg.monsters[Math.floor(Math.random() * targetReg.monsters.length)];
            const baseMob = getRegionMonster(MONSTERS[monsterId] || MONSTERS['m_wolf'], targetReg);

            setPlayer(prev => prev ? {
              ...prev,
              currentRegionId: targetRegionId,
              activeRegionModId: selectedModId
            } : prev);

            startBattleWithMonster({
              ...baseMob,
              name: `[Засада!] ${baseMob.name}`,
              hp: Math.round(baseMob.hp * (activeMod.damageMultiplier || 1.0)),
              maxHp: Math.round(baseMob.maxHp * (activeMod.damageMultiplier || 1.0)),
              attack: Math.round(baseMob.attack * (activeMod.damageMultiplier || 1.0)),
              expReward: Math.round(baseMob.expReward * (activeMod.expMultiplier || 1.0) * 1.5),
              goldReward: Math.round(baseMob.goldReward * (activeMod.goldMultiplier || 1.0) * 1.5)
            }, { chain: false, energyCost: 0 });
          }, 1400);
        } else {
          sound.playVictory();
          triggerHaptic('success');
          setTravelState(prev => ({
            ...prev,
            progress: 100,
            message: `Вы благополучно добрались до ${targetReg.name}!`
          }));

          setTimeout(() => {
            setTravelState(prev => ({ ...prev, isTraveling: false }));
            setPlayer(prev => prev ? {
              ...prev,
              currentRegionId: targetRegionId,
              activeRegionModId: selectedModId
            } : prev);
          }, 800);
        }
      }
    }, 650);

    return { success: true, message: 'Путешествие началось!' };
  }, [player, travelState.isTraveling, startBattleWithMonster, isInCombat, isCombatEnded, activeDungeonRun, premium.active]);

  // COMBAT ENGINE WITH FULL ATTRIBUTES INFLUENCE & CHESS-LIKE TURNS
  const completeCombatVictory = useCallback((monster: Monster, currentTurn: number, baseLogs: BattleLogEntry[]) => {
    const activeMod = REGION_MODIFIERS[player?.activeRegionModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;
    // Every completed combat has a small consumable roll: 0–3 potions.
    const potionCount = Math.floor(Math.random() * 2);
    const potionPool: GameItem[] = [
      { id: 'drop_potion_hp_' + Date.now(), templateId: 'alc_hp_small', name: 'Малое зелье исцеления', type: 'potion', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🧪', description: 'Восстанавливает 120 HP.', stats: { heal: 120 }, sellPrice: 10, disassembleYield: { silver: 4 }, stackCount: 1 },
      { id: 'drop_potion_mp_' + Date.now(), templateId: 'alc_mp_small', name: 'Малое зелье маны', type: 'potion', rarity: 'common', level: 1, upgradeLevel: 0, icon: '💧', description: 'Восстанавливает 80 MP.', stats: { manaRestore: 80 }, sellPrice: 12, disassembleYield: { silver: 4 }, stackCount: 1 }
    ];
    const dungeonRoom = activeDungeonRun?.rooms[activeDungeonRun.currentRoomIndex];
    const completesDungeon =
      Boolean(dungeonRoom) &&
      dungeonRoom?.monster?.id === monster.id &&
      !dungeonRoom?.resolved &&
      activeDungeonRun!.currentRoomIndex === activeDungeonRun!.totalRooms - 1;

    let lootResult: { items: GameItem[]; gold: number; silver: number };
    try {
      lootResult = generateCombatLoot({
        monster,
        rareDropMult: (activeMod.rareDropMultiplier || 1) * 0.65 * (1 + combatStats.dropBonus / 100),
        goldMult: (activeMod.goldMultiplier || 1) * 0.55 * (1 + combatStats.goldBonus / 100),
        silverMult: (activeMod.silverMultiplier || 1) * 0.65 * (1 + combatStats.goldBonus / 100)
      });
    } catch (error) {
      console.error('Combat loot generation failed:', error);
      lootResult = { items: [], gold: 0, silver: 0 };
    }
    let expReward = Math.round(monster.expReward * (activeMod.expMultiplier || 1) * (1 + combatStats.expBonus / 100));
    if (potionCount > 0) {
      for (let i = 0; i < potionCount; i += 1) lootResult.items.push({ ...potionPool[i % potionPool.length], id: `drop_potion_${Date.now()}_${i}`, stackCount: 1 });
    }

    const hasNextCombat = Boolean(combatChain && combatChain.queue.length > 0);
    const isChainBattle = Boolean(combatChain);
    let itemsToAward = lootResult.items.map(item => ({ ...item }));
    if (dungeonRoom && activeDungeonRun && player?.classId === 'rogue' && (activeDungeonRun.kills || 0) >= 2) {
      itemsToAward.push(...generateCombatLoot({ monster, rareDropMult: 0.65, goldMult: 0, silverMult: 0 }).items.slice(0, 1));
    }
    if (completesDungeon) {
      itemsToAward.push(...generateCombatLoot({ monster, rareDropMult: 1.25, goldMult: 0, silverMult: 0 }).items.slice(0, 2));
    }

    if (isChainBattle && hasNextCombat) {
      setPendingChainItems(prev => [...prev, ...itemsToAward]);
      itemsToAward = [];
    } else if (isChainBattle) {
      const completionBonus = generateCombatLoot({
        monster,
        rareDropMult: (activeMod.rareDropMultiplier || 1) * 0.85 * (1 + combatStats.dropBonus / 100),
        goldMult: 0,
        silverMult: 0
      }).items.slice(0, Math.max(1, Math.ceil((combatChain?.total || 1) / 3)));
      itemsToAward = [...pendingChainItems, ...itemsToAward, ...completionBonus];
      setPendingChainItems([]);
    }

    const completionReward = completesDungeon && activeDungeonRun
      ? getDungeonCompletionReward(CAVES[activeDungeonRun.dungeonId]?.minLevel || 1, activeDungeonRun.difficulty)
      : undefined;
    if (completionReward) {
      lootResult = { ...lootResult, gold: lootResult.gold + completionReward.gold, silver: lootResult.silver + completionReward.silver };
      expReward += completionReward.exp;
    }

    setLastCombatReward({
      gold: lootResult.gold,
      silver: lootResult.silver,
      exp: expReward,
      items: itemsToAward.map(item => ({ ...item }))
    });
    const dungeonBonusPotions = completesDungeon ? Math.floor(Math.random() * 4) : 0;
    const logs = [...baseLogs];

    logs.push({
      id: 'win_' + Date.now(),
      turn: currentTurn,
      text: `🏆 ${monster.name} повержен! Блестящая победа!`,
      type: 'death'
    });
    if (potionCount > 0) logs.push({ id: 'potion_reward_' + Date.now(), turn: currentTurn, text: `🧪 Дополнительно найдено зелий: ${potionCount}.`, type: 'system' });
    if (completesDungeon) logs.push({ id: 'dungeon_potion_bonus_' + Date.now(), turn: currentTurn, text: `🏰 Подземелье очищено! Дополнительный тайник: ${dungeonBonusPotions} зелий.`, type: 'system' });

    logs.push({
      id: 'reward_' + Date.now(),
      turn: currentTurn,
      text: `💰 Награды: +${lootResult.gold} 🪙 и +${lootResult.silver} 🥈, +${expReward} EXP.`,
      type: 'system'
    });

    if (isChainBattle && hasNextCombat && lootResult.items.length > 0) {
      logs.push({
        id: 'chain_loot_' + Date.now(),
        turn: currentTurn,
        text: `🎒 Найдено предметов: ${lootResult.items.length}. Они добавлены в награду серии и будут выданы после последней победы.`,
        type: 'system'
      });
    }
    itemsToAward.forEach((item, index) => {
      logs.push({
        id: 'drop_' + Date.now() + '_' + index,
        turn: currentTurn,
        text: `🎁 Трофей: [${item.name}] (Ур. ${item.level}, ${item.rarity.toUpperCase()})!`,
        type: 'system'
      });
    });
    if (isChainBattle && !hasNextCombat && itemsToAward.length > 0) {
      logs.push({
        id: 'chain_bonus_' + Date.now(),
        turn: currentTurn,
        text: `🔥 Награда за завершённую серию: ${itemsToAward.length} предметов с бонусным роллом!`,
        type: 'system'
      });
    }

    setPlayer(prev => {
      if (!prev) return prev;
      const xpResult = addExperience(prev, expReward);
      let inventory = [...xpResult.player.inventory];

      for (const item of itemsToAward) {
        const added = addOrStackInventoryItem(inventory, item, xpResult.player.maxInventorySlots);
        inventory = added.inventory;
        if (!added.added) {
          logs.push({
            id: 'bag_full_' + Date.now() + Math.random(),
            turn: currentTurn,
            text: `⚠️ Инвентарь заполнен: ${item.name} не удалось забрать.`,
            type: 'system'
          });
        }
      }

      if (dungeonBonusPotions > 0) {
        for (let i = 0; i < dungeonBonusPotions; i += 1) {
          const potion = potionPool[(i + potionCount) % potionPool.length];
          const addedPotion = addOrStackInventoryItem(inventory, { ...potion, id: 'dungeon_potion_' + Date.now() + '_' + i, stackCount: 1 }, xpResult.player.maxInventorySlots);
          inventory = addedPotion.inventory;
        }
      }

      const next = {
        ...xpResult.player,
        gold: xpResult.player.gold + lootResult.gold,
        silver: xpResult.player.silver + lootResult.silver,
        inventory,
        statsSummary: {
          ...xpResult.player.statsSummary,
          monstersKilled: xpResult.player.statsSummary.monstersKilled + 1,
          bossesDefeated: xpResult.player.statsSummary.bossesDefeated + (monster.isBoss ? 1 : 0),
          battlesWon: xpResult.player.statsSummary.battlesWon + 1,
          dungeonsCleared: xpResult.player.statsSummary.dungeonsCleared + (completesDungeon ? 1 : 0)
        }
      };

      if (xpResult.levelsGained > 0) {
        for (let level = prev.level + 1; level <= xpResult.player.level; level += 1) {
          sound.playLevelUp();
          logs.push({
            id: 'lvl_' + Date.now() + '_' + level,
            turn: currentTurn,
            text: `🎉 НОВЫЙ УРОВЕНЬ! Вы достигли ${level} уровня! +5 очков характеристик и +1 очко талантов.`,
            type: 'heal'
          });
        }
      }

      setQuests(qList => qList.map(q => {
        if (q.completed) return q;
        if (q.targetMonsterId && q.targetMonsterId !== monster.id) return q;
        if (q.targetRegionId && q.targetRegionId !== monster.regionId && q.targetRegionId !== prev.currentRegionId) return q;
        if (q.category === 'boss' && !monster.isBoss) return q;
        if (['hunting','story','daily','boss'].includes(q.category)) {
          const count = Math.min(q.targetCount, q.currentCount + 1);
          const completed = count >= q.targetCount;
          if (completed) {
            logs.push({
              id: 'quest_done_' + Date.now() + Math.random(),
              turn: currentTurn,
              text: `📜 Задание выполнено: [${q.title}]! Награда ждет в меню заданий.`,
              type: 'heal'
            });
          }
          return { ...q, currentCount: count, completed };
        }
        return q;
      }));

      setAchievements(aList => aList.map(a => {
        if (a.id === 'ach_1' || a.id === 'ach_2') {
          const progress = Math.min(a.maxProgress, a.progress + 1);
          return { ...a, progress, completed: progress >= a.maxProgress };
        }
        if (a.id === 'ach_3' && monster.isBoss) {
          return { ...a, progress: 1, completed: true };
        }
        return a;
      }));

      return reconcileSkills(next, CLASSES[next.classId].startingSkills);
    });

    if (dungeonRoom?.monster?.id === monster.id && activeDungeonRun) {
      if (player?.classId === 'mage') setCombatPlayerMp(mp => Math.min(combatStats.maxMp, mp + Math.round(combatStats.maxMp * 0.1)));
      if (player?.classId === 'necromancer' || (player?.classId === 'paladin' && (activeDungeonRun.kills || 0) % 3 === 2)) {
        setCombatPlayerHp(hp => Math.min(combatStats.maxHp, hp + Math.round(combatStats.maxHp * 0.08)));
      }
      setActiveDungeonRun(prevRun => {
        if (!prevRun) return prevRun;
        const index = prevRun.currentRoomIndex;
        const rooms = prevRun.rooms.map((room, roomIndex) =>
          roomIndex === index ? { ...room, resolved: true, rewardClaimed: true } : room
        );
        const isLast = index >= prevRun.totalRooms - 1;
        return {
          ...prevRun,
          rooms,
          currentRoomIndex: isLast ? index : index + 1,
          completed: isLast,
          completionReward: isLast ? completionReward : prevRun.completionReward,
          temporaryBlessing: prevRun.temporaryBlessing && prevRun.temporaryBlessing.remainingBattles > 1
            ? { ...prevRun.temporaryBlessing, remainingBattles: prevRun.temporaryBlessing.remainingBattles - 1 }
            : null,
          kills: (prevRun.kills || 0) + 1,
          savedHp: Math.min(combatStats.maxHp, combatPlayerHp + (player?.classId === 'necromancer' || player?.classId === 'paladin' && (prevRun.kills || 0) % 3 === 2 ? Math.round(combatStats.maxHp * 0.08) : 0)),
          savedMp: Math.min(combatStats.maxMp, combatPlayerMp + (player?.classId === 'mage' ? Math.round(combatStats.maxMp * 0.1) : 0))
        };
      });
    }

    sound.playVictory();
    triggerHaptic('success');
    setCombatChain(prev => prev ? { ...prev, defeated: Math.min(prev.total, prev.defeated + 1) } : prev);
    setActiveMonster(prev => prev ? { ...prev, hp: 0 } : null);
    setBattleLog(prev => [...prev, ...logs, {
      id: 'chain_state_' + Date.now(),
      turn: currentTurn,
      text: hasNextCombat
        ? `🔥 Победа ${combatChain!.defeated + 1}/${combatChain!.total}. Следующий противник уже ждёт.`
        : (combatChain ? `🏁 Вся серия из ${combatChain.total} противников уничтожена.` : '🏁 Бой завершён.'),
      type: 'system'
    }]);
    setIsCombatEnded(true);
    setCombatOutcome('victory');
    setTurnPhase('ended');
  }, [player, combatStats, activeDungeonRun, combatChain, pendingChainItems, combatPlayerHp, combatPlayerMp]);

  const performPlayerAction = useCallback((actionType: 'attack' | 'skill' | 'defend' | 'potion' | 'flee', skillId?: string) => {
    if (!isInCombat || !activeMonster || isCombatEnded || !player || turnPhase !== 'player') return;

    const currentTurn = combatRound;
    const newLogs: BattleLogEntry[] = [];
    const activeMod = REGION_MODIFIERS[player.activeRegionModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;

    // Process player-owned periodic effects at the start of the player's turn.
    const playerTick = tickStatusEffects(playerEffects);
    setPlayerEffects(playerTick.effects);

    if (playerTick.damage > 0) {
      let statusDamage = 0;
      for (const [type, amount] of Object.entries(playerTick.damageByType)) {
        statusDamage += calculateTypedDamage({
          power: amount || 0,
          multiplier: 1,
          damageType: type as import('../types/game').DamageType,
          targetDefense: combatStats.defense,
          targetMagicDefense: combatStats.magicDefense,
          armorPenetration: 0,
          targetResistances: combatStats.resistances,
          extraDamageMultiplier: playerTick.damageTakenMultiplier
        });
      }
      const nextHp = Math.max(0, combatPlayerHp - statusDamage);
      setCombatPlayerHp(nextHp);
      if (statusDamage > 0) {
        newLogs.push({
          id: 'player_dot_' + Date.now(),
          turn: currentTurn,
          text: `☠️ [Статус] Вы получили ${statusDamage} периодического урона.`,
          type: 'status'
        });
      }
      if (nextHp <= 0) {
        newLogs.push({
          id: 'player_dot_death_' + Date.now(),
          turn: currentTurn,
          text: '💀 Вы погибли от действующего эффекта.',
          type: 'death'
        });
        setPlayer(prev => prev ? { ...prev, statsSummary: { ...prev.statsSummary, battlesLost: prev.statsSummary.battlesLost + 1 } } : prev);
        setBattleLog(prev => [...prev, ...newLogs]);
        setIsCombatEnded(true);
        setCombatOutcome('defeat');
        setCombatChain(null);
        setTurnPhase('ended');
        return;
      }
    }

    if (playerTick.skipTurn) {
      newLogs.push({
        id: 'player_cc_' + Date.now(),
        turn: currentTurn,
        text: '🌀 [Контроль] Вы пропускаете этот ход.',
        type: 'status'
      });
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    }

    const playerMods = getStatusModifiers(playerEffects);
    const monsterMods = getStatusModifiers(monsterEffects);
    let nextMonsterHp = activeMonster.hp;

    if (actionType === 'flee') {
      if (Math.random() < 0.65) {
        newLogs.push({ id: 'flee_' + Date.now(), turn: currentTurn, text: '🏃 Вы ловко ускользнули из боя!', type: 'flee' });
        setBattleLog(prev => [...prev, ...newLogs]);
        setIsCombatEnded(true);
        setCombatOutcome('flee');
        setCombatChain(null);
        setTurnPhase('ended');
        triggerHaptic('light');
        return;
      }
      newLogs.push({ id: 'flee_fail_' + Date.now(), turn: currentTurn, text: '❌ Попытка побега провалилась!', type: 'system' });
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    }

    if (actionType === 'defend') {
      setPlayerEffects(prev => applyStatusEffect(prev, {
        type: 'shield',
        name: 'Глухая оборона',
        duration: 1,
        value: Math.round(combatStats.defense * 1.5)
      }));
      setCombatPlayerMp(prev => Math.min(combatStats.maxMp, prev + 25));
      newLogs.push({
        id: 'def_' + Date.now(),
        turn: currentTurn,
        text: '🛡️ Вы встали в глухую оборону! Щит усилен, восстановлено 25 MP.',
        type: 'heal'
      });
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    }

    if (actionType === 'potion') {
      const pot = skillId
        ? player.inventory.find(i => i.type === 'potion' && i.id === skillId)
        : player.inventory.find(i => i.type === 'potion');
      if (!pot) {
        newLogs.push({ id: 'no_pot_' + Date.now(), turn: currentTurn, text: '❌ У вас нет зелий в инвентаре!', type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }

      const stats = pot.stats || {};
      const heal = Math.max(0, stats.heal || (
        pot.templateId === 'pot_hp_great' ? 650 :
        pot.templateId === 'pot_hp_large' ? 350 :
        pot.templateId === 'pot_hp_small' ? 150 : 0
      ));
      const mana = Math.max(0, stats.manaRestore || 0);
      const attackPercent = Math.max(0, stats.attackPercent || 0);
      const defensePercent = Math.max(0, stats.defensePercent || 0);
      const buffDuration = Math.max(1, stats.buffDuration || 3);
      const invulnerability = stats.invulnerable > 0;
      const healFull = stats.healFull > 0;

      if (!heal && !mana && !attackPercent && !defensePercent && !invulnerability && !healFull) {
        newLogs.push({ id: 'empty_pot_' + Date.now(), turn: currentTurn, text: `❌ ${pot.name} пока не имеет боевого эффекта.`, type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }

      if (healFull) setCombatPlayerHp(combatStats.maxHp);
      else if (heal) setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + heal));
      if (mana) setCombatPlayerMp(prev => Math.min(combatStats.maxMp, prev + mana));
      if (attackPercent) {
        setPlayerEffects(prev => applyStatusEffect(prev, { type: 'fury', name: pot.name, duration: buffDuration, value: attackPercent }));
      }
      if (defensePercent) {
        setPlayerEffects(prev => applyStatusEffect(prev, { type: 'fortify', name: pot.name, duration: buffDuration, value: defensePercent }));
      }
      if (invulnerability) {
        setPlayerEffects(prev => applyStatusEffect(prev, { type: 'invulnerable', name: pot.name, duration: 1, value: 1 }));
      }

      setPlayer(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          inventory: prev.inventory
            .map(i => i.id === pot.id ? { ...i, stackCount: (i.stackCount || 1) - 1 } : i)
            .filter(i => (i.stackCount || 0) > 0)
        };
      });

      newLogs.push({
        id: 'pot_' + Date.now(),
        turn: currentTurn,
        text: `🧪 Вы использовали ${pot.name}.${healFull ? ' Полное восстановление HP.' : ''}${heal ? ` +${heal} HP` : ''}${mana ? ` +${mana} MP` : ''}`,
        type: 'heal'
      });
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    }

    let multiplier = 1;
    let damageType: import('../types/game').DamageType = 'physical';
    let skillName = 'Атака оружием';
    let skillUsed: import('../types/game').Skill | null = null;

    const stealthStrike = player.classId === 'assassin' && lastCast?.id === 'a_stealth' && currentTurn - lastCast.turn <= 3;
    if (actionType === 'skill') {
      skillUsed = player.skills.find(s => s.id === skillId) || null;
      if (!skillUsed) {
        newLogs.push({ id: 'bad_skill_' + Date.now(), turn: currentTurn, text: '❌ Навык не найден.', type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }
      if (player.level < skillUsed.levelReq) {
        newLogs.push({ id: 'locked_skill_' + Date.now(), turn: currentTurn, text: `🔒 ${skillUsed.name} доступен с ${skillUsed.levelReq} уровня.`, type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }
      if ((skillUsed.currentCooldown || 0) > 0) {
        newLogs.push({ id: 'cooldown_' + Date.now(), turn: currentTurn, text: `⏳ ${skillUsed.name} ещё ${skillUsed.currentCooldown} ход(а) в перезарядке.`, type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }
      if (combatPlayerMp < skillUsed.manaCost) {
        newLogs.push({ id: 'no_mp_' + Date.now(), turn: currentTurn, text: `❌ Недостаточно маны для ${skillUsed.name} (${skillUsed.manaCost} MP)!`, type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }

      setCombatPlayerMp(prev => Math.max(0, prev - skillUsed!.manaCost));
      setPlayer(prev => prev ? {
        ...prev,
        skills: prev.skills.map(s => s.id === skillUsed!.id ? { ...s, currentCooldown: skillUsed!.cooldown } : s)
      } : prev);

      const tier = skillTier(player);
      multiplier = skillUsed.damageMultiplier * [1, 1.12, 1.25, 1.4][tier - 1];
      if (skillUsed.comboFrom && lastCast?.id === skillUsed.comboFrom && currentTurn - lastCast.turn <= 3) {
        multiplier *= skillUsed.comboMultiplier || 1.25;
        newLogs.push({ id: 'combo_' + Date.now(), turn: currentTurn, text: `🔗 Связка ${skillUsed.name}: усиленный удар!`, type: 'skill' });
      }
      if (skillUsed.executeThreshold && activeMonster.hp / activeMonster.maxHp <= skillUsed.executeThreshold) multiplier *= skillUsed.executeMultiplier || 1.5;
      if (player.classId === 'assassin' && activeMonster.hp / activeMonster.maxHp < 0.4) multiplier *= 1.25;
      if (player.classId === 'mage' && lastCast && lastCast.id !== skillUsed.id && currentTurn - lastCast.turn <= 3) {
        setCombatPlayerMp(mp => Math.min(combatStats.maxMp, mp + Math.round(skillUsed!.manaCost * 0.15)));
        newLogs.push({id:'elemental_' + Date.now(),turn:currentTurn,text:'🌌 Чередование стихий возвращает часть MP.',type:'skill'});
      }
      if (skillUsed.guaranteedEvade) setPlayerEffects(prev => applyStatusEffect(prev, { type: 'invulnerable', name: 'Скрытность', duration: 1, value: 1 }));
      if (skillUsed.poisonBurst) {
        const poison = monsterEffects.find(e => e.type === 'poison');
        if (poison) {
          multiplier += (poison.stacks || 1) * 0.22;
          setMonsterEffects(prev => prev.filter(e => e.type !== 'poison'));
          newLogs.push({ id: 'burst_' + Date.now(), turn: currentTurn, text: `☠️ Взорвано слоёв яда: ${poison.stacks || 1}.`, type: 'skill' });
        }
      }
      damageType = skillUsed.damageType;
      skillName = skillUsed.name;
      setLastCast({ id: skillUsed.id, turn: currentTurn });

      if (skillUsed.inflicts && ['shield', 'fortify', 'fury', 'haste', 'invulnerable'].includes(skillUsed.inflicts.type)) {
        const effect = {
          type: skillUsed!.inflicts!.type,
          name: skillUsed!.name,
          duration: skillUsed!.inflicts!.duration,
          value: skillUsed!.inflicts!.power
        };
        setPlayerEffects(prev => applyStatusEffect(prev, effect));
        newLogs.push({
          id: 'effect_' + Date.now(),
          turn: currentTurn,
          text: `✨ ${activeMonster.name} получает статус [${skillUsed.inflicts.type}]!`,
          type: 'status'
        });
      }
    }
    if (player.classId === 'warrior') multiplier *= 1 + warriorMomentum * 0.03;
    if (player.classId === 'berserker' && combatPlayerHp / combatStats.maxHp < 0.5) multiplier *= 1.22;
    if (player.classId === 'warrior' && activeDungeonRun) multiplier *= 1 + Math.min(10, activeDungeonRun.kills || 0) * 0.02;
    if (player.classId === 'rogue' && rogueFocus) { multiplier *= 1.12; setRogueFocus(false); }

    // Shield, stealth and healing skills consume a turn without a phantom zero-damage hit.
    if (skillUsed && skillUsed.damageMultiplier === 0) {
      const healAmount = skillUsed.healMultiplier ? Math.max(1, Math.round(100 * skillUsed.healMultiplier)) : 0;
      if (healAmount) setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + healAmount));
      newLogs.push({
        id: 'skill_heal_' + Date.now(),
        turn: currentTurn,
        text: healAmount ? `✨ [${skillName}] восстанавливает ${healAmount} HP.` : `✨ [${skillName}] активирован.`,
        type: 'heal'
      });
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    }

    // Every strike resolves independently. A multi-hit can crit, miss, drain and kill on any hit.
    const attackPower = getDamagePower(damageType, combatStats);
    const strikes = Math.max(1, (skillUsed?.hits || 1) + (skillUsed?.hits && skillTier(player) >= 4 ? 1 : 0));
    for (let strike = 0; strike < strikes && nextMonsterHp > 0; strike++) {
      const hitChance = Math.min(98, Math.max(30, combatStats.accuracy - activeMonster.evasion + 85));
      const alwaysHit = Boolean(skillUsed?.guaranteedHit || stealthStrike);
      const evade = monsterEffects.some(e => e.type === 'invulnerable');
      const conflict = alwaysHit && evade;
      const landed = conflict ? Math.random() < 0.5 : alwaysHit || (!evade && Math.random() * 100 <= hitChance);
      if (conflict) newLogs.push({id:`contest_${Date.now()}_${strike}`,turn:currentTurn,text:`⚖️ Безошибочный удар и уход в пустоту: ${landed ? 'удар попал' : 'уклонение победило'}.`,type:'system'});
      if (!landed) {
        newLogs.push({id:`evade_${Date.now()}_${strike}`,turn:currentTurn,text:`💨 ${activeMonster.name} уклонился от ${skillName} (${strike + 1}/${strikes}).`,type:'system'});
        continue;
      }
      let finalDmg = calculateTypedDamage({
        power: attackPower * playerMods.attackMultiplier,
        multiplier: multiplier / strikes,
        damageType,
        targetDefense: activeMonster.defense,
        targetMagicDefense: activeMonster.magicDefense,
        armorPenetration: combatStats.armorPenetration + (skillUsed && skillTier(player) >= 3 ? 20 : 0),
        targetResistances: activeMonster.resistances,
        extraDamageMultiplier: monsterMods.damageTakenMultiplier
      });
      const isCrit = stealthStrike || Math.random() * 100 < combatStats.critChance;
      if (isCrit) finalDmg = Math.round(finalDmg * combatStats.critDamage / 100);
      if (isCrit && player.classId === 'rogue') setRogueFocus(true);
      if (skillUsed?.instantExecutePve && activeDungeonRun?.rooms[activeDungeonRun.currentRoomIndex]?.monster?.id === activeMonster.id && !activeMonster.isBoss &&
          nextMonsterHp / activeMonster.maxHp <= (skillUsed.executeThreshold || 0)) {
        finalDmg = nextMonsterHp;
        newLogs.push({id:`execute_${Date.now()}`,turn:currentTurn,text:`☠️ ${skillName}: обычный враг повержен.`,type:'skill'});
      }
      if (isCrit) { sound.playCriticalHit(); triggerHaptic('heavy'); }
      else { sound.playSlash(); triggerHaptic('light'); }
      finalDmg = Math.min(finalDmg, nextMonsterHp);
      if (skillUsed?.armorBreak && strike === 0) setMonsterEffects(prev => applyStatusEffect(prev, { type: 'vulnerability', name: 'Разлом брони', duration: 3, value: skillUsed!.armorBreak! }));
      if (skillUsed?.inflicts && !['shield', 'fortify', 'fury', 'haste', 'invulnerable'].includes(skillUsed.inflicts.type)
          && Math.random() < Math.min(1, skillUsed.inflicts.chance + (skillTier(player) >= 2 ? 0.08 : 0))) {
        setMonsterEffects(prev => applyStatusEffect(prev, {
          type: skillUsed!.inflicts!.type, name: skillUsed!.name,
          duration: skillUsed!.inflicts!.duration, value: skillUsed!.inflicts!.power
        }));
        newLogs.push({id:`effect_${Date.now()}_${strike}`,turn:currentTurn,text:`✨ ${activeMonster.name}: ${skillUsed.inflicts.type}.`,type:'status'});
      }
      newLogs.push({id:`dmg_${Date.now()}_${strike}`,turn:currentTurn,text:`${isCrit ? '💥' : '⚔️'} [${skillName}] удар ${strike + 1}/${strikes}: ${finalDmg} ${damageType.toUpperCase()} урона.`,type:isCrit?'crit':'player-attack'});
      if (skillUsed?.healMultiplier && finalDmg > 0) {
        const heal = Math.max(1, Math.round(finalDmg * skillUsed.healMultiplier));
        setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + heal));
      }
      if (combatStats.vampirism > 0 && finalDmg > 0) {
        const lifesteal = Math.max(1, Math.round(finalDmg * combatStats.vampirism / 100));
        setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + lifesteal));
        newLogs.push({id:`vamp_${Date.now()}_${strike}`,turn:currentTurn,text:`🩸 Вампиризм +${lifesteal} HP.`,type:'heal'});
      }
      nextMonsterHp = Math.max(0, nextMonsterHp - finalDmg);
    }

    if (nextMonsterHp <= 0) {
      // Resolve the death state before rewards so a loot/error path can never leave
      // the opponent visually stuck at 1 HP.
      setActiveMonster(prev => prev ? { ...prev, hp: 0 } : null);
      setIsCombatEnded(true);
      setCombatOutcome('victory');
      setTurnPhase('ended');
      completeCombatVictory(activeMonster, currentTurn, newLogs);
      return;
    }

    setActiveMonster(prev => prev ? { ...prev, hp: nextMonsterHp } : null);
    setBattleLog(prev => [...prev, ...newLogs]);
    setTurnPhase('monster');
  }, [
    isInCombat,
    activeMonster,
    isCombatEnded,
    player,
    turnPhase,
    combatRound,
    playerEffects,
    monsterEffects,
    combatPlayerHp,
    combatPlayerMp,
    combatStats,
    completeCombatVictory,
    lastCast, warriorMomentum, rogueFocus, activeDungeonRun
  ]);

  // MONSTER TURN CONTROLLER — monsters telegraph skills before casting them.
  useEffect(() => {
    if (!isInCombat || isCombatEnded || !activeMonster || turnPhase !== 'monster' || !player || monsterIntent) return;

    const timer = setTimeout(() => {
      const currentTurn = combatRound;
      const newLogs: BattleLogEntry[] = [];
      const activeMod = REGION_MODIFIERS[player.activeRegionModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;
      const monsterTick = tickStatusEffects(monsterEffects);
      setMonsterEffects(monsterTick.effects);

      let workingHp = activeMonster.hp;
      if (monsterTick.damage > 0) {
        let statusDamage = 0;
        for (const [type, amount] of Object.entries(monsterTick.damageByType)) {
          statusDamage += calculateTypedDamage({
            power: amount || 0, multiplier: 1, damageType: type as import('../types/game').DamageType,
            targetDefense: activeMonster.defense, targetMagicDefense: activeMonster.magicDefense,
            armorPenetration: 0, targetResistances: activeMonster.resistances,
            extraDamageMultiplier: monsterTick.damageTakenMultiplier
          });
        }
        workingHp = Math.max(0, workingHp - statusDamage);
        if (statusDamage > 0) newLogs.push({ id: 'monster_dot_' + Date.now(), turn: currentTurn, text: `☠️ [Статус] ${activeMonster.name} получает ${statusDamage} периодического урона.`, type: 'status' });
      }
      if (workingHp <= 0) {
        completeCombatVictory(activeMonster, currentTurn, newLogs);
        return;
      }
      if (workingHp !== activeMonster.hp) setActiveMonster(prev => prev ? { ...prev, hp: workingHp } : null);

      if (monsterTick.skipTurn) {
        newLogs.push({ id: 'monster_cc_' + Date.now(), turn: currentTurn, text: `🌀 [Контроль] ${activeMonster.name} пропускает ход.`, type: 'status' });
        setActiveMonster(prev => prev ? { ...prev, hp: workingHp, skills: prev.skills?.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) } : null);
        setPlayer(prev => prev ? { ...prev, skills: prev.skills.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) } : prev);
        setBattleLog(prev => [...prev, ...newLogs]);
        setCombatRound(prev => prev + 1);
        setTurnPhase('player');
        return;
      }

      const plannedSkill = getMonsterPlannedSkill(activeMonster);
      if (plannedSkill) {
        const skill = plannedSkill;
        setActiveMonster(prev => prev ? { ...prev, hp: workingHp } : null);
        setMonsterIntent(skill);
        newLogs.push({
          id: 'monster_intent_' + Date.now(), turn: currentTurn,
          text: `⚠️ ${activeMonster.name} готовит ${skill.icon} «${skill.name}» — ${skill.description || 'особый приём'}!`, type: 'skill'
        });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }

      const playerMods = getStatusModifiers(playerEffects);
      const monsterDamageType = activeMonster.damageType || 'physical';
      const monsterPower = monsterDamageType === 'physical' ? activeMonster.attack : activeMonster.magicAttack;
      const defense = monsterDamageType === 'physical' ? Math.max(0, combatStats.defense - (activeMod.bonusArmorPenetration || 0)) : combatStats.magicDefense;
      const mitigation = defense / (defense + (monsterDamageType === 'physical' ? 80 : 90));
      const resistance = getTargetResistance(monsterDamageType, combatStats.resistances);
      let monsterFinalDmg = Math.max(0, Math.round(monsterPower * (activeMod.damageMultiplier || 1) * (1 - mitigation) * (1 - resistance / 100) * playerMods.damageTakenMultiplier * (playerMods.invulnerable ? 0 : 1)));
      const hpPct = combatPlayerHp / Math.max(1, combatStats.maxHp);
      if (player.classId === 'warrior') monsterFinalDmg = Math.round(monsterFinalDmg * 0.90);
      if (player.classId === 'druid' && hpPct < 0.45) monsterFinalDmg = Math.round(monsterFinalDmg * 0.85);
      let blockedByShield = 0;
      const shieldIndex = playerEffects.findIndex(e => e.type === 'shield');
      if (!playerMods.invulnerable && shieldIndex >= 0) {
        const shield = Math.max(0, playerEffects[shieldIndex].value || 0);
        blockedByShield = Math.min(shield, monsterFinalDmg);
        monsterFinalDmg -= blockedByShield;
        setPlayerEffects(prevEffects => prevEffects.map((effect, index) => index === shieldIndex ? { ...effect, value: effect.value - blockedByShield } : effect).filter(effect => effect.type !== 'shield' || effect.value > 0));
      }
      if (player.classId === 'warrior' && monsterFinalDmg > 0) setWarriorMomentum(n => Math.min(4, n + 1));
      newLogs.push({ id: 'm_atk_' + Date.now(), turn: currentTurn, text: playerMods.invulnerable ? `✨ [Неуязвимость] ${activeMonster.name} не нанес урона.` : `🩸 ${activeMonster.name} наносит ${monsterFinalDmg} ${monsterDamageType.toUpperCase()} урона${blockedByShield ? ` (щит поглотил ${blockedByShield})` : ''}.`, type: playerMods.invulnerable ? 'heal' : 'monster-attack' });
      setCombatPlayerHp(prevHp => {
        const nextHp = Math.max(0, prevHp - monsterFinalDmg);
        if (nextHp <= 0 && activeDungeonRun && player.classId === 'necromancer' && !activeDungeonRun.resurrectionUsed) {
          setActiveDungeonRun(run => run ? { ...run, resurrectionUsed: true } : run);
          newLogs.push({ id: 'resurrection_' + Date.now(), turn: currentTurn, text: '👻 Некромант воскрес с 30% HP. Воскрешение за поход использовано.', type: 'heal' });
          setCombatRound(prev => prev + 1); setTurnPhase('player');
          return Math.max(1, Math.round(combatStats.maxHp * 0.3));
        }
        if (nextHp <= 0) {
          newLogs.push({ id: 'm_fatal_' + Date.now(), turn: currentTurn, text: `💀 Вы пали в бою с ${activeMonster.name}...`, type: 'death' });
          sound.playDefeat(); triggerHaptic('error');
          setPlayer(prev => prev ? { ...prev, statsSummary: { ...prev.statsSummary, battlesLost: prev.statsSummary.battlesLost + 1 } } : prev);
          setIsCombatEnded(true); setCombatOutcome('defeat'); setTurnPhase('ended');
        } else {
          setCombatRound(prev => prev + 1);
          setTurnPhase('player');
        }
        return nextHp;
      });
      setActiveMonster(prev => prev ? { ...prev, hp: workingHp, skills: prev.skills?.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) } : null);
      setPlayer(prev => prev ? { ...prev, skills: prev.skills.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) } : prev);
      setBattleLog(prev => [...prev, ...newLogs]);
    }, 650);
    return () => clearTimeout(timer);
  }, [isInCombat, isCombatEnded, activeMonster, player, turnPhase, combatRound, monsterEffects, playerEffects, combatStats, completeCombatVictory, monsterIntent, combatPlayerHp, activeDungeonRun]);

  // Delayed monster skill execution. The warning above is intentionally visible first.
  useEffect(() => {
    if (!monsterIntent || !isInCombat || isCombatEnded || !activeMonster || !player || turnPhase !== 'monster') return;
    const timer = setTimeout(() => {
      const skill = monsterIntent;
      const currentTurn = combatRound;
      const activeMod = REGION_MODIFIERS[player.activeRegionModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;
      const playerMods = getStatusModifiers(playerEffects);
      const power = skill.damageType === 'physical' ? activeMonster.attack : activeMonster.magicAttack;
      const defense = skill.damageType === 'physical' ? Math.max(0, combatStats.defense - (activeMod.bonusArmorPenetration || 0)) : combatStats.magicDefense;
      const mitigation = defense / (defense + (skill.damageType === 'physical' ? 80 : 90));
      const resistance = getTargetResistance(skill.damageType, combatStats.resistances);
      let damage = Math.max(0, Math.round(power * skill.damageMultiplier * (1 - mitigation) * (1 - resistance / 100) * playerMods.damageTakenMultiplier * (playerMods.invulnerable ? 0 : 1)));
      const hpPct = combatPlayerHp / Math.max(1, combatStats.maxHp);
      if (player.classId === 'warrior') damage = Math.round(damage * 0.90);
      if (player.classId === 'druid' && hpPct < 0.45) damage = Math.round(damage * 0.85);
      const logs: BattleLogEntry[] = [{ id: 'monster_cast_' + Date.now(), turn: currentTurn, text: `🔥 ${activeMonster.name} применяет ${skill.icon} «${skill.name}»!`, type: 'skill' }];
      let blocked = 0;
      const shieldIndex = playerEffects.findIndex(e => e.type === 'shield');
      if (!playerMods.invulnerable && shieldIndex >= 0) {
        blocked = Math.min(playerEffects[shieldIndex].value, damage); damage -= blocked;
        setPlayerEffects(prev => prev.map((e,i)=>i===shieldIndex?{...e,value:e.value-blocked}:e).filter(e=>e.type!=='shield'||e.value>0));
      }
      if (player.classId === 'warrior' && damage > 0) setWarriorMomentum(n => Math.min(4, n + 1));
      if (skill.effect && Math.random() < (skill.effectChance ?? 1)) {
        const effect: StatusEffect = { type: skill.effect, name: skill.name, duration: skill.effectDuration || 1, value: skill.effectPower || 0 };
        if (skill.effect === 'fortify' || skill.effect === 'fury' || skill.effect === 'shield') setMonsterEffects(prev => applyStatusEffect(prev, effect));
        else setPlayerEffects(prev => applyStatusEffect(prev, effect));
        logs.push({ id: 'monster_effect_' + Date.now(), turn: currentTurn, text: `✨ ${activeMonster.name} накладывает [${skill.effect}]!`, type: 'status' });
      }
      logs.push({ id: 'monster_skill_damage_' + Date.now(), turn: currentTurn, text: playerMods.invulnerable ? '✨ Неуязвимость полностью поглощает особый приём.' : `💥 Особый приём наносит ${damage} ${skill.damageType.toUpperCase()} урона${blocked ? ` (щит поглотил ${blocked})` : ''}.`, type: 'monster-attack' });
      setCombatPlayerHp(prevHp => {
        const nextHp = Math.max(0, prevHp - damage);
        if (nextHp <= 0 && activeDungeonRun && player.classId === 'necromancer' && !activeDungeonRun.resurrectionUsed) {
          setActiveDungeonRun(run => run ? { ...run, resurrectionUsed: true } : run);
          logs.push({ id: 'resurrection_' + Date.now(), turn: currentTurn, text: '👻 Некромант воскрес с 30% HP.', type: 'heal' });
          setCombatRound(prev => prev + 1); setTurnPhase('player'); setMonsterIntent(null);
          return Math.max(1, Math.round(combatStats.maxHp * 0.3));
        }
        if (nextHp <= 0) {
          logs.push({ id: 'monster_skill_fatal_' + Date.now(), turn: currentTurn, text: `💀 Особый приём ${skill.name} вас добил.`, type: 'death' });
          sound.playDefeat(); triggerHaptic('error');
          setPlayer(prev => prev ? { ...prev, statsSummary: { ...prev.statsSummary, battlesLost: prev.statsSummary.battlesLost + 1 } } : prev);
          setIsCombatEnded(true); setCombatOutcome('defeat'); setTurnPhase('ended'); setMonsterIntent(null);
        } else {
          setCombatRound(prev => prev + 1);
          setTurnPhase('player');
          setMonsterIntent(null);
        }
        return nextHp;
      });
      setActiveMonster(prev => prev ? { ...prev, skills: prev.skills?.map(s => ({ ...s, currentCooldown: s.id === skill.id ? skill.cooldown : Math.max(0, (s.currentCooldown || 0) - 1) })), mp: Math.max(0, prev.mp - skill.manaCost) } : null);
      setPlayer(prev => prev ? { ...prev, skills: prev.skills.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) } : prev);
      setBattleLog(prev => [...prev, ...logs]);
    }, 700);
    return () => clearTimeout(timer);
  }, [monsterIntent, isInCombat, isCombatEnded, activeMonster, player, turnPhase, combatRound, playerEffects, combatStats, combatPlayerHp, activeDungeonRun]);

  // Auto-battle loop (continues the encounter chain without leaving combat).
  useEffect(() => {
    if (!autoBattle.enabled || !isInCombat || !isCombatEnded || combatOutcome !== 'victory' || !combatChain || combatChain.queue.length === 0) return;
    const timer = setTimeout(() => { startNextCombatBattle(); }, 700);
    return () => clearTimeout(timer);
  }, [autoBattle.enabled, isInCombat, isCombatEnded, combatOutcome, combatChain, startNextCombatBattle]);

  // Auto-battle loop (operates only on player's turn)
  useEffect(() => {
    if (!autoBattle.enabled || !isInCombat || isCombatEnded || !activeMonster || turnPhase !== 'player' || !player) return;

    const timer = setTimeout(() => {
      const playerHpPct = (combatPlayerHp / combatStats.maxHp) * 100;
      const potionItem = player.inventory.find(i => i.type === 'potion');

      if (playerHpPct <= autoBattle.healAtHpPercent && potionItem) {
        performPlayerAction('potion');
      } else if (autoBattle.useSkills && player.skills.length > 0) {
        const affordableSkill = player.skills.find(s =>
          s.manaCost <= combatPlayerMp &&
          player.level >= s.levelReq &&
          (s.currentCooldown || 0) <= 0
        );
        if (affordableSkill) {
          performPlayerAction('skill', affordableSkill.id);
        } else {
          performPlayerAction('attack');
        }
      } else {
        performPlayerAction('attack');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [autoBattle.enabled, isInCombat, isCombatEnded, activeMonster, turnPhase, player, combatPlayerHp, combatPlayerMp, combatStats.maxHp, performPlayerAction]);

  const toggleAutoBattle = useCallback(() => {
    if (!premium.active) {
      triggerHaptic('error');
      setAutoBattle(prev => ({ ...prev, enabled: false }));
      return;
    }
    setAutoBattle(prev => {
      const nextState = !prev.enabled;
      triggerHaptic(nextState ? 'medium' : 'light');
      return { ...prev, enabled: nextState };
    });
  }, [premium.active]);

  const updateAutoBattleSettings = useCallback((settings: Partial<AutoBattleSettings>) => {
    setAutoBattle(prev => ({ ...prev, ...settings }));
  }, []);

  const exitCombat = useCallback(() => {
    setIsInCombat(false);
    setMonsterIntent(null);
    setCombatChain(null);
    setActiveMonster(null);
    setIsCombatEnded(false);
    setCombatOutcome(null);
    setTurnPhase('player');
    if (!activeDungeonRun) {
      setCombatPlayerHp(combatStats.maxHp);
      setCombatPlayerMp(combatStats.maxMp);
    }
    setBattleLog([]);
  }, [combatStats.maxHp, combatStats.maxMp, activeDungeonRun]);

  // Exploration & Regions
  const setCurrentRegion = useCallback((regionId: string) => {
    const region = REGIONS.find(r => r.id === regionId);
    if (!region) return;
    setPlayer(prev => prev && prev.level >= region.minLevel ? { ...prev, currentRegionId: regionId } : prev);
    sound.playClick();
  }, []);

  // Procedural Dungeons
  const enterDungeon = useCallback((caveId: string, difficulty: DungeonRun['difficulty'] = 'normal') => {
    if (!player || player.energy < ENERGY_COSTS.dungeon) { triggerHaptic('error'); return; }
    if (activeDungeonRun || travelState.isTraveling || isInCombat && !isCombatEnded || player.miningExpedition && !premium.active) { triggerHaptic('error'); return; }
    const cave = CAVES[caveId];
    if (!cave) return;
    const caveRegion = REGIONS.find(region => region.id === cave.regionId) || REGIONS[0];
    sound.playClick();
    triggerHaptic('medium');

    const rooms: DungeonRun['rooms'] = [];
    for (let i = 1; i <= cave.roomsCount; i++) {
      if (i === cave.roomsCount) {
        // Boss Room
        const bossMonster = getRegionMonster(MONSTERS[cave.bossMonsterId] || MONSTERS['m_queen_bat'], caveRegion, Math.max(cave.minLevel, caveRegion.minLevel));
        rooms.push({
          id: `room_${caveId}_${i}`,
          roomNumber: i,
          type: 'boss',
          title: `Тронный зал: ${bossMonster.name}`,
          description: `Огромная зала с древними колоннами. Здесь вас ожидает владыка подземелья.`,
          resolved: false,
          monster: { ...bossMonster }
        });
      } else {
        const roomTypeRand = Math.random();
        if (roomTypeRand < 0.5) {
          // Combat
          const mList = caveRegion.monsters.map(id => MONSTERS[id]).filter((m): m is Monster => Boolean(m) && m.id !== cave.bossMonsterId);
          const encounters = mList.length ? mList : Object.values(MONSTERS).filter(m => !m.isBoss);
          const chosenMonster = getRegionMonster(encounters[Math.floor(Math.random() * encounters.length)], caveRegion, Math.max(cave.minLevel, caveRegion.minLevel));
          rooms.push({
            id: `room_${caveId}_${i}`,
            roomNumber: i,
            type: 'combat',
            title: `Комната ${i}: Стражи подземелья`,
            description: `Темный сырой коридор. Впереди слышны тяжелые шаги чудовища.`,
            resolved: false,
            monster: { ...chosenMonster }
          });
        } else if (roomTypeRand < 0.75) {
          // Treasure
          rooms.push({
            id: `room_${caveId}_${i}`,
            roomNumber: i,
            type: 'treasure',
            title: `Комната ${i}: Заброшенная сокровищница`,
            description: `Среди обломков камней сверкает древний сундук, покрытый рунами.`,
            resolved: false
          });
        } else {
          // Shrine
          rooms.push({
            id: `room_${caveId}_${i}`,
            roomNumber: i,
            type: 'shrine',
            title: `Комната ${i}: Алтарь древних богов`,
            description: `Таинственный алтарь испускает целительный лазурный свет.`,
            resolved: false
          });
        }
      }
    }

    const run: DungeonRun = {
      dungeonId: caveId,
      dungeonName: cave.name,
      difficulty,
      totalRooms: cave.roomsCount,
      currentRoomIndex: 0,
      rooms,
      completed: false
    };

    setActiveDungeonRun(run);
    setPlayer(prev => prev ? { ...prev, energy: Math.max(0, prev.energy - ENERGY_COSTS.dungeon) } : prev);
  }, [player, activeDungeonRun, travelState.isTraveling, isInCombat, isCombatEnded, premium.active]);

  const proceedDungeonRoom = useCallback((choice?: 'fight' | 'open' | 'pray' | 'disarm') => {
    if (!activeDungeonRun) return;
    if (activeDungeonRun.completed || isInCombat && !isCombatEnded) return;
    const currentRoom = activeDungeonRun.rooms[activeDungeonRun.currentRoomIndex];
    if (!currentRoom || currentRoom.resolved) return;

    if (currentRoom.type === 'combat' || currentRoom.type === 'boss') {
      if (!currentRoom.monster) return;
      const started = startBattleWithMonster(currentRoom.monster, { chain: false, energyCost: 0 });
      if (!started) return;
      // Combat rooms are resolved only by completeCombatVictory().
      return;
    }

    if (currentRoom.type === 'elite') {
      if (!currentRoom.monster) return;
      const started = startBattleWithMonster({ ...currentRoom.monster, isElite: true }, { chain: false, energyCost: 0 });
      if (!started) return;
      return;
    }

    if (currentRoom.type === 'treasure') {
      const reward = rollDungeonChest(CAVES[activeDungeonRun.dungeonId]?.minLevel || 1);
      setPlayer(prev => prev ? { ...prev, gold: prev.gold + reward.gold, silver: prev.silver + reward.silver } : prev);
      setActiveDungeonRun(run => run ? { ...run, lastEvent: reward.gold
        ? `🎁 Сундук открыт: +${reward.gold} золота, +${reward.silver} серебра. Награда зачислена.`
        : '📦 Сундук оказался пустым.' } : run);
      sound.playUpgradeSuccess();
      triggerHaptic('success');
    } else if (currentRoom.type === 'shrine') {
      const blessing = rollDungeonBlessing();
      if (blessing) sound.playPotion();
      triggerHaptic('medium');
      setActiveDungeonRun(run => run ? { ...run,
        temporaryBlessing: blessing || run.temporaryBlessing,
        lastEvent: blessing ? '✨ Благословение хранителя: +10% физической и магической атаки и защиты до следующих 3 побед в этом походе. Повторное благословение обновляет срок.' : '🕯️ Алтарь не ответил. Новое благословение не получено.'
      } : run);
    } else if (currentRoom.type === 'trap') {
      const trapDamage = Math.max(10, Math.round(combatStats.maxHp * 0.08));
      setCombatPlayerHp(prev => Math.max(1, prev - trapDamage));
      setActiveDungeonRun(run => run ? { ...run, savedHp: Math.max(1, (run.savedHp ?? combatStats.maxHp) - trapDamage) } : run);
    } else if (currentRoom.type === 'merchant') {
      const merchantCost = 100;
      setPlayer(prev => prev && prev.gold >= merchantCost ? { ...prev, gold: prev.gold - merchantCost } : prev);
    }

    setActiveDungeonRun(prevRun => {
      if (!prevRun) return prevRun;
      const index = prevRun.currentRoomIndex;
      const rooms = prevRun.rooms.map((room, roomIndex) =>
        roomIndex === index ? { ...room, resolved: true, rewardClaimed: true } : room
      );
      const isLast = index >= prevRun.totalRooms - 1;
      return {
        ...prevRun,
        rooms,
        currentRoomIndex: isLast ? index : index + 1,
        completed: isLast
      };
    });
  }, [activeDungeonRun, startBattleWithMonster, combatStats.maxHp, combatStats.maxMp, isInCombat, isCombatEnded]);

  const exitDungeon = useCallback(() => {
    exitCombat();
    setActiveDungeonRun(null);
    sound.playClick();
  }, [exitCombat]);

  const startMiningExpedition = useCallback((hours: 1 | 3 | 7): { success: boolean; message: string } => {
    if (!player) return { success: false, message: 'Персонаж не найден.' };
    if (premium.active) return { success: false, message: 'Premium добывает ресурсы офлайн автоматически — запускать экспедицию не нужно.' };
    if (player.miningExpedition) return { success: false, message: 'Шахтёрская экспедиция уже идёт.' };

    const now = Date.now();
    const rewards = generateMiningExpeditionRewards(hours, player.miningLevel);
    setPlayer(prev => prev ? {
      ...prev,
      miningExpedition: {
        durationHours: hours,
        startedAt: now,
        endsAt: now + hours * 60 * 60 * 1000,
        rewards
      }
    } : prev);

    triggerHaptic('medium');
    sound.playMining();
    return { success: true, message: `Экспедиция на ${hours} ч. началась.` };
  }, [player, premium.active]);

  const leaveMiningExpedition = useCallback((): { success: boolean; message: string } => {
    if (!player?.miningExpedition) return { success: false, message: 'Персонаж сейчас не в шахте.' };

    const expedition = player.miningExpedition;
    const elapsed = Math.max(0, Date.now() - expedition.startedAt);
    const total = Math.max(1, expedition.endsAt - expedition.startedAt);
    const progress = Math.min(1, elapsed / total);
    const payoutRatio = Math.max(0, Math.min(1, progress * 0.85));
    const minimumElapsedMs = 5 * 60 * 1000;

    let partialRewards: MiningExpeditionReward[] = [];
    if (elapsed >= minimumElapsedMs && payoutRatio > 0) {
      partialRewards = (expedition.rewards || [])
        .map(reward => ({ ...reward, count: Math.floor(reward.count * payoutRatio) }))
        .filter(reward => reward.count > 0);

      if (partialRewards.length === 0 && expedition.rewards?.length) {
        const first = expedition.rewards[0];
        partialRewards = [{ ...first, count: 1 }];
      }
    }

    const added = addMiningRewardsToInventory(player.inventory, partialRewards, player.maxInventorySlots);
    if (!added.added) {
      return { success: false, message: 'Освободите место в рюкзаке перед выходом с шахты.' };
    }

    const minedCount = partialRewards.reduce((sum, reward) => sum + reward.count, 0);
    setPlayer(prev => prev ? {
      ...prev,
      inventory: added.inventory,
      miningExp: prev.miningExp + Math.max(0, Math.round(expedition.durationHours * 25 * payoutRatio)),
      miningExpedition: undefined,
      statsSummary: {
        ...prev.statsSummary,
        oresMined: prev.statsSummary.oresMined + minedCount
      }
    } : prev);

    if (minedCount > 0) {
      setQuests(prev => prev.map(q => q.category === 'mining'
        ? { ...q, currentCount: Math.min(q.targetCount, q.currentCount + minedCount), completed: q.currentCount + minedCount >= q.targetCount }
        : q
      ));
      setAchievements(prev => prev.map(a => {
        if (a.id !== 'ach_4') return a;
        const progressValue = Math.min(a.maxProgress, a.progress + minedCount);
        return { ...a, progress: progressValue, completed: progressValue >= a.maxProgress };
      }));
    }

    triggerHaptic('warning');
    return {
      success: true,
      message: minedCount > 0
        ? `Вы ушли с шахты раньше и сохранили ${minedCount} ед. уже добытых ресурсов.`
        : 'Вы ушли с шахты слишком рано — добыть ничего не успели.'
    };
  }, [player]);

  const claimMiningExpedition = useCallback((): { success: boolean; message: string } => {
    if (!player?.miningExpedition) return { success: false, message: 'Нет активной экспедиции.' };
    if (Date.now() < player.miningExpedition.endsAt) return { success: false, message: 'Экспедиция ещё не завершена.' };

    const rewards = player.miningExpedition.rewards || [];
    const added = addMiningRewardsToInventory(player.inventory, rewards, player.maxInventorySlots);
    if (!added.added) return { success: false, message: 'Освободите место в рюкзаке для добычи.' };

    const minedCount = rewards.reduce((sum, reward) => sum + reward.count, 0);
    const durationHours = player.miningExpedition.durationHours;
    setPlayer(prev => {
      if (!prev?.miningExpedition) return prev;
      const miningExp = prev.miningExp + durationHours * 25;
      let miningLevel = prev.miningLevel;
      while (miningExp >= miningLevel * 175 && miningLevel < 100) miningLevel += 1;
      return {
        ...prev,
        inventory: added.inventory,
        miningExp,
        miningLevel,
        miningExpedition: undefined,
        statsSummary: {
          ...prev.statsSummary,
          oresMined: prev.statsSummary.oresMined + minedCount
        }
      };
    });
    setQuests(prev => prev.map(q => q.category === 'mining'
      ? { ...q, currentCount: Math.min(q.targetCount, q.currentCount + minedCount), completed: q.currentCount + minedCount >= q.targetCount }
      : q
    ));
    setAchievements(prev => prev.map(a => {
      if (a.id !== 'ach_4') return a;
      const progress = Math.min(a.maxProgress, a.progress + minedCount);
      return { ...a, progress, completed: progress >= a.maxProgress };
    }));

    triggerHaptic('success');
    sound.playUpgradeSuccess();
    return { success: true, message: `Экспедиция завершена: получено ${minedCount} ресурсов.` };
  }, [player]);

  // Mining
  const mineNode = useCallback((nodeId: string): { success: boolean; yieldCount: number; isCrit: boolean; oreName: string } => {
    if (!player) return { success: false, yieldCount: 0, isCrit: false, oreName: '' };

    const node = MINING_NODES.find(n => n.id === nodeId);
    if (!node) return { success: false, yieldCount: 0, isCrit: false, oreName: '' };
    if (player.miningLevel < node.levelReq) {
      triggerHaptic('error');
      return { success: false, yieldCount: 0, isCrit: false, oreName: node.oreYield };
    }
    if (player.stamina < node.staminaCost) {
      triggerHaptic('error');
      return { success: false, yieldCount: 0, isCrit: false, oreName: node.oreYield };
    }

    const oreTemplate = 'ore_' + node.id.replace(/^ore_/, '');
    const existingOre = player.inventory.find(i => i.templateId === oreTemplate && i.type === 'ore');
    if (!existingOre && player.inventory.length >= player.maxInventorySlots) {
      triggerHaptic('error');
      return { success: false, yieldCount: 0, isCrit: false, oreName: node.oreYield };
    }

    const miningAchievementBonus = achievements.some(a => a.id === 'ach_4' && a.claimed) ? 0.10 : 0;
    const isCrit = Math.random() < Math.min(0.75, 0.25 + player.attributes.luck * 0.003 + miningAchievementBonus);
    const baseYield = Math.floor(node.baseYieldMin + Math.random() * (node.baseYieldMax - node.baseYieldMin + 1));
    const yieldCount = isCrit ? Math.max(baseYield + 1, Math.ceil(baseYield * 1.5)) : baseYield;

    let inventory = [...player.inventory];
    const oreItem: GameItem = {
      id: 'ore_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      templateId: oreTemplate,
      name: node.oreYield,
      type: 'ore',
      rarity: isCrit ? 'rare' : 'common',
      level: Math.max(1, node.levelReq),
      upgradeLevel: 0,
      icon: node.icon,
      description: `Добытая руда из жилы «${node.name}».`,
      stats: {},
      sellPrice: Math.max(2, Math.round(10 + node.levelReq * 2)),
      disassembleYield: { ore: 1 },
      stackCount: yieldCount
    };

    const oreAdded = addOrStackInventoryItem(inventory, oreItem, player.maxInventorySlots);
    if (!oreAdded.added) return { success: false, yieldCount: 0, isCrit: false, oreName: node.oreYield };
    inventory = oreAdded.inventory;

    const bonusMaterialsFound: string[] = [];
    for (const bonus of MINING_BONUS_MATERIALS[node.id] || []) {
      if (Math.random() > bonus.chance) continue;
      const count = bonus.minQty + Math.floor(Math.random() * (bonus.maxQty - bonus.minQty + 1));
      const bonusItem: GameItem = {
        id: 'mine_mat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        templateId: 'mine_mat_' + bonus.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_'),
        name: bonus.name,
        type: 'material',
        rarity: bonus.rarity,
        level: node.levelReq,
        upgradeLevel: 0,
        icon: bonus.icon,
        description: `Редкий материал из жилы «${node.name}».`,
        stats: {},
        sellPrice: Math.max(5, node.levelReq * 2),
        disassembleYield: { silver: Math.max(2, Math.floor(node.levelReq / 3)) },
        stackCount: count
      };
      const bonusAdded = addOrStackInventoryItem(inventory, bonusItem, player.maxInventorySlots);
      if (bonusAdded.added) {
        inventory = bonusAdded.inventory;
        bonusMaterialsFound.push(`${bonus.name} ×${count}`);
      }
    }

    let gemFound = false;
    if (Math.random() < node.gemChance) {
      const gemItem: GameItem = {
        id: 'gem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        templateId: 'mining_gem',
        name: 'Сырой самоцвет',
        type: 'material',
        rarity: 'rare',
        level: node.levelReq,
        upgradeLevel: 0,
        icon: '💎',
        description: 'Самоцвет, найденный в руде.',
        stats: {},
        sellPrice: 35 + node.levelReq,
        disassembleYield: { silver: 80 },
        stackCount: 1 + Math.floor(Math.random() * 2)
      };
      const gemAdded = addOrStackInventoryItem(inventory, gemItem, player.maxInventorySlots);
      if (gemAdded.added) {
        inventory = gemAdded.inventory;
        gemFound = true;
      }
    }

    const miningExp = player.miningExp + Math.max(8, node.levelReq * 2 + 6);
    let miningLevel = player.miningLevel;
    while (miningExp >= miningLevel * 175 && miningLevel < 100) miningLevel += 1;

    const result = { success: true, yieldCount, isCrit, oreName: bonusMaterialsFound.length ? `${node.oreYield} + ${bonusMaterialsFound.join(', ')}` : node.oreYield };

    setPlayer(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        stamina: Math.max(0, prev.stamina - node.staminaCost),
        miningExp,
        miningLevel,
        inventory,
        statsSummary: { ...prev.statsSummary, oresMined: prev.statsSummary.oresMined + yieldCount }
      };
    });

    setQuests(qList => qList.map(q => {
      if (q.category !== 'mining') return q;
      const count = Math.min(q.targetCount, q.currentCount + yieldCount);
      return { ...q, currentCount: count, completed: count >= q.targetCount };
    }));
    setAchievements(aList => aList.map(a => {
      if (a.id !== 'ach_4') return a;
      const progress = Math.min(a.maxProgress, a.progress + yieldCount);
      return { ...a, progress, completed: progress >= a.maxProgress };
    }));

    sound.playMining();
    triggerHaptic('medium');
    if (gemFound) sound.playUpgradeSuccess();

    return result;
  }, [player, achievements]);

  const craftBasicItem = useCallback((recipeId: string): { success: boolean; message: string } => {
    if (!player) return { success: false, message: 'Персонаж не найден.' };
    const recipe = BASIC_CRAFT_RECIPES.find(r => r.id === recipeId);
    if (!recipe) return { success: false, message: 'Рецепт не найден.' };
    if (player.level < (recipe.levelReq || 1)) return { success: false, message: `Нужен ${recipe.levelReq}-й уровень персонажа.` };
    if (player.miningLevel < (recipe.miningLevelReq || 1)) return { success: false, message: `Нужен ${recipe.miningLevelReq}-й уровень шахты.` };
    const ingredients = recipe.ingredients;

    for (const ingredient of ingredients) {
      const have = countIngredient(player.inventory, ingredient.name);
      if (have < ingredient.count) {
        return { success: false, message: `Не хватает: ${ingredient.name} ×${ingredient.count}.` };
      }
    }

    let inventory = consumeIngredients(player.inventory, ingredients);
    const quality = recipe.result && ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'].includes(recipe.result.type)
      ? rollCraftRarity() : null;
    const baseLevel = recipe.result?.level || Math.max(1, Math.min(10, player.level));
    const range = getEquipmentLevelRange(baseLevel);
    const outputLevel = quality ? range.min + Math.floor(Math.random() * (range.max - range.min + 1)) : baseLevel;
    const outputUpgrade = quality ? rollCraftUpgrade() : 0;
    const outputName = recipe.result ? getLeveledEquipmentName(recipe.result.name, recipe.result.type, outputLevel, recipe.result.targetClass) : recipe.name;
    const levelMultiplier = quality ? (10 + outputLevel) / (10 + baseLevel) : 1;

    if (recipe.result) {
      const rawOutput: GameItem = {
        id: 'basic_craft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        templateId: recipe.id,
        name: outputName,
        type: recipe.result.type,
        targetClass: recipe.result.targetClass,
        rarity: quality?.rarity || recipe.result.rarity,
        level: outputLevel,
        upgradeLevel: outputUpgrade,
        icon: recipe.result.icon,
        description: quality ? `${recipe.description} Качество: ${RARITY_COLORS[quality.rarity].label}.` : recipe.description,
        stats: Object.fromEntries(Object.entries(recipe.result.stats).map(([stat, value]) => [
          stat, quality && !['speed', 'critChance', 'evasion'].includes(stat) ? Math.round(value * quality.multiplier * levelMultiplier) : value
        ])),
        sellPrice: Math.round(recipe.result.sellPrice * (quality?.multiplier || 1)),
        disassembleYield: { silver: Math.max(4, Math.round(recipe.result.sellPrice * (quality?.multiplier || 1) * 0.35)) },
        stackCount: recipe.result.count
      };
      const output = applyClassGear(rawOutput);
      output.name = getLeveledEquipmentName(output.name, output.type, output.level, output.targetClass);
      const added = addOrStackInventoryItem(inventory, output, player.maxInventorySlots);
      if (!added.added) return { success: false, message: 'Нет места для результата крафта.' };
      inventory = added.inventory;
    }

    setPlayer(prev => prev ? {
      ...prev,
      inventory,
      silver: prev.silver + (recipe.silverReward || 0)
    } : prev);

    sound.playUpgradeSuccess();
    triggerHaptic('success');
    return {
      success: true,
      message: recipe.silverReward
        ? `Переработано: +${recipe.silverReward} серебра.`
        : `Создано: ${outputName}${quality ? ` (${RARITY_COLORS[quality.rarity].label}, ур. ${outputLevel}${outputUpgrade ? `, +${outputUpgrade}` : ''})` : ''}.`
    };
  }, [player]);

  // Alchemy
  const craftAlchemy = useCallback((recipeId: string): boolean => {
    if (!player) return false;

    const recipe = ALCHEMY_RECIPES.find(r => r.id === recipeId);
    if (!recipe || player.alchemyLevel < recipe.levelReq) {
      triggerHaptic('error');
      return false;
    }

    const alchemyEnergyCost = Math.max(4, Math.min(20, 4 + Math.floor(recipe.levelReq / 5)));
    if (player.alchemyEnergy < alchemyEnergyCost) {
      triggerHaptic('error');
      return false;
    }

    for (const ingredient of recipe.ingredients) {
      const have = player.inventory.reduce(
        (sum, item) => sum + (item.name === ingredient.name ? (item.stackCount || 1) : 0),
        0
      );
      if (have < ingredient.count) {
        triggerHaptic('error');
        return false;
      }
    }

    let inventory = player.inventory.map(item => ({ ...item }));
    for (const ingredient of recipe.ingredients) {
      let remaining = ingredient.count;
      inventory = inventory
        .map(item => {
          if (remaining <= 0 || item.name !== ingredient.name) return item;
          const stack = item.stackCount || 1;
          const take = Math.min(stack, remaining);
          remaining -= take;
          return { ...item, stackCount: stack - take };
        })
        .filter(item => (item.stackCount || 0) > 0);
    }

    const resultStats: Record<string, number> =
      recipe.id === 'alc_hp_small' ? { heal: 120 } :
      recipe.id === 'alc_mp_small' ? { manaRestore: 80 } :
      recipe.id === 'alc_hp_great' ? { heal: 650 } :
      recipe.id === 'alc_berserk' ? { attackPercent: 25, critChance: 15, buffDuration: 5 } :
      recipe.id === 'alc_stoneskin' ? { defensePercent: 40, buffDuration: 5 } :
      recipe.id === 'alc_dragon_blood' ? { healFull: 1, invulnerable: 1 } :
      {};

    const output: GameItem = {
      id: 'pot_crafted_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      templateId: recipe.id,
      name: recipe.resultItem,
      type: 'potion',
      rarity: recipe.levelReq >= 50 ? 'mythic' : recipe.levelReq >= 30 ? 'epic' : recipe.levelReq >= 15 ? 'rare' : 'uncommon',
      level: Math.max(1, recipe.levelReq),
      upgradeLevel: 0,
      icon: recipe.icon,
      description: recipe.description,
      stats: resultStats,
      sellPrice: Math.max(10, recipe.levelReq * 4),
      disassembleYield: { silver: Math.max(4, Math.floor(recipe.levelReq * 3)) },
      stackCount: recipe.resultCount
    };

    const canStack = inventory.some(item =>
      item.templateId === output.templateId &&
      item.type === output.type &&
      item.name === output.name &&
      item.rarity === output.rarity
    );
    if (!canStack && inventory.length >= player.maxInventorySlots) {
      triggerHaptic('error');
      return false;
    }

    const added = addOrStackInventoryItem(inventory, output, player.maxInventorySlots);
    if (!added.added) {
      triggerHaptic('error');
      return false;
    }

    const professionXp = Math.max(6, 6 + Math.floor(recipe.levelReq * 0.8));
    const alchemyExp = player.alchemyExp + professionXp;
    let alchemyLevel = player.alchemyLevel;
    while (alchemyExp >= alchemyLevel * 220 && alchemyLevel < 100) alchemyLevel += 1;

    setPlayer(prev => prev ? {
      ...prev,
      inventory: added.inventory,
      alchemyEnergy: Math.max(0, prev.alchemyEnergy - alchemyEnergyCost),
      alchemyExp,
      alchemyLevel,
      statsSummary: {
        ...prev.statsSummary,
        potionsCrafted: prev.statsSummary.potionsCrafted + recipe.resultCount
      }
    } : prev);

    sound.playPotion();
    triggerHaptic('success');
    return true;
  }, [player]);

  // Arena
  const challengeArena = useCallback((opponent: ArenaOpponent): boolean => {
    if (!player || player.arenaTickets <= 0 || activeDungeonRun) {
      triggerHaptic('error');
      sound.playUpgradeFail();
      return false;
    }
    sound.playClick();
    triggerHaptic('heavy');
    // Convert opponent to monster model for battle engine
    const oppMonster: Monster = {
      id: opponent.id,
      name: `Гладиатор ${opponent.name}`,
      regionId: 'arena',
      level: opponent.level,
      hp: opponent.stats.hp,
      maxHp: opponent.stats.hp,
      mp: 100,
      maxMp: 100,
      attack: opponent.stats.attack,
      magicAttack: Math.floor(opponent.stats.attack * 0.7),
      defense: opponent.stats.defense,
      magicDefense: Math.floor(opponent.stats.defense * 0.8),
      speed: opponent.stats.speed,
      critChance: opponent.stats.critChance,
      evasion: 10,
      isBoss: false,
      avatar: opponent.avatar,
      expReward: opponent.level * 80,
      goldReward: opponent.level * 60,
      drops: [
        { itemName: 'Жетон чемпиона Арены', type: 'material', rarity: 'epic', chance: 1.0, minQty: 1, maxQty: 2 }
      ]
    };

    const started = startBattleWithMonster(oppMonster, { chain: false, energyCost: 0 });
    if (started) {
      setPlayer(prev => prev ? { ...prev, arenaTickets: Math.max(0, prev.arenaTickets - 1) } : prev);
    }
    return started;
  }, [player, activeDungeonRun, startBattleWithMonster]);

  // Quests & Achievements Claims
  const claimQuestReward = useCallback((questId: string) => {
    setQuests(prev => prev.map(q => {
      if (q.id !== questId || !q.completed || q.claimed) return q;
      sound.playVictory();
      triggerHaptic('success');
      setPlayer(p => {
        if (!p) return p;
        const xpResult = addExperience(p, q.rewardExp);
        let rewardInventory = [...xpResult.player.inventory];
        (q.rewardItems || []).forEach((name, index) => {
          const reward: GameItem = {
            id: `quest_reward_${q.id}_${Date.now()}_${index}`,
            templateId: `quest_${q.id}_${index}`,
            name,
            type: name.toLowerCase().includes('зелье') ? 'potion' : 'material',
            rarity: q.category === 'boss' ? 'rare' : 'uncommon',
            level: Math.max(1, xpResult.player.level),
            upgradeLevel: 0,
            icon: name.toLowerCase().includes('зелье') ? '🧪' : '📦',
            description: `Награда за задание «${q.title}».`,
            stats: name.toLowerCase().includes('зелье') ? { heal: 150 } : {},
            sellPrice: Math.max(15, q.rewardGold / 10),
            disassembleYield: { silver: Math.max(5, Math.round(q.rewardGold / 25)) },
            stackCount: 1
          };
          rewardInventory = addOrStackInventoryItem(rewardInventory, reward, xpResult.player.maxInventorySlots).inventory;
        });
        return {
          ...xpResult.player,
          inventory: rewardInventory,
          gold: xpResult.player.gold + q.rewardGold,
          silver: xpResult.player.silver + (q.rewardSilver || 0),
        };
      });
      return { ...q, claimed: true };
    }));
  }, []);

  const claimAchievementReward = useCallback((achievementId: string) => {
    setAchievements(prev => prev.map(a => {
      if (a.id !== achievementId || !a.completed || a.claimed) return a;
      sound.playLevelUp();
      triggerHaptic('success');
      setPlayer(p => p ? {
        ...p,
        gold: p.gold + a.rewardGold,
        silver: p.silver + (a.rewardSilver || 0)
      } : p);
      return { ...a, claimed: true };
    }));
  }, []);

  // Chat
  const sendChatMessage = useCallback((text: string, channel: 'global' | 'clan') => {
    if (!text.trim() || !player) return;
    sound.playClick();
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: player.name,
      isVip: premium.active,
      clanTag: player.clanId ? 'GUILD' : undefined,
      text: text.trim(),
      channel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, newMsg]);
  }, [player, premium.active]);

  const dismissOfflineReport = useCallback(() => {
    setOfflineReport(null);
  }, []);

  // ADMIN COMMANDS
  const adminAddGold = useCallback((amt: number) => {
    if (!isCurrentUserAdmin()) return;
    setPlayer(p => p ? { ...p, gold: p.gold + amt } : p);
    sound.playVictory();
  }, []);

  const adminAddSilver = useCallback((amt: number) => {
    if (!isCurrentUserAdmin()) return;
    setPlayer(p => p ? { ...p, silver: p.silver + amt } : p);
    sound.playVictory();
  }, []);

  const adminLevelUp = useCallback(() => {
    if (!isCurrentUserAdmin()) return;
    setPlayer(p => {
      if (!p) return p;
      return addExperience(p, p.nextExp).player;
    });
    sound.playLevelUp();
  }, []);

  const adminSpawnLegendaryItem = useCallback(() => {
    if (!isCurrentUserAdmin()) return;
    setPlayer(p => {
      if (!p) return p;
      const relic: GameItem = {
        id: 'relic_' + Date.now(),
        templateId: 'relic_divine_sword',
        name: 'Крушитель Богов Аэтельгарда',
        type: 'weapon',
        rarity: 'ancient',
        level: p.level,
        upgradeLevel: 10,
        icon: '🗡️',
        description: 'Древний артефакт, выкованный в недрах Первородного Разлома.',
        baseAttack: 120 + p.level * 15,
        stats: {
          attack: 120 + p.level * 15,
          critChance: 25,
          critDamage: 80,
          vampirism: 12,
          speed: 15
        },
        sellPrice: 15000,
        disassembleYield: { silver: 200, ore: 25 }
      };
      sound.playVictory();
      return {
        ...p,
        inventory: [relic, ...p.inventory]
      };
    });
  }, []);

  const adminHealAll = useCallback(() => {
    if (!isCurrentUserAdmin()) return;
    sound.playPotion();
    triggerHaptic('success');
  }, []);

  return (
    <GameContext.Provider value={{
      player,
      activeMonster,
      combatChain: combatChain ? { total: combatChain.total, defeated: combatChain.defeated, remaining: combatChain.queue.length } : null,
      battleLog,
      combatRound,
      lastCombatReward,
      isInCombat,
      isCombatEnded,
      combatOutcome,
      combatPlayerHp,
      combatPlayerMp,
      turnPhase,
      playerEffects,
      monsterEffects,
      monsterIntent,
      comboReady: lastCast && combatRound - lastCast.turn <= 3 ? player?.skills.filter(s => s.comboFrom === lastCast.id).map(s => s.id) || [] : [],
      autoBattle,
      activeDungeonRun,
      quests,
      achievements,
      chatMessages,
      onlinePlayersCount,
      combatStats,
      offlineReport,
      travelState,
      premium,
      createCharacter,
      resetCharacter,
      allocateAttribute,
      unlockTalent,
      equipItem,
      unequipItem,
      sellItem,
      disassembleItem,
      toggleItemLock,
      refreshServerInventory,
      expandInventory,
      upgradeItem,
      meditateOrRefillEnergy,
      setActiveRegionMod,
      setActivePet,
      craftPet,
      startBattleWithMonster,
      startNextCombatBattle,
      performPlayerAction,
      toggleAutoBattle,
      updateAutoBattleSettings,
      exitCombat,
      setCurrentRegion,
      startTravel,
      enterDungeon,
      proceedDungeonRoom,
      exitDungeon,
      mineNode,
      startMiningExpedition,
      claimMiningExpedition,
      leaveMiningExpedition,
      craftAlchemy,
      listMarketItem,
      refreshMarketIncome,
      buyMarketListing,
      buyBasicConsumable,
      craftBasicItem,
      refreshPremiumStatus,
      preparePremiumInvoice,
      purchasePremium,
      challengeArena,
      claimQuestReward,
      claimAchievementReward,
      sendChatMessage,
      dismissOfflineReport,
      adminAddGold,
      adminAddSilver,
      adminLevelUp,
      adminSpawnLegendaryItem,
      adminHealAll
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
