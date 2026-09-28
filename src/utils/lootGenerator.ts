import { GameItem, ItemRarity, ItemType } from '../types/game';
import { ASSETS } from '../data/gameData';

interface GenerateLootOptions {
  monsterLevel: number;
  isBoss?: boolean;
  rareDropMult?: number;
  goldMult?: number;
  silverMult?: number;
  bonusLuck?: number;
}

const PREFIXES = [
  'Закаленный', 'Темный', 'Древний', 'Рунический', 'Кровавый', 'Призрачный', 
  'Освященный', 'Астральный', 'Титанический', 'Мифический', 'Громовой', 'Пламенный'
];

const WEAPON_NAMES = [
  'Клинок теней', 'Секира гнева', 'Боевой молот', 'Длинный меч стража',
  'Кинжал погибели', 'Посох стихий', 'Коса жнеца', 'Лук сокола'
];

const ARMOR_NAMES = [
  'Латный нагрудник', 'Кольчужная рубаха', 'Мантия магии', 'Кожаная куртка следопыта',
  'Панцирь титана', 'Одеяние чародея'
];

const HELMET_NAMES = [
  'Рогатый боевой шлем', 'Шлем драконьей чешуи', 'Капюшон убийцы', 'Диадема мудрости',
  'Корона владыки'
];

const SHIELD_NAMES = [
  'Эгида света', 'Бастионный щит', 'Круглый щит ополченца', 'Теневой баклер'
];

const ACCESSORY_NAMES = [
  'Амулет вечности', 'Кольцо ненасытности', 'Пояс берсерка', 'Плащ ночного охотника',
  'Талисман ярости', 'Браслет бездны'
];

export function rollRarity(rareMult: number = 1.0, isBoss: boolean = false): ItemRarity {
  const roll = Math.random() / Math.max(0.5, rareMult);
  if (isBoss) {
    if (roll < 0.05) return 'mythic';
    if (roll < 0.20) return 'legendary';
    if (roll < 0.50) return 'epic';
    return 'rare';
  }

  if (roll < 0.005) return 'mythic';
  if (roll < 0.03) return 'legendary';
  if (roll < 0.12) return 'epic';
  if (roll < 0.35) return 'rare';
  if (roll < 0.65) return 'uncommon';
  return 'common';
}

