import type {AscensionState} from '../data/ascension';
export type ItemRarity = 
  | 'common' 
  | 'uncommon' 
  | 'rare' 
  | 'epic' 
  | 'legendary' 
  | 'mythic' 
  | 'ancient' 
  | 'divine';

export type ItemType = 
  | 'weapon' 
  | 'offhand' 
  | 'helmet' 
  | 'armor' 
  | 'pants' 
  | 'gloves' 
  | 'boots' 
  | 'amulet' 
  | 'ring' 
  | 'belt' 
  | 'cloak' 
  | 'pet'
  | 'pickaxe'
  | 'alchemyTool'
  | 'artifact' 
  | 'potion' 
  | 'ore' 
  | 'material';

export type CharacterClassId = 
  | 'warrior' 
  | 'berserker' 
  | 'knight' 
  | 'rogue' 
  | 'assassin' 
  | 'archer' 
  | 'mage' 
  | 'necromancer' 
  | 'paladin' 
  | 'druid';

export type DamageType = 
  | 'physical' 
  | 'magic' 
  | 'true' 
  | 'fire' 
  | 'ice' 
  | 'lightning' 
  | 'poison' 
  | 'dark' 
  | 'holy';

export type StatusEffectType = 
  | 'poison' 
  | 'bleed' 
  | 'burn' 
  | 'freeze' 
  | 'stun' 
  | 'shield' 
  | 'vulnerability' 
  | 'haste' 
  | 'focus'
  | 'fury'
  | 'fortify'
  | 'invulnerable';

export interface StatusEffect {
  type: StatusEffectType;
  name: string;
  duration: number; // turns
  value: number; // damage or shield amount
  stacks?: number;
}

export interface ItemAffix {
  stat: string;
  name: string;
  value: number;
  isPercent?: boolean;
}

export interface GameItem {
  id: string;
  templateId: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  image?: string;
  level: number;
  upgradeLevel: number; // +0 to +25
  icon: string;
  description?: string;
  baseAttack?: number;
  baseDefense?: number;
  baseMagicDef?: number;
  stats: Record<string, number>;
  affixes?: ItemAffix[];
  sellPrice: number;
  disassembleYield: {
    ore?: number;
    silver?: number;
  };
  stackCount?: number;
  isEquipped?: boolean;
  isLocked?: boolean;
  armorClass?: 'heavy' | 'medium' | 'light';
  weaponClass?: 'twoHanded' | 'dagger' | 'staff' | 'shield' | 'bow';
  targetClass?: CharacterClassId;
  boundToClan?: string;
  serverOwned?: boolean;
}

export interface CharacterAttributes {
  strength: number; // physical attack, carry weight
  agility: number; // speed, evasion, crit chance
  intelligence: number; // magic attack, max mana
  vitality: number; // max health, physical defense
  luck: number; // drop rate, crit damage, mining crit
  spirit: number; // mana regen, magic defense
  willpower: number; // status resistance, health regen
}

export interface ResistanceMap {
  physical: number;
  magic: number;
  fire: number;
  ice: number;
  lightning: number;
  poison: number;
  dark: number;
  holy: number;
}

export interface CombatStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  energy: number;
  maxEnergy: number;
  stamina: number;
  maxStamina: number;

  attack: number;
  magicAttack: number;
  defense: number;
  magicDefense: number;
  speed: number;
  accuracy: number;
  evasion: number;
  critChance: number; // %
  critDamage: number; // % e.g. 150 = 1.5x
  armorPenetration: number;
  vampirism: number; // % lifesteal
  hpRegen: number;
  mpRegen: number;

  dropBonus: number; // %
  goldBonus: number; // %
  expBonus: number; // %

  resistances: ResistanceMap;
}

export interface Skill {
  id: string;
  name: string;
  classId: CharacterClassId;
  description: string;
  levelReq: number;
  manaCost: number;
  cooldown: number; // in turns
  currentCooldown: number;
  damageMultiplier: number;
  damageType: DamageType;
  healMultiplier?: number;
  inflicts?: {
    type: StatusEffectType;
    chance: number;
    duration: number;
    power: number;
  };
  icon: string;
  isUltimate?: boolean;
  hidden?: boolean;
  hits?: number;
  comboFrom?: string;
  comboMultiplier?: number;
  guaranteedHit?: boolean;
  guaranteedEvade?: boolean;
  executeThreshold?: number;
  executeMultiplier?: number;
  instantExecutePve?: boolean;
  poisonBurst?: boolean;
  armorBreak?: number;
}

