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
  RegionModifier
} from '../types/game';
import { 
  CLASSES, 
  REGIONS, 
  CAVES, 
  MONSTERS, 
  STARTER_ITEMS, 
  INITIAL_QUESTS, 
  INITIAL_ACHIEVEMENTS, 
  PETS_LIST, 
  ARENA_BOTS,
  ASSETS,
  REGION_MODIFIERS,
  MINING_NODES,
  ALCHEMY_RECIPES
} from '../data/gameData';
import { sound } from '../utils/audio';
import { getTelegramUser, triggerHaptic, TelegramUser } from '../utils/telegram';
import { generateCombatLoot } from '../utils/lootGenerator';
import { addExperience, getNextExperience } from '../utils/progression';
import { applyStatusEffect, getStatusModifiers, tickStatusEffects } from '../utils/statusEffects';
import { apiRequest } from '../utils/api';

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
  autoBattle: AutoBattleSettings;
  activeDungeonRun: DungeonRun | null;
  quests: Quest[];
  achievements: Achievement[];
  chatMessages: ChatMessage[];
  onlinePlayersCount: number;
  combatStats: CombatStats;
  offlineReport: { minutes: number; gold: number; exp: number; kills: number; itemsCount: number } | null;
  travelState: TravelState;
  
  // Actions
  createCharacter: (name: string, classId: CharacterClassId) => void;
  resetCharacter: () => void;
  allocateAttribute: (attr: keyof PlayerCharacter['attributes']) => void;
  unlockTalent: (talentId: string) => void;
  equipItem: (item: GameItem) => void;
  unequipItem: (type: ItemType) => void;
  sellItem: (item: GameItem) => void;
  disassembleItem: (item: GameItem) => void;
  expandInventory: () => void;
  upgradeItem: (item: GameItem, useProtection: boolean) => { success: boolean; message: string };
  meditateOrRefillEnergy: (mode: 'meditate' | 'silver' | 'potion') => void;
  setActiveRegionMod: (modId: string) => void;
  setActivePet: (petId: string) => boolean;
  
  // Combat
  startBattleWithMonster: (monster: Monster, options?: { chain?: boolean; energyCost?: number }) => boolean;
  startNextCombatBattle: () => boolean;
  performPlayerAction: (actionType: 'attack' | 'skill' | 'defend' | 'potion' | 'flee' | 'execute', skillId?: string) => void;
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
  craftAlchemy: (recipeId: string) => boolean;
  listMarketItem: (item: GameItem, quantity: number, priceGold: number) => Promise<{ success: boolean; message: string }>;
  buyMarketListing: (listingId: string, expectedPriceGold?: number) => Promise<{ success: boolean; message: string }>;
  buyBasicConsumable: (templateId: string, priceGold: number) => boolean;

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

const scaleMonsterForCombat = (monster: Monster, player: PlayerCharacter, stats: CombatStats): Monster => {
  const baseLevel = Math.max(1, monster.level);
  const targetLevel = Math.min(120, Math.max(baseLevel, player.level + (monster.isBoss ? 0 : Math.min(2, Math.floor(Math.max(0, player.level - baseLevel) / 10)))));
  const levelFactor = Math.min(3.2, Math.pow(targetLevel / baseLevel, 1.08));
  const basePower = monster.attack + monster.magicAttack * 0.75 + monster.defense * 0.65 + monster.hp / 14;
  const playerPower = stats.attack + stats.magicAttack * 0.75 + stats.defense * 0.65 + stats.maxHp / 14;
  const gearFactor = Math.min(2.5, Math.max(1, Math.pow(playerPower / Math.max(1, basePower), 0.58)));
  const roleFactor = monster.isBoss ? 1.3 : monster.isElite ? 1.15 : 0.95;
  const scale = Math.min(4.5, Math.max(1, levelFactor * gearFactor * roleFactor));
  const isBoss = Boolean(monster.isBoss);
  const hpFloor = stats.maxHp * (isBoss ? 2.0 : 0.72);
  const attackFloor = stats.attack * (isBoss ? 0.92 : 0.62);
  const magicAttackFloor = stats.magicAttack * (isBoss ? 0.9 : 0.58);
  const defenseFloor = stats.defense * (isBoss ? 0.86 : 0.56);
  const magicDefenseFloor = stats.magicDefense * (isBoss ? 0.84 : 0.54);

  return {
    ...monster,
    skills: getMonsterCombatSkills(monster),
    level: targetLevel,
    hp: Math.max(1, Math.round(Math.max(monster.maxHp * scale, hpFloor))),
    maxHp: Math.max(1, Math.round(Math.max(monster.maxHp * scale, hpFloor))),
    mp: Math.max(0, Math.round(monster.maxMp * Math.max(1, Math.min(3.5, scale)))),
    maxMp: Math.max(0, Math.round(monster.maxMp * Math.max(1, Math.min(3.5, scale)))),
    attack: Math.max(1, Math.round(Math.max(monster.attack * scale, attackFloor))),
    magicAttack: Math.max(0, Math.round(Math.max(monster.magicAttack * scale, magicAttackFloor))),
    defense: Math.max(0, Math.round(Math.max(monster.defense * scale, defenseFloor))),
    magicDefense: Math.max(0, Math.round(Math.max(monster.magicDefense * scale, magicDefenseFloor))),
    speed: Math.max(1, Math.round(monster.speed * Math.min(2.4, Math.max(1, scale * 0.9)))),
    critChance: Math.min(55, Math.round(monster.critChance + (targetLevel - baseLevel) * 0.45 + (isBoss ? 5 : 1))),
    evasion: Math.min(45, Math.round(monster.evasion + (targetLevel - baseLevel) * 0.25)),
    expReward: Math.max(monster.expReward, Math.round(monster.expReward * Math.min(4, Math.pow(scale, 0.82)))),
    goldReward: Math.max(1, Math.round(monster.goldReward * Math.min(2.25, Math.pow(scale, 0.42))))
  };
};

