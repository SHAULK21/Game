import { GameItem, ItemRarity, ItemType, Monster, MonsterDrop } from '../types/game';
import { ASSETS } from '../data/gameData';

interface GenerateLootOptions {
  monster: Monster;
  rareDropMult?: number;
  goldMult?: number;
  silverMult?: number;
}

const RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.6,
  epic: 2.1,
  legendary: 2.8,
  mythic: 3.8,
  ancient: 4.8,
  divine: 6
};

const EQUIPMENT_TYPES: ItemType[] = [
  'weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves',
  'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'
];

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_|_$/g, '');

function makeDropItem(drop: MonsterDrop, monsterLevel: number, index: number): GameItem {
  const qty = Math.floor(drop.minQty + Math.random() * (drop.maxQty - drop.minQty + 1));
  const mult = RARITY_MULTIPLIER[drop.rarity] ?? 1;
  const isEquipment = EQUIPMENT_TYPES.includes(drop.type);
  const idBase = `drop_${monsterLevel}_${slugify(drop.itemName)}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;

  let icon = '🧩';
  let baseAttack: number | undefined;
  let baseDefense: number | undefined;
  let baseMagicDef: number | undefined;
  let stats: Record<string, number> = {};

  if (drop.type === 'weapon') {
    icon = '🗡️';
    baseAttack = Math.round((10 + monsterLevel * 3.5) * mult);
    stats = { attack: baseAttack };
  } else if (drop.type === 'offhand') {
    icon = '🛡️';
    baseDefense = Math.round((6 + monsterLevel * 2.2) * mult);
    baseMagicDef = Math.round((4 + monsterLevel * 1.8) * mult);
    stats = { defense: baseDefense, magicDefense: baseMagicDef };
  } else if (['armor', 'helmet', 'pants', 'gloves', 'boots'].includes(drop.type)) {
    icon = drop.type === 'helmet' ? '🪖' : drop.type === 'pants' ? '👖' : drop.type === 'boots' ? '👢' : drop.type === 'gloves' ? '🧤' : '🥋';
    baseDefense = Math.round((6 + monsterLevel * 2.2) * mult);
    baseMagicDef = Math.round((4 + monsterLevel * 1.8) * mult);
    stats = {
      defense: baseDefense,
      magicDefense: baseMagicDef,
      maxHp: Math.round((20 + monsterLevel * 10) * mult)
    };
  } else if (['ring', 'amulet', 'belt', 'cloak'].includes(drop.type)) {
    icon = drop.type === 'ring' ? '💍' : drop.type === 'amulet' ? '📿' : drop.type === 'belt' ? '🥋' : '🧥';
    stats = {
      maxHp: Math.round((15 + monsterLevel * 8) * mult),
      maxMp: Math.round((10 + monsterLevel * 6) * mult)
    };
  } else if (drop.type === 'artifact') {
    icon = '🔮';
    stats = {
      maxHp: Math.round((30 + monsterLevel * 12) * mult),
      maxMp: Math.round((20 + monsterLevel * 8) * mult)
    };
  } else if (drop.type === 'potion') {
    icon = '🧪';
    const isLarge = monsterLevel >= 15 || ['rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity);
    stats = { heal: isLarge ? 350 : 150 };
  } else if (drop.type === 'ore') {
    icon = '⛏️';
  }

  if (isEquipment) {
    if (drop.rarity !== 'common') stats.critChance = Math.min(20, Math.round(2 + mult));
    if (['rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity)) {
      stats.hpRegen = Math.round(1 + mult);
    }
    if (['legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity)) {
      stats.vampirism = Math.min(20, Math.round(2 + mult));
    }
  }

  return {
    id: idBase,
    templateId: drop.templateId || `drop_${slugify(drop.itemName)}`,
    name: drop.itemName,
    type: drop.type,
    rarity: drop.rarity,
    level: monsterLevel,
    upgradeLevel: 0,
    icon,
    image:
      ['legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity)
        ? drop.type === 'weapon'
          ? ASSETS.relicWeapon
          : drop.type === 'helmet'
            ? ASSETS.itemRelicHelm
            : drop.type === 'offhand'
              ? ASSETS.itemRelicShield
              : undefined
        : undefined,
    description: `Трофей из ${monsterLevel} уровня противника.`,
    baseAttack,
    baseDefense,
    baseMagicDef,
    stats,
    sellPrice: Math.max(1, Math.round((10 + monsterLevel * 4) * mult)),
    disassembleYield: {
      ore: isEquipment ? Math.max(1, Math.floor(monsterLevel / 3)) : 0,
      shards:
        drop.rarity === 'common' ? 1 :
        drop.rarity === 'uncommon' ? 2 :
        drop.rarity === 'rare' ? 4 :
        drop.rarity === 'epic' ? 8 : 15
    },
    stackCount: Math.max(1, qty)
  };
}

export function generateCombatLoot(opts: GenerateLootOptions): {
  items: GameItem[];
  gold: number;
  silver: number;
  shards: number;
} {
  const { monster, rareDropMult = 1, goldMult = 1, silverMult = 1 } = opts;

  const baseGold = (15 + monster.level * 6 + Math.floor(Math.random() * 15)) * (monster.isBoss ? 4 : 1);
  const baseSilver = (40 + monster.level * 12 + Math.floor(Math.random() * 30)) * (monster.isBoss ? 3 : 1);
  const shards = monster.isBoss
    ? Math.floor(Math.random() * 4) + 2
    : Math.random() < 0.4
      ? Math.floor(Math.random() * 2) + 1
      : 0;

  const items: GameItem[] = [];
  (monster.drops || []).forEach((drop, index) => {
    const affectsChance = ['rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity);
    const chance = Math.min(1, drop.chance * (affectsChance ? Math.max(0.1, rareDropMult) : 1));
    if (Math.random() <= chance) items.push(makeDropItem(drop, monster.level, index));
  });

  return {
    items,
    gold: Math.max(0, Math.round(baseGold * goldMult)),
    silver: Math.max(0, Math.round(baseSilver * silverMult)),
    shards
  };
}
