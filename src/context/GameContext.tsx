import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PlayerCharacter, 
  GameItem, 
  ItemType, 
  ItemRarity,
  CharacterClassId, 
  CombatStats, 
  Monster, 
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
  REGION_MODIFIERS
} from '../data/gameData';
import { sound } from '../utils/audio';
import { getTelegramUser, triggerHaptic, TelegramUser } from '../utils/telegram';
import { generateCombatLoot } from '../utils/lootGenerator';

interface GameContextType {
  player: PlayerCharacter | null;
  activeMonster: Monster | null;
  battleLog: BattleLogEntry[];
  isInCombat: boolean;
  isCombatEnded: boolean;
  combatOutcome: 'victory' | 'defeat' | 'flee' | null;
  combatPlayerHp: number;
  combatPlayerMp: number;
  turnPhase: 'player' | 'monster' | 'ended';
  playerEffects: StatusEffect[];
  monsterEffects: StatusEffect[];
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
  
  // Combat
  startBattleWithMonster: (monster: Monster) => boolean;
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

  // Arena & Clan
  challengeArena: (opponent: ArenaOpponent) => void;
  claimQuestReward: (questId: string) => void;
  claimAchievementReward: (achievementId: string) => void;
  sendChatMessage: (text: string, channel: 'global' | 'clan') => void;
  dismissOfflineReport: () => void;

  // Admin
  adminAddGold: (amt: number) => void;
  adminAddCrystals: (amt: number) => void;
  adminLevelUp: () => void;
  adminSpawnLegendaryItem: () => void;
  adminHealAll: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SAVE_KEY = 'aethelgard_save_v1_data';

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [player, setPlayer] = useState<PlayerCharacter | null>(null);
  const [activeMonster, setActiveMonster] = useState<Monster | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
  const [isInCombat, setIsInCombat] = useState<boolean>(false);
  const [isCombatEnded, setIsCombatEnded] = useState<boolean>(false);
  const [combatOutcome, setCombatOutcome] = useState<'victory' | 'defeat' | 'flee' | null>(null);
  const [combatPlayerHp, setCombatPlayerHp] = useState<number>(100);
  const [combatPlayerMp, setCombatPlayerMp] = useState<number>(50);
  const [turnPhase, setTurnPhase] = useState<'player' | 'monster' | 'ended'>('player');
  const [playerEffects, setPlayerEffects] = useState<StatusEffect[]>([]);
  const [monsterEffects, setMonsterEffects] = useState<StatusEffect[]>([]);
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

