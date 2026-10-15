import type {ItemRarity} from '../../types/game';

// Existing mining catalogue. Names are game identifiers in legacy inventories.
export const MINING_EXPEDITION_POOLS: Array<{
  id: string;
  name: string;
  icon: string;
  type: 'ore' | 'material';
  rarity: ItemRarity;
  minLevel: number;
  weight: number;
}> = [
  { id: 'coal', name: 'Уголь', icon: '🪨', type: 'ore', rarity: 'common', minLevel: 1, weight: 18 },
  { id: 'copper', name: 'Медная руда', icon: '🟤', type: 'ore', rarity: 'common', minLevel: 1, weight: 17 },
  { id: 'iron', name: 'Железная руда', icon: '⚪', type: 'ore', rarity: 'common', minLevel: 5, weight: 15 },
  { id: 'herb', name: 'Лечебная трава', icon: '🌿', type: 'material', rarity: 'common', minLevel: 1, weight: 11 },
  { id: 'water', name: 'Чистая вода', icon: '💧', type: 'material', rarity: 'common', minLevel: 1, weight: 10 },
  { id: 'root', name: 'Горный корень', icon: '🌱', type: 'material', rarity: 'uncommon', minLevel: 5, weight: 8 },
  { id: 'silver', name: 'Серебряная руда', icon: '✨', type: 'ore', rarity: 'uncommon', minLevel: 15, weight: 8 },
  { id: 'pollen', name: 'Лунная пыльца', icon: '🌙', type: 'material', rarity: 'uncommon', minLevel: 15, weight: 6 },
  { id: 'gold', name: 'Золотая руда', icon: '🪙', type: 'ore', rarity: 'rare', minLevel: 25, weight: 5 },
  { id: 'gem', name: 'Сырой самоцвет', icon: '💎', type: 'material', rarity: 'rare', minLevel: 25, weight: 4 },
  { id: 'mithril', name: 'Мифриловая руда', icon: '💠', type: 'ore', rarity: 'rare', minLevel: 40, weight: 3 },
  { id: 'essence', name: 'Магическая эссенция', icon: '🔮', type: 'material', rarity: 'rare', minLevel: 40, weight: 2 },
  { id: 'adamantite', name: 'Адамантит', icon: '🟣', type: 'ore', rarity: 'epic', minLevel: 60, weight: 1.5 },
  { id: 'cobalt', name: 'Кобальтовая руда', icon: '🔷', type: 'ore', rarity: 'rare', minLevel: 35, weight: 4 },
  { id: 'obsidian', name: 'Кровавый обсидиан', icon: '🩸', type: 'ore', rarity: 'epic', minLevel: 72, weight: 1.2 },
  { id: 'draconite', name: 'Драконит', icon: '🔥', type: 'ore', rarity: 'ancient', minLevel: 85, weight: 0.5 },
  { id: 'aetherium', name: 'Эфириум', icon: '🌌', type: 'ore', rarity: 'ancient', minLevel: 95, weight: 0.35 },
  { id: 'arcane-dust', name: 'Арканная пыль', icon: '✨', type: 'material', rarity: 'rare', minLevel: 40, weight: 2.3 },
  { id: 'rune-core', name: 'Руническое ядро', icon: '🧿', type: 'material', rarity: 'epic', minLevel: 60, weight: 0.8 },
  { id: 'dragon-scale', name: 'Осколок драконьей чешуи', icon: '🐲', type: 'material', rarity: 'epic', minLevel: 85, weight: 0.7 },
  { id: 'aether-dust', name: 'Эфирная пыль', icon: '🌌', type: 'material', rarity: 'ancient', minLevel: 95, weight: 0.45 }
];