export function generateCombatLoot(opts: GenerateLootOptions): {
  items: GameItem[];
  gold: number;
  silver: number;
  shards: number;
} {
  const { monsterLevel, isBoss = false, rareDropMult = 1.0, goldMult = 1.0, silverMult = 1.0 } = opts;

  // Currency rewards
  const baseGold = (15 + monsterLevel * 6 + Math.floor(Math.random() * 15)) * (isBoss ? 4 : 1);
  const baseSilver = (40 + monsterLevel * 12 + Math.floor(Math.random() * 30)) * (isBoss ? 3 : 1);
  const baseShards = isBoss ? Math.floor(Math.random() * 4) + 2 : (Math.random() < 0.4 ? Math.floor(Math.random() * 2) + 1 : 0);

  const gold = Math.round(baseGold * goldMult);
  const silver = Math.round(baseSilver * silverMult);
  const shards = baseShards;

  // Roll item drops count: 80% chance for at least 1 item, bosses drop 2-4 items
  const items: GameItem[] = [];
  const itemCount = isBoss ? Math.floor(Math.random() * 3) + 2 : (Math.random() < 0.85 ? (Math.random() < 0.4 ? 2 : 1) : 0);

  const itemTypes: ItemType[] = ['weapon', 'offhand', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet', 'belt', 'cloak', 'potion'];

  for (let i = 0; i < itemCount; i++) {
    const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    const rarity = rollRarity(rareDropMult, isBoss);

    if (type === 'potion') {
      const isLarge = monsterLevel > 15 || rarity === 'rare' || rarity === 'epic';
      items.push({
        id: 'drop_pot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        templateId: isLarge ? 'pot_hp_large' : 'pot_hp_small',
        name: isLarge ? 'Великое зелье исцеления' : 'Малое зелье исцеления',
        type: 'potion',
        rarity: isLarge ? 'rare' : 'common',
        level: monsterLevel,
        upgradeLevel: 0,
        icon: '🧪',
        description: isLarge ? 'Восстанавливает 350 ед. здоровья в бою.' : 'Восстанавливает 150 ед. здоровья в бою.',
        stats: {},
        sellPrice: 15 + monsterLevel * 2,
        disassembleYield: { shards: 1 },
        stackCount: Math.floor(Math.random() * 2) + 1
      });
      continue;
    }

    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    let baseName = '';
    let icon = '📦';
    let image: string | undefined = undefined;

    if (type === 'weapon') {
      baseName = WEAPON_NAMES[Math.floor(Math.random() * WEAPON_NAMES.length)];
      icon = '🗡️';
      if (rarity === 'legendary' || rarity === 'mythic') image = ASSETS.relicWeapon;
    } else if (type === 'offhand') {
      baseName = SHIELD_NAMES[Math.floor(Math.random() * SHIELD_NAMES.length)];
      icon = '🛡️';
      if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
        image = ASSETS.itemRelicShield;
      }
    } else if (type === 'helmet') {
      baseName = HELMET_NAMES[Math.floor(Math.random() * HELMET_NAMES.length)];
      icon = '🪖';
      if (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
        image = ASSETS.itemRelicHelm;
      }
    } else if (type === 'armor') {
      baseName = ARMOR_NAMES[Math.floor(Math.random() * ARMOR_NAMES.length)];
      icon = '🥋';
    } else if (type === 'ring' || type === 'amulet') {
      baseName = ACCESSORY_NAMES[Math.floor(Math.random() * ACCESSORY_NAMES.length)];
      icon = type === 'ring' ? '💍' : '📿';
    } else {
      baseName = `${type === 'gloves' ? 'Перчатки' : type === 'boots' ? 'Сапоги' : type === 'belt' ? 'Пояс' : 'Плащ'} странника`;
      icon = type === 'gloves' ? '🧤' : type === 'boots' ? '👢' : type === 'belt' ? '🥋' : '🧥';
    }

    const fullName = `${prefix} ${baseName}`;

    // Stat generation scaled by level and rarity
    const rarityMultiplier: Record<ItemRarity, number> = {
      common: 1.0,
      uncommon: 1.25,
      rare: 1.6,
      epic: 2.1,
      legendary: 2.8,
      mythic: 3.8,
      ancient: 4.8,
      divine: 6.0
    };

    const mult = rarityMultiplier[rarity];
    const stats: Record<string, number> = {};

    let baseAttack: number | undefined = undefined;
    let baseDefense: number | undefined = undefined;
    let baseMagicDef: number | undefined = undefined;

    if (type === 'weapon') {
      baseAttack = Math.round((10 + monsterLevel * 3.5) * mult);
      stats.attack = baseAttack;
      if (rarity !== 'common') {
        stats.critChance = Math.min(25, Math.round(3 + mult * 2));
        stats.armorPenetration = Math.round(monsterLevel * 1.2 * mult);
        if (rarity === 'legendary' || rarity === 'mythic') {
          stats.vampirism = Math.min(20, Math.round(4 + mult * 1.5));
          stats.critDamage = Math.round(15 * mult);
        }
      }
    } else if (type === 'offhand' || type === 'armor' || type === 'helmet' || type === 'boots' || type === 'gloves') {
      baseDefense = Math.round((6 + monsterLevel * 2.2) * mult);
      baseMagicDef = Math.round((4 + monsterLevel * 1.8) * mult);
      stats.defense = baseDefense;
      stats.magicDefense = baseMagicDef;
      stats.maxHp = Math.round((20 + monsterLevel * 10) * mult);
      if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
        stats.hpRegen = Math.round(2 + mult);
        stats.evasion = Math.min(18, Math.round(2 + mult * 1.5));
      }
    } else {
      // Accessories
      stats.maxHp = Math.round((15 + monsterLevel * 8) * mult);
      stats.maxMp = Math.round((10 + monsterLevel * 6) * mult);
      if (rarity !== 'common') {
        stats.critChance = Math.min(15, Math.round(2 + mult));
        stats.vampirism = Math.min(15, Math.round(2 + mult));
        stats.armorPenetration = Math.round(monsterLevel * 0.8 * mult);
      }
    }

    const newItem: GameItem = {
      id: 'loot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      templateId: 'item_' + fullName.toLowerCase().replace(/\s+/g, '_'),
      name: fullName,
      type,
      rarity,
      level: monsterLevel,
      upgradeLevel: 0,
      icon,
      image,
      description: `Уровень ${monsterLevel}. Добыто в бою с монстрами.`,
      baseAttack,
      baseDefense,
      baseMagicDef,
      stats,
      sellPrice: Math.round((15 + monsterLevel * 5) * mult),
      disassembleYield: {
        ore: Math.max(1, Math.floor(monsterLevel / 2)),
        shards: rarity === 'common' ? 1 : rarity === 'uncommon' ? 2 : rarity === 'rare' ? 4 : rarity === 'epic' ? 8 : 15
      },
      stackCount: 1
    };

    items.push(newItem);
  }

  return { items, gold, silver, shards };
}
