import type { DungeonRun } from '../types/game';

export const getEnergyElixirPrice = (premium: boolean) => premium ? 250 : 500;

export const getDungeonCompletionReward = (level: number, difficulty: DungeonRun['difficulty']) => {
  const multiplier = { normal: 1, hard: 1.5, nightmare: 2, hell: 3 }[difficulty];
  return {
    gold: Math.round((150 + level * 20) * multiplier),
    silver: Math.round((200 + level * 30) * multiplier),
    exp: Math.round((120 + level * 30) * multiplier)
  };
};

export const rollDungeonChest = (level: number, roll = Math.random()) => {
  if (roll < 0.25) return { gold: 0, silver: 0 };
  return { gold: 50 + level * 8, silver: 75 + level * 12 };
};

export const rollDungeonBlessing = (roll = Math.random()) => roll < 0.7
  ? { name: 'Благословение хранителя', remainingBattles: 3 }
  : null;