export interface Talent {
  branch?: 'damage' | 'survival' | 'class' | 'mastery' | 'legacy';
  branchName?: string;
  levelReq?: number;
  branchPointsReq?: number;
  pointCost?: number;
  effects?: Array<{ stat: string; valuePerRank: number; isPercent?: boolean }>;
  id: string;
  name: string;
  description: string;
  tier: number;
  maxRank: number;
  currentRank: number;
  icon: string;
  effect: {
    stat: string;
    valuePerRank: number;
    isPercent?: boolean;
  };
}

export interface MonsterDrop {
  templateId?: string;
  itemName: string;
  type: ItemType;
  rarity: ItemRarity;
  chance: number; // 0 to 1
  minQty: number;
  maxQty: number;
}

export interface MonsterSkill {
  id: string;
  name: string;
  icon: string;
  manaCost: number;
  cooldown: number;
  currentCooldown?: number;
  damageMultiplier: number;
  damageType: DamageType;
  effect?: StatusEffectType;
  effectChance?: number;
  effectDuration?: number;
  effectPower?: number;
  description?: string;
}

export interface Monster {
  huntingModeId?: string;
  id: string;
  name: string;
  regionId: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  magicAttack: number;
  defense: number;
  magicDefense: number;
  speed: number;
  critChance: number;
  evasion: number;
  damageType?: DamageType;
  resistances?: Partial<ResistanceMap>;
  isBoss?: boolean;
  isElite?: boolean;
  bossPhase?: number;
  bossEnrageTurn?: number;
  avatar: string;
  expReward: number;
  goldReward: number;
  drops: MonsterDrop[];
  skills?: MonsterSkill[];
}

export interface BattleLogEntry {
  id: string;
  turn: number;
  text: string;
  type: 'player-attack' | 'monster-attack' | 'crit' | 'skill' | 'heal' | 'status' | 'death' | 'flee' | 'system';
}

export interface AutoBattleSettings {
  enabled: boolean;
  healAtHpPercent: number; // e.g. 40
  useSkills: boolean;
  useUltimate: boolean;
  fleeAtHpPercent: number; // e.g. 15
  autoRebattle: boolean;
  maxBattles: number;
}

export interface DungeonRoom {
  id: string;
  roomNumber: number;
  type: 'combat' | 'elite' | 'treasure' | 'shrine' | 'trap' | 'merchant' | 'boss';
  title: string;
  description: string;
  resolved: boolean;
  monster?: Monster;
  rewardClaimed?: boolean;
}

export interface DungeonRun {
  dungeonId: string;
  dungeonName: string;
  difficulty: 'normal' | 'hard' | 'nightmare' | 'hell';
  totalRooms: number;
  currentRoomIndex: number;
  rooms: DungeonRoom[];
  completed: boolean;
  kills?: number;
  resurrectionUsed?: boolean;
  savedHp?: number;
  savedMp?: number;
  blessings?: string[];
  temporaryBlessing?: { name: string; remainingBattles: number } | null;
  completionReward?: { gold: number; silver: number; exp: number };
  lastEvent?: string;
}

export interface MiningExpeditionReward {
  name: string;
  icon: string;
  type: 'ore' | 'material';
  rarity: ItemRarity;
  count: number;
}

export interface MiningExpedition {
  durationHours: 1 | 3 | 7;
  startedAt: number;
  endsAt: number;
  rewards: MiningExpeditionReward[];
}

export interface MiningNode {
  id: string;
  name: string;
  levelReq: number;
  oreYield: string;
  staminaCost: number;
  icon: string;
  color: string;
  baseYieldMin: number;
  baseYieldMax: number;
  gemChance: number;
}

export interface BasicCraftRecipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  levelReq?: number;
  miningLevelReq?: number;
  regionId?: string;
  ingredients: { name: string; count: number }[];
  result?: {
    targetClass?: CharacterClassId;
    name: string;
    type: ItemType;
    rarity: ItemRarity;
    icon: string;
    stats: Record<string, number>;
    sellPrice: number;
    count: number;
    level?: number;
  };
  silverReward?: number;
}

export interface AlchemyRecipe {
  id: string;
  resultItem: string;
  resultCount: number;
  name: string;
  description: string;
  levelReq: number;
  craftTimeSeconds: number;
  icon: string;
  ingredients: {
    name: string;
    count: number;
    have?: number;
  }[];
}

