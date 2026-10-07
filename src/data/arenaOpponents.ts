import type { ArenaOpponent } from '../types/game';

export const ARENA_BOTS: ArenaOpponent[] = [
  {
    id: 'opp_1',
    portrait: '/assets/arena/opp_1.webp',
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
    portrait: '/assets/arena/opp_2.webp',
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
    portrait: '/assets/arena/opp_3.webp',
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
    portrait: '/assets/arena/opp_4.webp',
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
    portrait: '/assets/arena/opp_5.webp',
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
    portrait: '/assets/arena/opp_6.webp',
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

