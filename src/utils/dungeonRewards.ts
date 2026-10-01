import type { Monster, DungeonRun } from '../types/game';

export const getEnergyElixirPrice = (premium: boolean) => premium ? 250 : 500;

export const getDungeonCompletionReward = (level: number, difficulty: DungeonRun['difficulty']) => {
  const multiplier = { normal: 1, hard: 1.5, nightmare: 2, hell: 3 }[difficulty];
  return {
    gold: Math.round((45 + level * 6) * multiplier),
    silver: Math.round((30 + level * 4) * multiplier),
    exp: Math.round((120 + level * 30) * multiplier)
  };
};

export const rollDungeonChest = (level: number, roll = Math.random()) => {
  if (roll < 0.25) return { gold: 0, silver: 0 };
  return { gold: 15 + level * 2, silver: 10 + level * 2 };
};

export const rollDungeonBlessing = (roll = Math.random()) => roll < 0.7
  ? { name: 'Благословение хранителя', remainingBattles: 3 }
  : null;

export const DUNGEON_DIFFICULTIES = {
  normal: { hp: 1, damage: 1, defense: 1 },
  hard: { hp: 1.5, damage: 1.25, defense: 1.15 },
  nightmare: { hp: 2.1, damage: 1.55, defense: 1.3 },
  hell: { hp: 3, damage: 2, defense: 1.5 }
} as const;
export function applyDungeonDifficulty(monster: Monster, difficulty: DungeonRun['difficulty']): Monster {
  const m = DUNGEON_DIFFICULTIES[difficulty];
  if (!m) throw new Error('Неизвестная сложность подземелья.');
  const hp = Math.round(monster.maxHp * m.hp);
  return { ...monster, hp, maxHp: hp, attack: Math.round(monster.attack * m.damage),
    magicAttack: Math.round(monster.magicAttack * m.damage), defense: Math.round(monster.defense * m.defense),
    magicDefense: Math.round(monster.magicDefense * m.defense) };
}
