import { PlayerCharacter } from '../types/game';

export interface ExperienceResult {
  player: PlayerCharacter;
  levelsGained: number;
}

/**
 * XP required to advance from the given level.
 * Level 1 starts at 160 XP, then scales steeply to make progression a long-term grind.
 */
export const getNextExperience = (level: number): number =>
  Math.max(160, Math.round(160 * Math.pow(Math.max(1, level), 2.05)));

/**
 * Adds XP and resolves all level-ups in one place.
 * XP is allowed to overflow through multiple levels in one reward.
 */
export function addExperience(player: PlayerCharacter, amount: number): ExperienceResult {
  const gained = Math.max(0, Math.floor(amount));
  let level = player.level;
  let exp = Math.max(0, player.exp) + gained;
  let nextExp = player.nextExp > 0 ? player.nextExp : getNextExperience(level);
  let statPoints = player.statPoints;
  let talentPoints = player.talentPoints;
  let levelsGained = 0;

  while (exp >= nextExp) {
    exp -= nextExp;
    level += 1;
    nextExp = getNextExperience(level);
    statPoints += 5;
    talentPoints += 1;
    levelsGained += 1;
  }

  return {
    levelsGained,
    player: {
      ...player,
      level,
      exp,
      nextExp,
      statPoints,
      talentPoints
    }
  };
}