  // Natural energy regeneration (+1 every 5 seconds)
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
    }, 5000);
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
            const kills = Math.floor(cappedMins * 1.8);
            const goldEarned = kills * (15 + parsed.player.level * 4);
            const expEarned = kills * (25 + parsed.player.level * 6);
            
            parsed.player.gold += goldEarned;
            parsed.player.exp += expEarned;
            parsed.player.statsSummary.monstersKilled += kills;
            parsed.player.lastActiveTimestamp = now;

            setOfflineReport({
              minutes: cappedMins,
              gold: goldEarned,
              exp: expEarned,
              kills: kills,
              itemsCount: Math.floor(kills * 0.15)
            });
          }

          // Ensure currency and energy defaults
          parsed.player.silver = parsed.player.silver ?? 150;
          parsed.player.shards = parsed.player.shards ?? 15;
          parsed.player.energy = parsed.player.energy ?? 100;
          parsed.player.maxEnergy = parsed.player.maxEnergy ?? 100;
          parsed.player.activeRegionModId = parsed.player.activeRegionModId || 'mod_standard';

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
        hp: 100, maxHp: 100, mp: 50, maxMp: 50, energy: 100, maxEnergy: 100, stamina: 100, maxStamina: 100,
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
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
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
      resistances: { physical: 10, magic: 10, fire: 5, ice: 5, lightning: 5, poison: 5, dark: 5, holy: 5 }
    };
  }, [player]);

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
      stats: {},
      sellPrice: 10,
      disassembleYield: { shards: 1 },
      stackCount: 5
    });

    const newPlayer: PlayerCharacter = {
      id: 'char_' + Date.now(),
      userId: String(getTelegramUser().id),
      name: name.trim() || 'Теневой Воин',
      classId,
      level: 1,
      exp: 0,
      nextExp: 100,
      statPoints: 5,
      talentPoints: 1,
      gold: 250,
      silver: 150,
      shards: 15,
      crystals: 20,
      energy: 100,
      maxEnergy: 100,
      lastEnergyRegenTimestamp: Date.now(),
      arcaneEnergy: 50,
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
      if (!prev) return prev;
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
        inventory: newInventory
      };
    });
  }, []);

  const unequipItem = useCallback((type: ItemType) => {
    setPlayer(prev => {
      if (!prev) return prev;
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
        inventory: [...prev.inventory, { ...currentEquipped, isEquipped: false }]
      };
    });
  }, []);

  const sellItem = useCallback((item: GameItem) => {
    setPlayer(prev => {
      if (!prev) return prev;
      sound.playClick();
      triggerHaptic('light');
      const goldGain = item.sellPrice || 10;
      return {
        ...prev,
        gold: prev.gold + goldGain,
        inventory: prev.inventory.filter(i => i.id !== item.id)
      };
    });
  }, []);

  const disassembleItem = useCallback((item: GameItem) => {
    setPlayer(prev => {
      if (!prev) return prev;
      sound.playMining();
      triggerHaptic('medium');
      const shardsGain = item.disassembleYield?.shards || 1;
      const oreGain = item.disassembleYield?.ore || 0;

      // Add shards / ore to inventory as materials
      const newInventory = prev.inventory.filter(i => i.id !== item.id);
      
      const shardItem: GameItem = {
        id: 'mat_shard_' + Date.now(),
        templateId: 'magic_shard',
        name: 'Магический осколок',
        type: 'material',
        rarity: 'rare',
        level: 1,
        upgradeLevel: 0,
        icon: '💠',
        description: 'Используется для кузнечного дела и алхимии.',
        stats: {},
        sellPrice: 15,
        disassembleYield: {},
        stackCount: shardsGain
      };
      newInventory.push(shardItem);

      return {
        ...prev,
        inventory: newInventory
      };
    });
  }, []);

  const expandInventory = useCallback(() => {
    setPlayer(prev => {
      if (!prev) return prev;
      const cost = prev.maxInventorySlots * 25;
      if (prev.gold < cost) {
        triggerHaptic('error');
        return prev;
      }
      sound.playUpgradeSuccess();
      triggerHaptic('success');
      return {
        ...prev,
        gold: prev.gold - cost,
        maxInventorySlots: prev.maxInventorySlots + 10
      };
    });
  }, []);

  // Blacksmith sharpening
  const upgradeItem = useCallback((item: GameItem, useProtection: boolean): { success: boolean; message: string } => {
    let result = { success: false, message: '' };
    setPlayer(prev => {
      if (!prev) return prev;
      const currentLevel = item.upgradeLevel || 0;
      if (currentLevel >= 25) {
        result = { success: false, message: 'Предмет достиг максимального уровня заточки (+25)!' };
        return prev;
      }

      const costGold = Math.round(50 * Math.pow(1.35, currentLevel));
      const costShards = Math.max(1, Math.floor(currentLevel / 3));

      if (prev.gold < costGold) {
        triggerHaptic('error');
        result = { success: false, message: `Недостаточно золота (нужно ${costGold} 🪙)!` };
        return prev;
      }

      // Success chances
      let successRate = 1.0;
      if (currentLevel === 1) successRate = 0.95;
      else if (currentLevel === 2) successRate = 0.90;
      else if (currentLevel === 3) successRate = 0.85;
      else if (currentLevel === 4) successRate = 0.80;
      else if (currentLevel === 5) successRate = 0.70;
      else if (currentLevel === 6) successRate = 0.60;
      else if (currentLevel === 7) successRate = 0.50;
      else if (currentLevel === 8) successRate = 0.40;
      else if (currentLevel === 9) successRate = 0.35;
      else if (currentLevel >= 10 && currentLevel < 15) successRate = 0.25;
      else if (currentLevel >= 15 && currentLevel < 20) successRate = 0.15;
      else if (currentLevel >= 20) successRate = 0.08;

      const roll = Math.random();
      const isSuccess = roll <= successRate;

      if (isSuccess) {
        sound.playUpgradeSuccess();
        triggerHaptic('success');
        result = { success: true, message: `Успех! ${item.name} заточен до +${currentLevel + 1}!` };

        const updateItem = (i: GameItem) => i.id === item.id ? { ...i, upgradeLevel: i.upgradeLevel + 1 } : i;

        return {
          ...prev,
          gold: prev.gold - costGold,
          equipped: Object.fromEntries(
            Object.entries(prev.equipped).map(([k, v]) => [k, v ? updateItem(v) : v])
          ) as Partial<Record<ItemType, GameItem>>,
          inventory: prev.inventory.map(updateItem),
          statsSummary: {
            ...prev.statsSummary,
            itemsUpgraded: prev.statsSummary.itemsUpgraded + 1,
            maxUpgradeReached: Math.max(prev.statsSummary.maxUpgradeReached, currentLevel + 1)
          }
        };
      } else {
        sound.playUpgradeFail();
        triggerHaptic('warning');
        let newLevel = currentLevel;
        if (!useProtection && currentLevel >= 8) {
          newLevel = Math.max(0, currentLevel - 1);
          result = { success: false, message: `Провал заточки! Уровень снижен до +${newLevel}.` };
        } else {
          result = { success: false, message: `Провал заточки! Предмет сохранил уровень +${currentLevel}.` };
        }

        const updateItem = (i: GameItem) => i.id === item.id ? { ...i, upgradeLevel: newLevel } : i;

        return {
          ...prev,
          gold: prev.gold - costGold,
          equipped: Object.fromEntries(
            Object.entries(prev.equipped).map(([k, v]) => [k, v ? updateItem(v) : v])
          ) as Partial<Record<ItemType, GameItem>>,
          inventory: prev.inventory.map(updateItem)
        };
      }
    });

    return result;
  }, []);

  const setActiveRegionMod = useCallback((modId: string) => {
    setPlayer(prev => prev ? { ...prev, activeRegionModId: modId } : prev);
    triggerHaptic('light');
    sound.playClick();
  }, []);

  const meditateOrRefillEnergy = useCallback((mode: 'meditate' | 'silver' | 'potion') => {
    setPlayer(prev => {
      if (!prev) return prev;
      if (mode === 'meditate') {
        sound.playEnergyRefill();
        triggerHaptic('medium');
        return {
          ...prev,
          energy: Math.min(prev.maxEnergy, prev.energy + 25)
        };
      } else if (mode === 'silver') {
        if (prev.silver < 50) {
          triggerHaptic('error');
          sound.playUpgradeFail();
          return prev;
        }
        sound.playCoinDrop();
        sound.playEnergyRefill();
        triggerHaptic('success');
        return {
          ...prev,
          silver: prev.silver - 50,
          energy: Math.min(prev.maxEnergy, prev.energy + 50)
        };
      }
      return prev;
    });
  }, []);

  // START BATTLE with Energy Check
  const startBattleWithMonster = useCallback((monster: Monster): boolean => {
    const activeModId = player?.activeRegionModId || 'mod_standard';
    const activeMod = REGION_MODIFIERS[activeModId] || REGION_MODIFIERS.mod_standard;
    const energyCost = activeMod.energyCost || 5;

    if (player && player.energy < energyCost) {
      sound.playUpgradeFail();
      triggerHaptic('error');
      return false;
    }

    // Deduct battle energy
    setPlayer(prev => prev ? { ...prev, energy: Math.max(0, prev.energy - energyCost) } : prev);

    const fullHp = monster.maxHp && monster.maxHp > 0 ? monster.maxHp : (monster.hp > 0 ? monster.hp : 100);
    setActiveMonster({ ...monster, hp: fullHp });
    setCombatPlayerHp(combatStats.maxHp);
    setCombatPlayerMp(combatStats.maxMp);
    setTurnPhase('player');
    setIsInCombat(true);
    setIsCombatEnded(false);
    setCombatOutcome(null);
    setPlayerEffects([]);
    setMonsterEffects([]);
    setBattleLog([
      {
        id: 'start_' + Date.now(),
        turn: 1,
        text: `⚔️ В бой вступает ${monster.name} (Ур. ${monster.level})! Режим: [${activeMod.name}]. Затрачено ${energyCost} ⚡. Ваш ход!`,
        type: 'system'
      }
    ]);
    sound.playClick();
    triggerHaptic('medium');
    return true;
  }, [player, combatStats.maxHp, combatStats.maxMp]);

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
            });
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
  const performPlayerAction = useCallback((actionType: 'attack' | 'skill' | 'defend' | 'potion' | 'flee' | 'execute', skillId?: string) => {
    if (!isInCombat || !activeMonster || isCombatEnded || !player) return;
    if (turnPhase !== 'player') return; // Strict turn-based guard: only player can act on player's turn!

    let nextMonsterHp = activeMonster.hp;
    const currentTurn = battleLog.length + 1;
    const newLogs: BattleLogEntry[] = [];

    const activeMod = REGION_MODIFIERS[player.activeRegionModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;

    // 1. Turn start: HP & MP Regeneration
    const regenHp = combatStats.hpRegen + (activeMod.bonusRegen || 0);
    const regenMp = combatStats.mpRegen + (activeMod.bonusRegen ? Math.floor(activeMod.bonusRegen / 2) : 0);
    if (regenHp > 0 || regenMp > 0) {
      setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + regenHp));
      setCombatPlayerMp(prev => Math.min(combatStats.maxMp, prev + regenMp));
      newLogs.push({
        id: 'regen_' + Date.now(),
        turn: currentTurn,
        text: `✨ [Регенерация]: +${regenHp} HP, +${regenMp} MP`,
        type: 'heal'
      });
    }

    // 2. Player action resolution
    if (actionType === 'flee') {
      const fleeSuccess = Math.random() < 0.65;
      if (fleeSuccess) {
        sound.playClick();
        newLogs.push({ id: 'flee_' + Date.now(), turn: currentTurn, text: '🏃 Вы ловко ускользнули из боя!', type: 'flee' });
        setBattleLog(prev => [...prev, ...newLogs]);
        setIsCombatEnded(true);
        setCombatOutcome('flee');
        setTurnPhase('ended');
        triggerHaptic('light');
        return;
      } else {
        newLogs.push({ id: 'flee_fail_' + Date.now(), turn: currentTurn, text: '❌ Попытка побега провалилась! Монстр преграждает путь.', type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        setTurnPhase('monster');
        return;
      }
    } else if (actionType === 'defend') {
      sound.playClick();
      newLogs.push({ id: 'def_' + Date.now(), turn: currentTurn, text: '🛡️ Вы встали в глухую оборону! Защита удвоена, восстановлено 25 MP.', type: 'heal' });
      setPlayerEffects(prev => [...prev, { type: 'shield', name: 'Глухая оборона', duration: 1, value: Math.round(combatStats.defense * 1.5) }]);
      setCombatPlayerMp(prev => Math.min(combatStats.maxMp, prev + 25));
      triggerHaptic('light');
      setBattleLog(prev => [...prev, ...newLogs]);
      setTurnPhase('monster');
      return;
    } else if (actionType === 'potion') {
      const pot = player.inventory.find(i => i.type === 'potion');
      if (pot) {
        sound.playPotion();
        const healAmt = pot.templateId === 'pot_hp_large' ? 350 : 150;
        setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + healAmt));
        newLogs.push({ id: 'pot_' + Date.now(), turn: currentTurn, text: `🧪 Вы выпили ${pot.name} и восстановили ${healAmt} HP!`, type: 'heal' });
        triggerHaptic('medium');
        // Decrement potion
        setPlayer(prev => {
          if (!prev) return prev;
          if (pot.stackCount && pot.stackCount > 1) {
            return {
              ...prev,
              inventory: prev.inventory.map(i => i.id === pot.id ? { ...i, stackCount: (i.stackCount || 1) - 1 } : i)
            };
          } else {
            return {
              ...prev,
              inventory: prev.inventory.filter(i => i.id !== pot.id)
            };
          }
        });
        setBattleLog(prev => [...prev, ...newLogs]);
        setTurnPhase('monster');
        return;
      } else {
        newLogs.push({ id: 'no_pot_' + Date.now(), turn: currentTurn, text: '❌ У вас нет зелий в инвентаре!', type: 'system' });
        setBattleLog(prev => [...prev, ...newLogs]);
        return;
      }
    } else if (actionType === 'attack' || actionType === 'execute' || actionType === 'skill') {
      let multiplier = 1.0;
      let skillName = 'Атака оружием';
      let isExecute = actionType === 'execute';

      if (actionType === 'skill' && skillId) {
        const skill = player.skills.find(s => s.id === skillId);
        if (skill) {
          if (combatPlayerMp < skill.manaCost) {
            newLogs.push({ id: 'no_mp_' + Date.now(), turn: currentTurn, text: `❌ Недостаточно маны для ${skill.name} (${skill.manaCost} MP)!`, type: 'system' });
            setBattleLog(prev => [...prev, ...newLogs]);
            return;
          }
          setCombatPlayerMp(prev => Math.max(0, prev - skill.manaCost));
          multiplier = skill.damageMultiplier;
          skillName = skill.name;
          if (skill.inflicts && Math.random() < skill.inflicts.chance) {
            setMonsterEffects(prev => [...prev, {
              type: skill.inflicts!.type,
              name: skill.name,
              duration: skill.inflicts!.duration,
              value: skill.inflicts!.power
            }]);
            newLogs.push({
              id: 'effect_' + Date.now(),
              turn: currentTurn,
              text: `✨ ${activeMonster.name} получает статус [${skill.inflicts.type}]!`,
              type: 'status'
            });
          }
        }
      } else if (isExecute) {
        if (activeMonster.hp / activeMonster.maxHp <= 0.35) {
          multiplier = 2.5;
          skillName = 'Смертельный добивающий удар';
        } else {
          multiplier = 1.2;
          skillName = 'Попытка добивания';
        }
      }

      // Check Monster Evasion vs Player Accuracy
      const hitChance = Math.min(98, Math.max(30, combatStats.accuracy - activeMonster.evasion + 85));
      const isEvaded = Math.random() * 100 > hitChance;

      if (isEvaded) {
        newLogs.push({ id: 'evade_' + Date.now(), turn: currentTurn, text: `💨 [Уклонение] ${activeMonster.name} ловко уклонился от вашей атаки!`, type: 'system' });
      } else {
        // Calculate Physical & Magic Damage with Armor Penetration & Defense Mitigation curve
        const baseDmg = Math.max(combatStats.attack, combatStats.magicAttack);
        const effDef = Math.max(0, activeMonster.defense - combatStats.armorPenetration);
        const defMitigation = effDef / (effDef + 75);
        let rawDmg = Math.max(6, Math.round((baseDmg * multiplier) * (1 - defMitigation)));

        // Crit Check
        const isCrit = Math.random() * 100 < combatStats.critChance;
        if (isCrit) {
          rawDmg = Math.round(rawDmg * (combatStats.critDamage / 100));
          sound.playCriticalHit();
          triggerHaptic('heavy');
          newLogs.push({
            id: 'crit_' + Date.now(),
            turn: currentTurn,
            text: `💥 КРИТИЧЕСКИЙ УДАР! [${skillName}] наносит ${rawDmg} урона! (Пробито брони: ${combatStats.armorPenetration})`,
            type: 'crit'
          });
        } else {
          sound.playSlash();
          triggerHaptic('light');
          newLogs.push({
            id: 'hit_' + Date.now(),
            turn: currentTurn,
            text: `⚔️ [${skillName}] наносит ${rawDmg} урона (Броня врага снизила урон на ${Math.round(defMitigation * 100)}%).`,
            type: 'player-attack'
          });
        }

        // Vampirism (Lifesteal)
        const totalVampirism = combatStats.vampirism;
        if (totalVampirism > 0) {
          const lifesteal = Math.max(1, Math.round(rawDmg * (totalVampirism / 100)));
          setCombatPlayerHp(prev => Math.min(combatStats.maxHp, prev + lifesteal));
          newLogs.push({
            id: 'vamp_' + Date.now(),
            turn: currentTurn,
            text: `🩸 [Вампиризм]: Похищено +${lifesteal} HP (${totalVampirism}%).`,
            type: 'heal'
          });
        }

        nextMonsterHp = Math.max(0, nextMonsterHp - rawDmg);
      }
    }

    // Check Monster Death & Victory Loot
    if (nextMonsterHp <= 0) {
      sound.playVictory();
      triggerHaptic('success');
      newLogs.push({
        id: 'win_' + Date.now(),
        turn: currentTurn,
        text: `🏆 ${activeMonster.name} повержен! Блестящая победа!`,
        type: 'death'
      });

      // Generate rich loot with levels, rarities and currencies
      const lootResult = generateCombatLoot({
        monsterLevel: activeMonster.level,
        isBoss: activeMonster.isBoss,
        rareDropMult: (activeMod.rareDropMultiplier || 1.0) * (1 + combatStats.dropBonus / 100),
        goldMult: (activeMod.goldMultiplier || 1.0) * (1 + combatStats.goldBonus / 100),
        silverMult: (activeMod.silverMultiplier || 1.0) * (1 + combatStats.goldBonus / 100)
      });

      const expReward = Math.round(activeMonster.expReward * (activeMod.expMultiplier || 1.0) * (1 + combatStats.expBonus / 100));

      sound.playCoinDrop();
      newLogs.push({
        id: 'reward_' + Date.now(),
        turn: currentTurn,
        text: `💰 Награды: +${lootResult.gold} 🪙 золота, +${lootResult.silver} 🥈 серебра, +${lootResult.shards} 💠 осколков, +${expReward} опыта.`,
        type: 'system'
      });

      lootResult.items.forEach(item => {
        newLogs.push({
          id: 'drop_log_' + Date.now() + Math.random(),
          turn: currentTurn,
          text: `🎁 Трофей: [${item.name}] (Ур. ${item.level}, ${item.rarity.toUpperCase()})!`,
          type: 'system'
        });
      });

      // Update Player
      setPlayer(prev => {
        if (!prev) return prev;
        const newGold = prev.gold + lootResult.gold;
        const newSilver = prev.silver + lootResult.silver;
        const newShards = prev.shards + lootResult.shards;
        let newExp = prev.exp + expReward;
        let newLevel = prev.level;
        let newNextExp = prev.nextExp;
        let newStatPoints = prev.statPoints;
        let newTalentPoints = prev.talentPoints;

        // Level Up check
        while (newExp >= newNextExp) {
          newExp -= newNextExp;
          newLevel += 1;
          newNextExp = Math.round(100 * Math.pow(newLevel, 1.75));
          newStatPoints += 5;
          newTalentPoints += 1;
          sound.playLevelUp();
          newLogs.push({
            id: 'lvl_' + Date.now(),
            turn: currentTurn,
            text: `🎉 НОВЫЙ УРОВЕНЬ! Вы достигли ${newLevel} уровня! Получено +5 очков хар-к и +1 очко талантов!`,
            type: 'heal'
          });
        }

        // Add drops to inventory if space allows
        const updatedInventory = [...prev.inventory];
        lootResult.items.forEach(item => {
          if (updatedInventory.length < prev.maxInventorySlots) {
            updatedInventory.push(item);
          }
        });

        // Update Quests & Achievements
        setQuests(qList => qList.map(q => {
          if (q.completed) return q;

          // Check if quest targets a specific monster
          if (q.targetMonsterId && q.targetMonsterId !== activeMonster.id) {
            return q;
          }

          // Check if quest targets a specific region
          if (q.targetRegionId && q.targetRegionId !== activeMonster.regionId && q.targetRegionId !== prev.currentRegionId) {
            return q;
          }

          if (q.category === 'hunting' || q.category === 'story' || q.category === 'daily' || q.category === 'boss') {
            if (q.category === 'boss' && !activeMonster.isBoss) return q;

            const nextCount = Math.min(q.targetCount, q.currentCount + 1);
            const isCompleted = nextCount >= q.targetCount;
            if (isCompleted && !q.completed) {
              sound.playUpgradeSuccess();
              newLogs.push({
                id: 'quest_done_' + Date.now(),
                turn: currentTurn,
                text: `📜 Задание выполнено: [${q.title}]! Награда ждет в меню заданий.`,
                type: 'heal'
              });
            }
            return {
              ...q,
              currentCount: nextCount,
              completed: isCompleted
            };
          }
          return q;
        }));

        setAchievements(aList => aList.map(a => {
          if (a.id === 'ach_1' || a.id === 'ach_2') {
            const nextProg = a.progress + 1;
            return { ...a, progress: nextProg, completed: nextProg >= a.maxProgress };
          }
          if (activeMonster.isBoss && a.id === 'ach_3') {
            return { ...a, progress: 1, completed: true };
          }
          return a;
        }));

        return {
          ...prev,
          level: newLevel,
          exp: newExp,
          nextExp: newNextExp,
          statPoints: newStatPoints,
          talentPoints: newTalentPoints,
          gold: newGold,
          silver: newSilver,
          shards: newShards,
          inventory: updatedInventory,
          statsSummary: {
            ...prev.statsSummary,
            monstersKilled: prev.statsSummary.monstersKilled + 1,
            bossesDefeated: prev.statsSummary.bossesDefeated + (activeMonster.isBoss ? 1 : 0),
            battlesWon: prev.statsSummary.battlesWon + 1
          }
        };
      });

      setActiveMonster(prev => prev ? { ...prev, hp: 0 } : null);
      setBattleLog(prev => [...prev, ...newLogs]);
      setIsCombatEnded(true);
      setCombatOutcome('victory');
      setTurnPhase('ended');
      return;
    }

    // Monster survived: Player turn is complete, transfer turn to monster!
    setActiveMonster(prev => prev ? { ...prev, hp: nextMonsterHp } : null);
    setBattleLog(prev => [...prev, ...newLogs]);
    setTurnPhase('monster');
  }, [isInCombat, activeMonster, isCombatEnded, player, combatStats, battleLog.length, turnPhase, combatPlayerMp]);

  // MONSTER TURN CONTROLLER (Chess-like alternating turns: I attack, then it attacks me)
  useEffect(() => {
    if (!isInCombat || isCombatEnded || !activeMonster || turnPhase !== 'monster' || !player) return;

    const timer = setTimeout(() => {
      const currentTurn = battleLog.length + 1;
      const newLogs: BattleLogEntry[] = [];
      const activeMod = REGION_MODIFIERS[player.activeRegionModId || 'mod_standard'] || REGION_MODIFIERS.mod_standard;

      // 1. Evasion check: player evades monster strike
      const isPlayerEvaded = Math.random() * 100 < combatStats.evasion;
      if (isPlayerEvaded) {
        sound.playDodge();
        triggerHaptic('light');
        newLogs.push({
          id: 'm_miss_' + Date.now(),
          turn: currentTurn,
          text: `💨 [Уклонение] Вы ловко уклонились от выпада ${activeMonster.name}!`,
          type: 'system'
        });
        setBattleLog(prev => [...prev, ...newLogs]);
        setTurnPhase('player');
        return;
      }

      // 2. Monster damage calculation
      const effPDef = Math.max(0, combatStats.defense - (activeMod.bonusArmorPenetration || 0));
      const pDefMitigation = effPDef / (effPDef + 80);
      const monsterBaseDmg = Math.round(activeMonster.attack * (activeMod.damageMultiplier || 1.0));
      let monsterFinalDmg = Math.max(3, Math.round(monsterBaseDmg * (1 - pDefMitigation)));

      // 3. Shield check (from Defend or potion effect)
      let blockedByShield = 0;
      setPlayerEffects(prevEffects => {
        const shieldIdx = prevEffects.findIndex(e => e.type === 'shield');
        if (shieldIdx >= 0) {
          const shieldVal = prevEffects[shieldIdx].value || 0;
          if (shieldVal >= monsterFinalDmg) {
            blockedByShield = monsterFinalDmg;
            monsterFinalDmg = 0;
            const rem = shieldVal - blockedByShield;
            if (rem > 0) {
              return prevEffects.map((e, i) => i === shieldIdx ? { ...e, value: rem } : e);
            }
            return prevEffects.filter((_, i) => i !== shieldIdx);
          } else {
            blockedByShield = shieldVal;
            monsterFinalDmg -= shieldVal;
            return prevEffects.filter((_, i) => i !== shieldIdx);
          }
        }
        return prevEffects;
      });

      // 4. Monster Vampirism check
      const mobVamp = activeMod.bonusVampirism || 0;
      if (mobVamp > 0 && monsterFinalDmg > 0) {
        const mobHeal = Math.max(1, Math.round(monsterFinalDmg * (mobVamp / 100)));
        setActiveMonster(prev => prev ? { ...prev, hp: Math.min(prev.maxHp, prev.hp + mobHeal) } : null);
        newLogs.push({
          id: 'mvamp_' + Date.now(),
          turn: currentTurn,
          text: `💀 ${activeMonster.name} поглотил вашу жизненную силу (+${mobHeal} HP врагу)!`,
          type: 'status'
        });
      }

      sound.playMonsterAttack();
      triggerHaptic('heavy');

      if (blockedByShield > 0 && monsterFinalDmg === 0) {
        newLogs.push({
          id: 'm_block_' + Date.now(),
          turn: currentTurn,
          text: `🛡️ [Блок] Ваша глухая оборона полностью отразила удар ${activeMonster.name}! (Заблокировано ${blockedByShield} урона)`,
          type: 'heal'
        });
      } else {
        newLogs.push({
          id: 'm_atk_' + Date.now(),
          turn: currentTurn,
          text: `🩸 ${activeMonster.name} атакует вас на ${monsterFinalDmg} урона${blockedByShield > 0 ? ` (щит поглотил ${blockedByShield})` : ''} (Броня поглотила ${Math.round(pDefMitigation * 100)}%).`,
          type: 'monster-attack'
        });
      }

      // 5. Update player HP and verify survival
      setCombatPlayerHp(prevHp => {
        const nextHp = Math.max(0, prevHp - monsterFinalDmg);
        if (nextHp <= 0) {
          sound.playDefeat();
          triggerHaptic('error');
          newLogs.push({
            id: 'm_fatal_' + Date.now(),
            turn: currentTurn + 1,
            text: `💀 Вы пали в неравном бою с ${activeMonster.name}...`,
            type: 'death'
          });
          setIsCombatEnded(true);
          setCombatOutcome('defeat');
          setTurnPhase('ended');
        } else {
          // Hand control back to player!
          setTurnPhase('player');
        }
        return nextHp;
      });

      setBattleLog(prev => [...prev, ...newLogs]);
    }, 750);

    return () => clearTimeout(timer);
  }, [isInCombat, isCombatEnded, activeMonster, turnPhase, player, combatStats, battleLog.length]);

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
        const affordableSkill = player.skills.find(s => s.manaCost <= combatPlayerMp);
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
  }, []);

  const proceedDungeonRoom = useCallback((choice?: 'fight' | 'open' | 'pray' | 'disarm') => {
    if (!activeDungeonRun) return;
    const currentRoom = activeDungeonRun.rooms[activeDungeonRun.currentRoomIndex];
    if (!currentRoom) return;

    if (currentRoom.type === 'combat' || currentRoom.type === 'boss') {
      if (currentRoom.monster) {
        startBattleWithMonster(currentRoom.monster);
      }
      currentRoom.resolved = true;
    } else if (currentRoom.type === 'treasure') {
      sound.playUpgradeSuccess();
      triggerHaptic('success');
      const foundGold = 100 + Math.floor(Math.random() * 250);
      setPlayer(prev => prev ? { ...prev, gold: prev.gold + foundGold } : prev);
      currentRoom.resolved = true;
      currentRoom.rewardClaimed = true;
    } else if (currentRoom.type === 'shrine') {
      sound.playPotion();
      triggerHaptic('medium');
      currentRoom.resolved = true;
    }

    const nextIndex = activeDungeonRun.currentRoomIndex + 1;
    if (nextIndex >= activeDungeonRun.totalRooms) {
      setActiveDungeonRun(prev => prev ? { ...prev, completed: true } : null);
      setPlayer(prev => prev ? {
        ...prev,
        statsSummary: { ...prev.statsSummary, dungeonsCleared: prev.statsSummary.dungeonsCleared + 1 }
      } : prev);
    } else {
      setActiveDungeonRun(prev => prev ? { ...prev, currentRoomIndex: nextIndex } : null);
    }
  }, [activeDungeonRun, startBattleWithMonster]);

  const exitDungeon = useCallback(() => {
    setActiveDungeonRun(null);
    sound.playClick();
  }, []);

  // Mining
  const mineNode = useCallback((nodeId: string): { success: boolean; yieldCount: number; isCrit: boolean; oreName: string } => {
    let result = { success: false, yieldCount: 0, isCrit: false, oreName: '' };
    setPlayer(prev => {
      if (!prev) return prev;
      sound.playMining();
      triggerHaptic('medium');

      const isCrit = Math.random() < 0.25;
      let count = Math.floor(Math.random() * 3) + 2;
      if (isCrit) count += 3;

      const oreName = nodeId.includes('iron') ? 'Железная руда' :
                      nodeId.includes('gold') ? 'Золотая руда' :
                      nodeId.includes('mithril') ? 'Мифриловая руда' :
                      nodeId.includes('draconite') ? 'Драконит' : 'Медная руда';

      result = { success: true, yieldCount: count, isCrit, oreName };

      const oreItem: GameItem = {
        id: 'ore_' + Date.now(),
        templateId: nodeId,
        name: oreName,
        type: 'ore',
        rarity: isCrit ? 'rare' : 'common',
        level: 1,
        upgradeLevel: 0,
        icon: '🪨',
        description: 'Сырая руда для переплавки и заточки в кузнице.',
        stats: {},
        sellPrice: 15,
        disassembleYield: { ore: 1 },
        stackCount: count
      };

      // Add to inventory
      const updatedInv = [...prev.inventory];
      if (updatedInv.length < prev.maxInventorySlots) {
        updatedInv.push(oreItem);
      }

      // Mining exp
      const newExp = prev.miningExp + 15;
      const newLevel = prev.miningLevel + (newExp >= prev.miningLevel * 50 ? 1 : 0);

      // Quests update
      setQuests(qList => qList.map(q => q.category === 'mining' ? { ...q, currentCount: q.currentCount + count, completed: (q.currentCount + count) >= q.targetCount } : q));
      setAchievements(aList => aList.map(a => a.id === 'ach_4' ? { ...a, progress: a.progress + count, completed: (a.progress + count) >= a.maxProgress } : a));

      return {
        ...prev,
        inventory: updatedInv,
        miningLevel: newLevel,
        miningExp: newExp,
        statsSummary: {
          ...prev.statsSummary,
          oresMined: prev.statsSummary.oresMined + count
        }
      };
    });
    return result;
  }, []);

  // Alchemy
  const craftAlchemy = useCallback((recipeId: string): boolean => {
    let success = false;
    setPlayer(prev => {
      if (!prev) return prev;
      sound.playPotion();
      triggerHaptic('success');
      success = true;

      const potItem: GameItem = {
        id: 'pot_crafted_' + Date.now(),
        templateId: recipeId,
        name: recipeId.includes('hp') ? 'Великое зелье исцеления' : 'Эликсир берсерка',
        type: 'potion',
        rarity: 'rare',
        level: 1,
        upgradeLevel: 0,
        icon: '🧪',
        description: 'Сваренное вручную алхимическое зелье.',
        stats: {},
        sellPrice: 40,
        disassembleYield: {},
        stackCount: 1
      };

      const updatedInv = [...prev.inventory];
      if (updatedInv.length < prev.maxInventorySlots) {
        updatedInv.push(potItem);
      }

      return {
        ...prev,
        inventory: updatedInv,
        alchemyLevel: prev.alchemyLevel + 1,
        statsSummary: {
          ...prev.statsSummary,
          potionsCrafted: prev.statsSummary.potionsCrafted + 1
        }
      };
    });
    return success;
  }, []);

  // Arena
  const challengeArena = useCallback((opponent: ArenaOpponent) => {
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

    startBattleWithMonster(oppMonster);
  }, [startBattleWithMonster]);

  // Quests & Achievements Claims
  const claimQuestReward = useCallback((questId: string) => {
    setQuests(prev => prev.map(q => {
      if (q.id === questId && q.completed && !q.claimed) {
        sound.playVictory();
        triggerHaptic('success');
        setPlayer(p => p ? {
          ...p,
          gold: p.gold + q.rewardGold,
          silver: p.silver + (q.rewardSilver || 0),
          shards: p.shards + (q.rewardShards || 0),
          crystals: p.crystals + q.rewardCrystals,
          exp: p.exp + q.rewardExp
        } : p);
        return { ...q, claimed: true };
      }
      return q;
    }));
  }, []);

  const claimAchievementReward = useCallback((achievementId: string) => {
    setAchievements(prev => prev.map(a => {
      if (a.id === achievementId && a.completed) {
        sound.playLevelUp();
        triggerHaptic('success');
        setPlayer(p => p ? {
          ...p,
          gold: p.gold + a.rewardGold,
          crystals: p.crystals + a.rewardCrystals
        } : p);
      }
      return a;
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

  const adminAddCrystals = useCallback((amt: number) => {
    setPlayer(p => p ? { ...p, crystals: p.crystals + amt } : p);
    sound.playVictory();
  }, []);

  const adminLevelUp = useCallback(() => {
    setPlayer(p => p ? { ...p, level: p.level + 1, statPoints: p.statPoints + 5, talentPoints: p.talentPoints + 1 } : p);
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
        disassembleYield: { crystals: 50, shards: 20 }
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
      battleLog,
      isInCombat,
      isCombatEnded,
      combatOutcome,
      combatPlayerHp,
      combatPlayerMp,
      turnPhase,
      playerEffects,
      monsterEffects,
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
      startBattleWithMonster,
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
      challengeArena,
      claimQuestReward,
      claimAchievementReward,
      sendChatMessage,
      dismissOfflineReport,
      adminAddGold,
      adminAddCrystals,
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
