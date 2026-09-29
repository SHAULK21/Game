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

const isEquipmentDrop = (drop: MonsterDrop) => EQUIPMENT_TYPES.includes(drop.type);

function makeDropItem(drop: MonsterDrop, monsterLevel: number, index: number): GameItem {
  const qty = Math.floor(drop.minQty + Math.random() * (drop.maxQty - drop.minQty + 1));
  const mult = RARITY_MULTIPLIER[drop.rarity] ?? 1;
  const idBase = `drop_${monsterLevel}_${slugify(drop.itemName)}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;

  let icon = '📦';
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

  if (isEquipmentDrop(drop)) {
    if (drop.rarity !== 'common') stats.critChance = Math.min(20, Math.round(2 + mult));
    if (['rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity)) {
      stats.hpRegen = Math.round(1 + mult);
    }
    if (['legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity)) {
      stats.vampirism = Math.min(20, Math.round(2 + mult));
    }
  }

  const salvageSilver = Math.max(3, Math.round((10 + monsterLevel * 4) * mult * (isEquipmentDrop(drop) ? 0.8 : 0.45)));

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
      ore: isEquipmentDrop(drop) ? Math.max(1, Math.floor(monsterLevel / 3)) : 0,
      silver: salvageSilver
    },
    stackCount: Math.max(1, qty)
  };
}

const rarityMultiplierForRoll = (drop: MonsterDrop, rareDropMult: number) => {
  const rare = ['rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'].includes(drop.rarity);
  const base =
    drop.rarity === 'common' ? 1.22 :
    drop.rarity === 'uncommon' ? 1.18 :
    drop.rarity === 'rare' ? 1.12 :
    1.04;
  return base * (rare ? Math.max(0.2, rareDropMult) : 1);
};

const pickBestFallback = (drops: MonsterDrop[], exclude = new Set<string>()) => {
  const candidates = drops.filter(drop => !exclude.has(drop.templateId || drop.itemName));
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    const aScore = (a.rarity === 'common' ? 1 : a.rarity === 'uncommon' ? 2 : a.rarity === 'rare' ? 3 : 4) + (isEquipmentDrop(a) ? 0.75 : 0);
    const bScore = (b.rarity === 'common' ? 1 : b.rarity === 'uncommon' ? 2 : b.rarity === 'rare' ? 3 : 4) + (isEquipmentDrop(b) ? 0.75 : 0);
    return bScore - aScore;
  })[0];
};

const PROCEDURAL_NAMES: Partial<Record<ItemType, string[]>> = {
  weapon: ['Клинок охотника', 'Сабля странника', 'Боевой топор', 'Костяной меч', 'Рунический жезл'],
  offhand: ['Щит дозорного', 'Рунический фокус', 'Баклер наёмника'],
  helmet: ['Капюшон следопыта', 'Шлем стража', 'Маска охотника'],
  armor: ['Кожаный панцирь', 'Кольчуга странника', 'Роба заклинателя'],
  pants: ['Поножи дозорного', 'Штаны охотника', 'Рунические поножи'],
  gloves: ['Перчатки следопыта', 'Боевые рукавицы', 'Чародейские перчатки'],
  boots: ['Сапоги разведчика', 'Ботфорты стража', 'Шаги тени'],
  amulet: ['Амулет охотника', 'Талисман искр', 'Оберег древних'],
  ring: ['Кольцо удачи', 'Печатка воина', 'Руническое кольцо'],
  belt: ['Пояс наёмника', 'Ремень мастера', 'Пояс клыков'],
  cloak: ['Плащ тумана', 'Накидка охотника', 'Плащ странника'],
  artifact: ['Осколок реликвии', 'Древний тотем', 'Руническое ядро']
};

const rollProceduralRarity = (monster: Monster, rareDropMult: number): ItemRarity => {
  const roll = Math.random() / Math.max(0.65, Math.min(2.5, rareDropMult));
  if (monster.isBoss && roll < 0.05) return 'legendary';
  if (roll < 0.02) return 'epic';
  if (roll < 0.10) return 'rare';
  if (roll < 0.30) return 'uncommon';
  return 'common';
};

const makeProceduralEquipment = (monster: Monster, rareDropMult: number, index: number): GameItem => {
  const type = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];
  const names = PROCEDURAL_NAMES[type] || ['Трофей странника'];
  const rarity = rollProceduralRarity(monster, rareDropMult);
  const prefix =
    rarity === 'legendary' ? 'Легендарный ' :
    rarity === 'epic' ? 'Эпический ' :
    rarity === 'rare' ? 'Редкий ' :
    rarity === 'uncommon' ? 'Улучшенный ' : '';
  const drop: MonsterDrop = {
    itemName: prefix + names[Math.floor(Math.random() * names.length)],
    type,
    rarity,
    chance: 1,
    minQty: 1,
    maxQty: 1
  };
  return makeDropItem(drop, monster.level, index);
};

export function generateCombatLoot(opts: GenerateLootOptions): {
  items: GameItem[];
  gold: number;
  silver: number;
} {
  const { monster, rareDropMult = 1, goldMult = 1, silverMult = 1 } = opts;
  const drops = monster.drops || [];
  const items: GameItem[] = [];
  const droppedKeys = new Set<string>();

  // Roll every table entry first. Drops are deliberately plentiful, but rarity stays controlled.
  drops.forEach((drop, index) => {
    const key = drop.templateId || drop.itemName;
    const chance = Math.min(0.92, Math.max(0.03, drop.chance * rarityMultiplierForRoll(drop, rareDropMult)));
    if (Math.random() <= chance) {
      items.push(makeDropItem(drop, monster.level, index));
      droppedKeys.add(key);
    }
  });

  // Every normal kill yields at least one trophy. This prevents "empty" fights.
  if (!items.length && drops.length) {
    const fallback = pickBestFallback(drops);
    if (fallback) {
      items.push(makeDropItem(fallback, monster.level, 99));
      droppedKeys.add(fallback.templateId || fallback.itemName);
    }
  }

  // Normal combat usually grants a second distinct item.
  if (drops.length > 1 && items.length < 2 && Math.random() < 0.82) {
    const fallback = pickBestFallback(drops, droppedKeys);
    if (fallback) {
      items.push(makeDropItem(fallback, monster.level, 100));
      droppedKeys.add(fallback.templateId || fallback.itemName);
    }
  }

  // About one fight in three gets a third distinct item; this is where variety becomes visible.
  if (drops.length > 2 && items.length < 3 && Math.random() < 0.34 + Math.min(0.18, Math.max(0, rareDropMult - 1) * 0.12)) {
    const fallback = pickBestFallback(drops, droppedKeys);
    if (fallback) items.push(makeDropItem(fallback, monster.level, 101));
  }

  // If the table has equipment and the fight produced only resources, give equipment a modest extra roll.
  if (items.length < 2 && drops.some(isEquipmentDrop) && Math.random() < 0.55 * Math.max(0.5, rareDropMult)) {
    const equipment = pickBestFallback(drops.filter(isEquipmentDrop), droppedKeys);
    if (equipment) items.push(makeDropItem(equipment, monster.level, 102));
  }

  // Procedural equipment keeps ordinary fights visually diverse even when a monster has a small fixed drop table.
  const proceduralChance = monster.isBoss ? 0.95 : monster.isElite ? 0.72 : 0.48;
  if (items.length < 4 && Math.random() < proceduralChance * Math.min(1.35, Math.max(0.75, rareDropMult))) {
    items.push(makeProceduralEquipment(monster, rareDropMult, 200 + items.length));
  }

  // Bosses always leave at least two distinct tangible rewards.
  while (monster.isBoss && items.length < 2) {
    items.push(makeProceduralEquipment(monster, Math.max(1.25, rareDropMult), 300 + items.length));
  }

  const goldVariance = 0.9 + Math.random() * 0.2;
  const baseGold = Math.max(0, Math.round(monster.goldReward * goldVariance));
  const baseSilver = Math.max(1, 35 + monster.level * 10 + Math.floor(Math.random() * 20));

  return {
    items,
    gold: Math.max(0, Math.round(baseGold * goldMult)),
    silver: Math.max(1, Math.round(baseSilver * silverMult))
  };
}
