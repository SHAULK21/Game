import { CRAFT_RARITY_CHANCES } from '../data/gameData';
export const smithingProgress = (totalXp = 0) => {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = Math.min(100, 1 + Math.floor(xp / 250));
  return { level, xp: level === 100 ? 250 : xp % 250, nextXp: 250 };
};
/** Mastery shifts at most ten percentage points from common to rare. */
export function smithingQuality(totalXp = 0, roll = Math.random()) {
  const shift = Math.min(0.10, (smithingProgress(totalXp).level - 1) * 0.001);
  let cumulative = 0;
  return CRAFT_RARITY_CHANCES.find(q => {
    cumulative += q.chance + (q.rarity === 'common' ? -shift : q.rarity === 'rare' ? shift : 0);
    return roll < cumulative;
  }) || CRAFT_RARITY_CHANCES[4];
}
export const smithingExperience = (recipeLevel: number) => 10 + Math.floor(Math.max(1, recipeLevel) / 2);