const buildCombatChain = (firstMonster: Monster, player: PlayerCharacter, stats: CombatStats, regionId: string) => {
  const region = REGIONS.find(r => r.id === regionId) || REGIONS[0];
  const normalPool = region.monsters
    .map(id => MONSTERS[id])
    .filter((m): m is Monster => Boolean(m) && !m.isBoss && !m.isElite);
  const pool = normalPool.length > 0 ? normalPool : [firstMonster];
  const count = firstMonster.isBoss || firstMonster.isElite ? 1 : 2 + Math.floor(Math.random() * 6);
  const chain: Monster[] = [scaleMonsterForCombat(firstMonster, player, stats)];
  for (let i = 1; i < count; i += 1) {
    const candidate = pool[Math.floor(Math.random() * pool.length)] || firstMonster;
    chain.push(scaleMonsterForCombat(candidate, player, stats));
  }
  return chain;
};

const getUpgradeOreRequirement = (currentLevel: number) => {
  const tiers = [
    { name: 'Уголь', icon: '🪨', min: 3 },
    { name: 'Медная руда', icon: '🟤', min: 4 },
    { name: 'Железная руда', icon: '⚪', min: 5 },
    { name: 'Серебряная руда', icon: '✨', min: 6 },
    { name: 'Золотая руда', icon: '🪙', min: 7 },
    { name: 'Мифриловая руда', icon: '💎', min: 8 },
    { name: 'Адамантит', icon: '🟣', min: 10 },
    { name: 'Драконит', icon: '🔥', min: 12 }
  ];
  const tier = tiers[Math.min(tiers.length - 1, Math.floor(currentLevel / 3))];
  return { ...tier, count: tier.min + Math.floor(currentLevel / 4) };
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

const SAVE_KEY = 'aethelgard_save_v1_data';
const ENERGY_COSTS = { travel: 10, dungeon: 15, combat: 2, mining: 8, alchemy: 5, upgrade: 4, inventory: 0, quest: 2 };

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerCharacter | null>(null);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [combatChain, setCombatChain] = useState<CombatChainState | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [combatRound, setCombatRound] = useState<number>(1);
  const [lastCombatReward, setLastCombatReward] = useState<{ gold: number; silver: number; exp: number; items: GameItem[] } | null>(null);
  const [isInCombat, setIsInCombat] = useState<boolean>(false);
  const [isCombatEnded, setIsCombatEnded] = useState<boolean>(false);
  const [combatOutcome, setCombatOutcome] = useState<'victory' | 'defeat' | 'flee' | null>(null);
  const [combatPlayerHp, setCombatPlayerHp] = useState<number>(100);
  const [combatPlayerMp, setCombatPlayerMp] = useState<number>(50);
  const [turnPhase, setTurnPhase] = useState<'player' | 'monster' | 'ended'>('player');
  const [playerEffects, setPlayerEffects] = useState<StatusEffect[]>([]);
  const [monsterEffects, setMonsterEffects] = useState<StatusEffect[]>([]);
  const [monsterIntent, setMonsterIntent] = useState<MonsterSkill | null>(null);
  const [activeDungeonRun, setActiveDungeonRun] = useState<DungeonRun | null>(null);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlinePlayersCount, setOnlinePlayersCount] = useState<number>(142);
  const [offlineReport, setOfflineReport] = useState<{ minutes: number; gold: number; exp: number; kills: number; itemsCount: number } | null>(null);

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

  const listMarketItem = useCallback(async (item: GameItem, quantity: number, priceGold: number) => {
    if (!player) return { success: false, message: 'Персонаж не создан.' };
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

  const buyMarketListing = useCallback(async (listingId: string, expectedPriceGold?: number) => {
    if (!player) return { success: false, message: 'Персонаж не создан.' };
    if (expectedPriceGold !== undefined && player.gold < expectedPriceGold) return { success: false, message: 'Недостаточно золота.' };
    try {
      const result = await apiRequest<{ item: Partial<GameItem>; quantity: number; priceGold: number }>('/api/market/' + listingId + '/buy', { method: 'POST', body: '{}' });
      if (!player) return { success: false, message: 'Персонаж не создан.' };
      if (player.gold < result.priceGold) return { success: false, message: 'Недостаточно золота.' };
      const raw = result.item;
      const item: GameItem = {
        id: String(raw.id || 'market_' + Date.now()), templateId: String(raw.templateId || 'market_item'), name: String(raw.name || 'Предмет'),
        type: (raw.type || 'material') as ItemType, rarity: (raw.rarity || 'common') as ItemRarity, level: Number(raw.level || 1),
        upgradeLevel: Number(raw.upgradeLevel || 0), icon: String(raw.icon || '📦'), description: raw.description,
        stats: raw.stats || {}, sellPrice: Number(raw.sellPrice || 1), disassembleYield: {}, stackCount: result.quantity
      };
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

  // Natural stamina regeneration (+1 every 10 seconds).
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayer(prev => {
        if (!prev || prev.stamina >= prev.maxStamina) return prev;
        return { ...prev, stamina: Math.min(prev.maxStamina, prev.stamina + 1) };
      });
    }, 10000);
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
            const cappedMins = Math.min(elapsedMins, 480); // max 8 hours
            const kills = Math.floor(cappedMins * 0.9);
            const goldEarned = kills * (8 + parsed.player.level * 2);
            const expEarned = kills * (16 + parsed.player.level * 4);
            
            parsed.player.gold += goldEarned;
            parsed.player = addExperience(parsed.player, expEarned).player;
            parsed.player.statsSummary.monstersKilled += kills;
            parsed.player.lastActiveTimestamp = now;

            setOfflineReport({
              minutes: cappedMins,
              gold: goldEarned,
              exp: expEarned,
              kills: kills,
              itemsCount: Math.floor(kills * 0.08)
            });
          }

          // Migrate old saves to the two-currency economy.
          const legacyShards = Number(parsed.player.shards || 0);
          const legacyCrystals = Number(parsed.player.crystals || 0);
          parsed.player.silver = Number(parsed.player.silver || 0) + legacyShards * 10 + legacyCrystals * 40;
          delete parsed.player.shards;
          delete parsed.player.crystals;
          delete parsed.player.arcaneEnergy;

          const migrateSalvage = (item: any) => {
            if (!item) return item;
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
          parsed.player.lastMeditationTimestamp = Number(parsed.player.lastMeditationTimestamp || 0);
          parsed.player.activeRegionModId = parsed.player.activeRegionModId || 'mod_standard';
          // Migrate old saves to the current steep XP curve.
          parsed.player.nextExp = getNextExperience(parsed.player.level);
          parsed.player = addExperience(parsed.player, 0).player;

          setPlayer(parsed.player);
          if (parsed.quests) {
            const savedQuestIds = new Set(parsed.quests.map((q: Quest) => q.id));
            const missingQuests = INITIAL_QUESTS.filter(q => !savedQuestIds.has(q.id));
            setQuests([...parsed.quests, ...missingQuests]);
          } else {
            setQuests(INITIAL_QUESTS);
          }
          if (parsed.achievements) setAchievements(parsed.achievements);
          if (parsed.chatMessages) setChatMessages(parsed.chatMessages);
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
      chatMessages: chatMessages.slice(-50)
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveState));
  }, [player, quests, achievements, chatMessages]);

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
      const upMult = 1 + item.upgradeLevel * 0.12; // +12% per sharpening level
      
      if (item.baseAttack) attack += Math.round(item.baseAttack * upMult);
      if (item.baseDefense) defense += Math.round(item.baseDefense * upMult);
      if (item.baseMagicDef) magicDefense += Math.round(item.baseMagicDef * upMult);

      if (item.stats) {
        Object.entries(item.stats).forEach(([stat, val]) => {
          if (stat === 'attack') attack += Math.round(val * upMult);
          else if (stat === 'magicAttack') magicAttack += Math.round(val * upMult);
          else if (stat === 'defense') defense += Math.round(val * upMult);
          else if (stat === 'magicDefense') magicDefense += Math.round(val * upMult);
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
      }
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
  }, [player, achievements]);

  // Character Creation
  const createCharacter = useCallback((name: string, classId: CharacterClassId) => {
    const classDef = CLASSES[classId];
    const starterGear = STARTER_ITEMS[classId] || [];
    const equipped: Partial<Record<ItemType, GameItem>> = {};
    const inventory: GameItem[] = [];

    // Equip primary weapon and armor, put others in bag
    starterGear.forEach((item, index) => {
      if (index === 0 && (item.type === 'weapon')) {
        equipped[item.type] = { ...item, isEquipped: true };
      } else if (index === 1 && item.type === 'armor') {
        equipped[item.type] = { ...item, isEquipped: true };
      } else {
        inventory.push({ ...item, isEquipped: false });
      }
    });

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
      miningLevel: 1,
      miningExp: 0,
      alchemyLevel: 1,
      alchemyExp: 0,
      arenaRating: 1000,
      arenaTickets: 5,
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

    setPlayer(newPlayer);
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
    if (player.activePet?.id === pet.id) return true;
    if (player.energy < ENERGY_COSTS.inventory) { triggerHaptic('error'); return false; }
    setPlayer(prev => prev ? {
      ...prev,
      activePet: pet,
      energy: Math.max(0, prev.energy - ENERGY_COSTS.inventory)
    } : prev);
    sound.playClick();
    triggerHaptic('success');
    return true;
  }, [player]);

  const allocateAttribute = useCallback((attr: keyof PlayerCharacter['attributes']) => {
    setPlayer(prev => {
      if (!prev || prev.statPoints <= 0) return prev;
      sound.playClick();
      triggerHaptic('light');
      return {
        ...prev,
        statPoints: prev.statPoints - 1,
        attributes: {
          ...prev.attributes,
          [attr]: prev.attributes[attr] + 1
        }
      };
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

  // Equipment & Inventory management
  const equipItem = useCallback((item: GameItem) => {
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
  }, []);

  const unequipItem = useCallback((type: ItemType) => {
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
  }, []);

  const sellItem = useCallback((item: GameItem) => {
    setPlayer(prev => {
      if (!prev || item.isEquipped) return prev;
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
  }, []);

  const disassembleItem = useCallback((item: GameItem) => {
    setPlayer(prev => {
      if (!prev || item.isEquipped) return prev;
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
  }, []);

  const expandInventory = useCallback(() => {
    setPlayer(prev => {
      if (!prev) return prev;
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
  }, []);

  // Blacksmith sharpening
  const upgradeItem = useCallback((item: GameItem, useProtection: boolean): { success: boolean; message: string } => {
    if (!player) return { success: false, message: 'Персонаж не найден.' };

    if (player.energy < ENERGY_COSTS.upgrade) return { success: false, message: `Недостаточно энергии (нужно ${ENERGY_COSTS.upgrade}).` };
    const currentLevel = item.upgradeLevel || 0;
    if (currentLevel >= 25) {
      return { success: false, message: 'Предмет достиг максимального уровня заточки (+25)!' };
    }

    const costGold = Math.round(120 * Math.pow(1.48, currentLevel));
    const costSilver = Math.round(80 * Math.pow(1.42, currentLevel));
    const protectionCost = useProtection ? Math.max(250, Math.round(costSilver * 1.5)) : 0;
    const oreReq = getUpgradeOreRequirement(currentLevel);
    const oreHave = player.inventory.reduce((sum, invItem) => sum + (invItem.name === oreReq.name ? (invItem.stackCount || 1) : 0), 0);
    if (player.gold < costGold) {
      return { success: false, message: `Недостаточно золота (нужно ${costGold} 🪙)!` };
    }
    if (player.silver < costSilver + protectionCost) {
      return { success: false, message: `Недостаточно серебра (нужно ${costSilver + protectionCost} 🥈${useProtection ? ' с защитой' : ''})!` };
    }
    if (oreHave < oreReq.count) {
      return { success: false, message: `Нужна руда: ${oreReq.name} ×${oreReq.count} ${oreReq.icon}. Есть: ${oreHave}.` };
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

    const consumeOre = (inventory: GameItem[]) => {
      let remaining = oreReq.count;
      return inventory.map(i => {
        if (remaining <= 0 || i.name !== oreReq.name) return i;
        const stack = i.stackCount || 1;
        const take = Math.min(stack, remaining);
        remaining -= take;
        return { ...i, stackCount: stack - take };
      }).filter(i => (i.stackCount || 1) > 0);
    };

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
        inventory: consumeOre(prev.inventory.map(updateItem)),
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
      return { success: true, message: `Успех! ${item.name} заточен до +${currentLevel + 1}. Потрачено: ${oreReq.name} ×${oreReq.count}, ${costGold} 🪙 и ${costSilver + protectionCost} 🥈${useProtection ? ' (с защитой)' : ''}.` };
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
        if (prev.silver < 100) {
          triggerHaptic('error');
          sound.playUpgradeFail();
          return prev;
        }
        sound.playCoinDrop();
        sound.playEnergyRefill();
        triggerHaptic('success');
        return {
          ...prev,
          silver: prev.silver - 100,
          energy: Math.min(prev.maxEnergy, prev.energy + 30)
        };
      }
      return prev;
    });
  }, []);

  // START BATTLE with Energy Check
  const startBattleWithMonster = useCallback((monster: Monster, options?: { chain?: boolean; energyCost?: number }): boolean => {
    const activeModId = player?.activeRegionModId || 'mod_standard';
    const activeMod = REGION_MODIFIERS[activeModId] || REGION_MODIFIERS.mod_standard;
    const energyCost = options?.energyCost ?? ENERGY_COSTS.combat;
    const useChain = options?.chain !== false;

    if (player && player.energy < energyCost) {
      sound.playUpgradeFail();
      triggerHaptic('error');
      return false;
    }
    if (isInCombat && !isCombatEnded) return false;

    const chain = useChain && player ? buildCombatChain(monster, player, combatStats, monster.regionId || player.currentRegionId) : [scaleMonsterForCombat(monster, player!, combatStats)];

    setPlayer(prev => prev ? {
      ...prev,
      energy: Math.max(0, prev.energy - energyCost),
      skills: prev.skills.map(skill => ({ ...skill, currentCooldown: 0 }))
    } : prev);

    setCombatChain(useChain && player ? { total: chain.length, defeated: 0, queue: chain.slice(1) } : null);
    setActiveMonster({ ...chain[0], hp: chain[0].maxHp });
    setCombatPlayerHp(combatStats.maxHp);
    setCombatPlayerMp(combatStats.maxMp);
    setTurnPhase('player');
    setIsInCombat(true);
    setIsCombatEnded(false);
    setCombatOutcome(null);
    setMonsterIntent(null);
    setPlayerEffects([]);
    setMonsterEffects([]);
    setCombatRound(1);
    setLastCombatReward(null);
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
  }, [player, combatStats.maxHp, combatStats, isInCombat, isCombatEnded]);

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

    const selectedModId = modId || targetReg.defaultModId || 'mod_standard';
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
            const baseMob = MONSTERS[monsterId] || MONSTERS['m_wolf'];

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
            }, { energyCost: 0 });
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
  }, [player, startBattleWithMonster]);

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
    const expReward = Math.round(monster.expReward * (activeMod.expMultiplier || 1) * (1 + combatStats.expBonus / 100));
    if (potionCount > 0) {
      for (let i = 0; i < potionCount; i += 1) lootResult.items.push({ ...potionPool[i % potionPool.length], id: `drop_potion_${Date.now()}_${i}`, stackCount: 1 });
    }
    setLastCombatReward({
      gold: lootResult.gold,
      silver: lootResult.silver,
      exp: expReward,
      items: lootResult.items.map(item => ({ ...item }))
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

    lootResult.items.forEach((item, index) => {
      logs.push({
        id: 'drop_' + Date.now() + '_' + index,
        turn: currentTurn,
        text: `🎁 Трофей: [${item.name}] (Ур. ${item.level}, ${item.rarity.toUpperCase()})!`,
        type: 'system'
      });
    });

    setPlayer(prev => {
      if (!prev) return prev;
      const xpResult = addExperience(prev, expReward);
      let inventory = [...xpResult.player.inventory];

      for (const item of lootResult.items) {
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

      return next;
    });

    if (dungeonRoom?.monster?.id === monster.id && activeDungeonRun) {
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
    }

    sound.playVictory();
    triggerHaptic('success');
    const hasNextCombat = Boolean(combatChain && combatChain.queue.length > 0);
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
  }, [player, combatStats, activeDungeonRun, combatChain]);

  const performPlayerAction = useCallback((actionType: 'attack' | 'skill' | 'defend' | 'potion' | 'flee' | 'execute', skillId?: string) => {
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
      const pot = player.inventory.find(i => i.type === 'potion');
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

      multiplier = skillUsed.damageMultiplier;
      damageType = skillUsed.damageType;
      skillName = skillUsed.name;

      if (skillUsed.inflicts && Math.random() < skillUsed.inflicts.chance) {
        setMonsterEffects(prev => applyStatusEffect(prev, {
          type: skillUsed!.inflicts!.type,
          name: skillUsed!.name,
          duration: skillUsed!.inflicts!.duration,
          value: skillUsed!.inflicts!.power
        }));
        newLogs.push({
          id: 'effect_' + Date.now(),
          turn: currentTurn,
          text: `✨ ${activeMonster.name} получает статус [${skillUsed.inflicts.type}]!`,
          type: 'status'
        });
      }
    } else if (actionType === 'execute') {
      const executeReady = activeMonster.hp / activeMonster.maxHp <= 0.35;
      multiplier = executeReady ? 2.5 : 1.2;
      skillName = executeReady ? 'Смертельный добивающий удар' : 'Попытка добивания';
      damageType = 'physical';
    }

    // A heal skill (e.g. paladin) is a valid turn action without dealing damage.
    if (skillUsed?.healMultiplier && skillUsed.damageMultiplier === 0) {
      const healAmount = Math.max(1, Math.round(100 * skillUsed.healMultiplier));
      setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + healAmount));
      newLogs.push({
        id: 'skill_heal_' + Date.now(),
        turn: currentTurn,
        text: `✨ [${skillName}] восстанавливает ${healAmount} HP.`,
        type: 'heal'
      });
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    }

    const attackPower = getDamagePower(damageType, combatStats);
    const hitChance = Math.min(98, Math.max(30, combatStats.accuracy - activeMonster.evasion + 85));
    if (Math.random() * 100 > hitChance) {
      newLogs.push({
        id: 'evade_' + Date.now(),
        turn: currentTurn,
        text: `💨 [Уклонение] ${activeMonster.name} уклонился от ${skillName}.`,
        type: 'system'
      });
    } else {
      let finalDmg = calculateTypedDamage({
        power: attackPower * playerMods.attackMultiplier,
        multiplier,
        damageType,
        targetDefense: activeMonster.defense,
        targetMagicDefense: activeMonster.magicDefense,
        armorPenetration: combatStats.armorPenetration,
        targetResistances: activeMonster.resistances,
        extraDamageMultiplier: monsterMods.damageTakenMultiplier
      });

      const isCrit = Math.random() * 100 < combatStats.critChance;
      if (isCrit) finalDmg = Math.round(finalDmg * (combatStats.critDamage / 100));

      if (isCrit) {
        sound.playCriticalHit();
        triggerHaptic('heavy');
      } else {
        sound.playSlash();
        triggerHaptic('light');
      }

      newLogs.push({
        id: 'dmg_' + Date.now(),
        turn: currentTurn,
        text: `${isCrit ? '💥' : '⚔️'} [${skillName}] наносит ${finalDmg} ${damageType.toUpperCase()} урона (сопротивление цели учитывается).`,
        type: isCrit ? 'crit' : 'player-attack'
      });

      if (skillUsed?.healMultiplier) {
        const heal = Math.max(1, Math.round(finalDmg * skillUsed.healMultiplier));
        setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + heal));
        newLogs.push({
          id: 'skill_drain_' + Date.now(),
          turn: currentTurn,
          text: `🩸 [${skillName}] восстанавливает ${heal} HP.`,
          type: 'heal'
        });
      }

      if (combatStats.vampirism > 0) {
        const lifesteal = Math.max(1, Math.round(finalDmg * (combatStats.vampirism / 100)));
        setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + lifesteal));
        newLogs.push({
          id: 'vamp_' + Date.now(),
          turn: currentTurn,
          text: `🩸 [Вампиризм] +${lifesteal} HP.`,
          type: 'heal'
        });
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
    battleLog.length,
    playerEffects,
    monsterEffects,
    combatPlayerHp,
    combatPlayerMp,
    combatStats,
    completeCombatVictory
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
      newLogs.push({ id: 'm_atk_' + Date.now(), turn: currentTurn, text: playerMods.invulnerable ? `✨ [Неуязвимость] ${activeMonster.name} не нанес урона.` : `🩸 ${activeMonster.name} наносит ${monsterFinalDmg} ${monsterDamageType.toUpperCase()} урона${blockedByShield ? ` (щит поглотил ${blockedByShield})` : ''}.`, type: playerMods.invulnerable ? 'heal' : 'monster-attack' });
      setCombatPlayerHp(prevHp => {
        const nextHp = Math.max(0, prevHp - monsterFinalDmg);
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
  }, [isInCombat, isCombatEnded, activeMonster, player, turnPhase, battleLog.length, monsterEffects, playerEffects, combatStats, completeCombatVictory, monsterIntent, combatPlayerHp]);

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
      if (skill.effect && Math.random() < (skill.effectChance ?? 1)) {
        const effect: StatusEffect = { type: skill.effect, name: skill.name, duration: skill.effectDuration || 1, value: skill.effectPower || 0 };
        if (skill.effect === 'fortify' || skill.effect === 'fury' || skill.effect === 'shield') setMonsterEffects(prev => applyStatusEffect(prev, effect));
        else setPlayerEffects(prev => applyStatusEffect(prev, effect));
        logs.push({ id: 'monster_effect_' + Date.now(), turn: currentTurn, text: `✨ ${activeMonster.name} накладывает [${skill.effect}]!`, type: 'status' });
      }
      logs.push({ id: 'monster_skill_damage_' + Date.now(), turn: currentTurn, text: playerMods.invulnerable ? '✨ Неуязвимость полностью поглощает особый приём.' : `💥 Особый приём наносит ${damage} ${skill.damageType.toUpperCase()} урона${blocked ? ` (щит поглотил ${blocked})` : ''}.`, type: 'monster-attack' });
      setCombatPlayerHp(prevHp => {
        const nextHp = Math.max(0, prevHp - damage);
        if (nextHp <= 0) {
          logs.push({ id: 'monster_skill_fatal_' + Date.now(), turn: currentTurn, text: `💀 Особый приём ${skill.name} вас добил.`, type: 'death' });
          sound.playDefeat(); triggerHaptic('error');
          setPlayer(prev => prev ? { ...prev, statsSummary: { ...prev.statsSummary, battlesLost: prev.statsSummary.battlesLost + 1 } } : prev);
          setIsCombatEnded(true); setCombatOutcome('defeat'); setTurnPhase('ended'); setMonsterIntent(null);
        } else {
          setTurnPhase('player'); setMonsterIntent(null);
        }
        return nextHp;
      });
      setActiveMonster(prev => prev ? { ...prev, skills: prev.skills?.map(s => ({ ...s, currentCooldown: s.id === skill.id ? skill.cooldown : Math.max(0, (s.currentCooldown || 0) - 1) })), mp: Math.max(0, prev.mp - skill.manaCost) } : null);
      setPlayer(prev => prev ? { ...prev, skills: prev.skills.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) } : prev);
      setBattleLog(prev => [...prev, ...logs]);
    }, 700);
    return () => clearTimeout(timer);
  }, [monsterIntent, isInCombat, isCombatEnded, activeMonster, player, turnPhase, battleLog.length, playerEffects, combatStats, combatPlayerHp]);

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
      const monsterHpPct = (activeMonster.hp / activeMonster.maxHp) * 100;
      const playerHpPct = (combatPlayerHp / combatStats.maxHp) * 100;
      const potionItem = player.inventory.find(i => i.type === 'potion');

      if (playerHpPct <= autoBattle.healAtHpPercent && potionItem) {
        performPlayerAction('potion');
      } else if (monsterHpPct <= 35) {
        performPlayerAction('execute');
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
    setAutoBattle(prev => {
      const nextState = !prev.enabled;
      triggerHaptic(nextState ? 'medium' : 'light');
      return { ...prev, enabled: nextState };
    });
  }, []);

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
    setCombatPlayerHp(combatStats.maxHp);
    setCombatPlayerMp(combatStats.maxMp);
    setBattleLog([]);
  }, [combatStats.maxHp, combatStats.maxMp]);

  // Exploration & Regions
  const setCurrentRegion = useCallback((regionId: string) => {
    setPlayer(prev => prev ? { ...prev, currentRegionId: regionId } : prev);
    sound.playClick();
  }, []);

  // Procedural Dungeons
  const enterDungeon = useCallback((caveId: string, difficulty: DungeonRun['difficulty'] = 'normal') => {
    if (!player || player.energy < ENERGY_COSTS.dungeon) { triggerHaptic('error'); return; }
    const cave = CAVES[caveId];
    if (!cave) return;
    sound.playClick();
    triggerHaptic('medium');

    const rooms: DungeonRun['rooms'] = [];
    for (let i = 1; i <= cave.roomsCount; i++) {
      if (i === cave.roomsCount) {
        // Boss Room
        const bossMonster = MONSTERS[cave.bossMonsterId] || MONSTERS['m_queen_bat'];
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
          const mList = Object.values(MONSTERS).filter(m => !m.isBoss);
          const chosenMonster = mList[Math.floor(Math.random() * mList.length)];
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
  }, [player]);

  const proceedDungeonRoom = useCallback((choice?: 'fight' | 'open' | 'pray' | 'disarm') => {
    if (!activeDungeonRun) return;
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
      const foundGold = 100 + Math.floor(Math.random() * 250);
      setPlayer(prev => prev ? { ...prev, gold: prev.gold + foundGold } : prev);
      sound.playUpgradeSuccess();
      triggerHaptic('success');
    } else if (currentRoom.type === 'shrine') {
      sound.playPotion();
      triggerHaptic('medium');
      setCombatPlayerHp(combatStats.maxHp);
      setCombatPlayerMp(combatStats.maxMp);
      setPlayer(prev => prev ? { ...prev, energy: Math.min(prev.maxEnergy, prev.energy + 10) } : prev);
    } else if (currentRoom.type === 'trap') {
      const trapDamage = Math.max(10, Math.round(combatStats.maxHp * 0.08));
      setCombatPlayerHp(prev => Math.max(1, prev - trapDamage));
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
  }, [activeDungeonRun, startBattleWithMonster, combatStats.maxHp, combatStats.maxMp]);

  const exitDungeon = useCallback(() => {
    setActiveDungeonRun(null);
    sound.playClick();
  }, []);

  // Mining
  const mineNode = useCallback((nodeId: string): { success: boolean; yieldCount: number; isCrit: boolean; oreName: string } => {
    if (!player) return { success: false, yieldCount: 0, isCrit: false, oreName: '' };

    const node = MINING_NODES.find(n => n.id === nodeId);
    if (!node) return { success: false, yieldCount: 0, isCrit: false, oreName: '' };
    if (player.miningLevel < node.levelReq) {
      triggerHaptic('error');
      return { success: false, yieldCount: 0, isCrit: false, oreName: node.oreYield };
    }
    if (player.energy < ENERGY_COSTS.mining) { triggerHaptic('error'); return { success: false, yieldCount: 0, isCrit: false, oreName: node.oreYield }; }
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

    const result = { success: true, yieldCount, isCrit, oreName: node.oreYield };

    setPlayer(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        energy: Math.max(0, prev.energy - ENERGY_COSTS.mining),
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
  }, [player]);

  // Alchemy
  const craftAlchemy = useCallback((recipeId: string): boolean => {
    if (!player) return false;
    if (player.energy < ENERGY_COSTS.alchemy) { triggerHaptic('error'); return false; }

    const recipe = ALCHEMY_RECIPES.find(r => r.id === recipeId);
    if (!recipe || player.alchemyLevel < recipe.levelReq) {
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
      energy: Math.max(0, prev.energy - ENERGY_COSTS.alchemy),
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
    if (!player || player.arenaTickets <= 0) {
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
  }, [player, startBattleWithMonster]);

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
      clanTag: player.clanId ? 'GUILD' : undefined,
      text: text.trim(),
      channel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, newMsg]);
  }, [player]);

  const dismissOfflineReport = useCallback(() => {
    setOfflineReport(null);
  }, []);

  // ADMIN COMMANDS
  const adminAddGold = useCallback((amt: number) => {
    setPlayer(p => p ? { ...p, gold: p.gold + amt } : p);
    sound.playVictory();
  }, []);

  const adminAddSilver = useCallback((amt: number) => {
    setPlayer(p => p ? { ...p, silver: p.silver + amt } : p);
    sound.playVictory();
  }, []);

  const adminLevelUp = useCallback(() => {
    setPlayer(p => {
      if (!p) return p;
      return addExperience(p, p.nextExp).player;
    });
    sound.playLevelUp();
  }, []);

  const adminSpawnLegendaryItem = useCallback(() => {
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
      autoBattle,
      activeDungeonRun,
      quests,
      achievements,
      chatMessages,
      onlinePlayersCount,
      combatStats,
      offlineReport,
      travelState,
      createCharacter,
      resetCharacter,
      allocateAttribute,
      unlockTalent,
      equipItem,
      unequipItem,
      sellItem,
      disassembleItem,
      expandInventory,
      upgradeItem,
      meditateOrRefillEnergy,
      setActiveRegionMod,
      setActivePet,
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
      craftAlchemy,
      listMarketItem,
      buyMarketListing,
      buyBasicConsumable,
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