export interface Quest {
  id: string;
  title: string;
  category: 'story' | 'daily' | 'hunting' | 'mining' | 'boss';
  description: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  claimed: boolean;
  targetMonsterId?: string;
  targetMonsterName?: string;
  targetRegionId?: string;
  targetRegionName?: string;
  rewardGold: number;
  rewardSilver?: number;
  rewardExp: number;
  rewardItems?: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  maxProgress: number;
  completed: boolean;
  claimed?: boolean;
  permanentBonusDesc: string;
  rewardGold: number;
  rewardSilver?: number;
}

export interface ArenaOpponent {
  id: string;
  name: string;
  characterClass: CharacterClassId;
  level: number;
  powerRating: number;
  rating: number;
  avatar: string;
  league: 'Бронза' | 'Серебро' | 'Золото' | 'Платина' | 'Алмаз' | 'Мастер';
  stats: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    critChance: number;
  };
}

export interface Pet {
  id: string;
  name: string;
  level: number;
  rarity: ItemRarity;
  icon: string;
  passiveBonus: string;
  stats: Partial<Record<keyof CharacterAttributes | keyof CombatStats, number>>;
  activeSkillName?: string;
  activeSkillDesc?: string;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  level: number;
  membersCount: number;
  maxMembers: number;
  treasuryGold: number;
  perks: {
    name: string;
    level: number;
    bonusDesc: string;
  }[];
  raidBoss: {
    name: string;
    hp: number;
    maxHp: number;
    level: number;
  };
}

export interface ChatMessage {
  id: string;
  sender: string;
  clanTag?: string;
  isVip?: boolean;
  isAdmin?: boolean;
  text: string;
  channel: 'global' | 'clan' | 'battle';
  timestamp: string;
}

export interface PlayerStatsSummary {
  monstersKilled: number;
  bossesDefeated: number;
  battlesWon: number;
  battlesLost: number;
  totalDamageDealt: number;
  highestCrit: number;
  oresMined: number;
  potionsCrafted: number;
  itemsUpgraded: number;
  maxUpgradeReached: number;
  dungeonsCleared: number;
}

export interface PlayerCharacter {
  id: string;
  userId: string;
  name: string;
  classId: CharacterClassId;
  level: number;
  exp: number;
  nextExp: number;
  statPoints: number;
  talentPoints: number;
  lastBulkDisposalId?: string;
  ascension?: AscensionState;
  lastMarketListingOperation?: string;
  reservedClanCreationOperation?: string;
  lastClanCreationOperation?: string;

  gold: number;
  silver: number;
  energy: number;
  maxEnergy: number;
  lastEnergyRegenTimestamp?: number;
  stamina: number;
  maxStamina: number;

  attributes: CharacterAttributes;
  equipped: Partial<Record<ItemType, GameItem>>;
  inventory: GameItem[];
  maxInventorySlots: number;
  marketIncomeReceived?: number;

  talents: Talent[];
  skills: Skill[];
  unlockedHiddenSkills?: string[];
  activePet?: Pet;
  craftedPetIds?: string[];

  smithingXp?: number;
  miningLevel: number;
  miningExp: number;
  alchemyLevel: number;
  alchemyExp: number;
  alchemyEnergy: number;
  maxAlchemyEnergy: number;
  miningExpedition?: MiningExpedition;

  arenaRating: number;
  arenaTickets: number;
  lastArenaTicketRefresh?: string;
  bossTicketDay?: string;
  bossTicketsToday?: number;
  arenaLeague: string;

  clanId?: string;
  statsSummary: PlayerStatsSummary;

  lastActiveTimestamp: number;
  lastMeditationTimestamp?: number;
  currentRegionId: string;
  activeRegionModId?: string;
}

export interface RegionModifier {
  id: string;
  name: string;
  description: string;
  icon: string;
  badgeColor: string;
  energyCost: number;
  ambushChance: number; // e.g. 0.15 = 15%
  damageMultiplier: number;
  hpMultiplier?: number;
  defenseMultiplier?: number;
  expMultiplier: number;
  goldMultiplier: number;
  silverMultiplier: number;
  rareDropMultiplier: number;
  bonusArmorPenetration?: number;
  bonusVampirism?: number;
  bonusRegen?: number;
}

export interface TravelState {
  isTraveling: boolean;
  targetRegionId: string;
  targetRegionName: string;
  progress: number; // 0 - 100
  isAmbush: boolean;
  message: string;
}
