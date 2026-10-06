import type { Monster, PlayerCharacter } from '../types/game';

export interface RegionProgress { kills: number; eliteWins: number; bossWins: number }
export const ELITE_HUNT_REQUIREMENT = 6;
export const BOSS_HUNT_REQUIREMENT = 2;

export function regionProgress(player: PlayerCharacter, region: { id: string; minLevel: number }): RegionProgress {
  const saved = player.regionProgress?.[region.id];
  if (saved) return saved;
  // Existing heroes keep access to previously reached regions. New characters
  // have an explicit empty map and earn each step through hunting.
  if (!player.regionProgress && player.level >= region.minLevel && (player.statsSummary?.monstersKilled || 0) >= 6) {
    return { kills: 6, eliteWins: 2, bossWins: 1 };
  }
  return { kills: 0, eliteWins: 0, bossWins: 0 };
}

export function migrateRegionProgress(player: PlayerCharacter, regions: Array<{ id: string; minLevel: number }>): PlayerCharacter {
  if (player.regionProgress) return player;
  return { ...player, regionProgress: Object.fromEntries(regions.map(region => [region.id, regionProgress(player, region)])) };
}

export function huntingModeLockReason(player: PlayerCharacter, region: { id: string; minLevel: number }, mode: string): string | null {
  return !['mod_standard', 'mod_sanctuary'].includes(mode) && regionProgress(player, region).bossWins < 1
    ? 'Сначала победите местного босса в обычном режиме или Священном Свете.' : null;
}

export function craftStageLockReason(player: PlayerCharacter, recipe: { regionId?: string; huntStage?: 'elite' | 'boss' }, regions: Array<{ id: string; minLevel: number }>): string | null {
  const region = regions.find(r => r.id === recipe.regionId);
  if (!recipe.huntStage || !region) return null;
  const progress = regionProgress(player, region);
  return recipe.huntStage === 'boss' && progress.bossWins < 1 ? 'Сначала победите босса этой зоны.'
    : recipe.huntStage === 'elite' && progress.eliteWins < 1 && progress.bossWins < 1 ? 'Сначала победите элиту этой зоны.' : null;
}

export function huntLockReason(player: PlayerCharacter, monster: Monster, region: { id: string; minLevel: number }): string | null {
  if (player.level < region.minLevel) return `Нужен ${region.minLevel}-й уровень героя.`;
  const progress = regionProgress(player, region);
  if (monster.isBoss && progress.bossWins < 1 && progress.eliteWins < BOSS_HUNT_REQUIREMENT) return `Победите элиту этой зоны: ${progress.eliteWins}/${BOSS_HUNT_REQUIREMENT}.`;
  if (monster.isElite && progress.bossWins < 1 && progress.eliteWins < 1 && progress.kills < ELITE_HUNT_REQUIREMENT) return `Победите обычных врагов этой зоны: ${progress.kills}/${ELITE_HUNT_REQUIREMENT}.`;
  return null;
}

export function recordRegionalVictory(player: PlayerCharacter, monster: Monster, region: { id: string; minLevel: number }): PlayerCharacter {
  const progress = regionProgress(player, region);
  const key = monster.isBoss ? 'bossWins' : monster.isElite ? 'eliteWins' : 'kills';
  return { ...player, regionProgress: { ...player.regionProgress, [region.id]: { ...progress, [key]: progress[key] + 1 } } };
}

export const regionalSealName = (regionId: string, boss = false) => `${boss ? 'Печать покорителя' : 'Знак элиты'} · ${regionId.replace('reg_', '')}`;

export function regionCompleted(player: PlayerCharacter, region: { id: string; minLevel: number }): boolean {
  const p = regionProgress(player, region);
  return p.kills >= ELITE_HUNT_REQUIREMENT && p.eliteWins >= BOSS_HUNT_REQUIREMENT && p.bossWins >= 1;
}
/** Preserve previously reached areas; the new introductory gate only applies before reaching the forest. */
export function regionEntryLockReason(player: PlayerCharacter, region: { id: string; minLevel: number }): string | null {
  if (player.level < region.minLevel) return `Для перехода нужен ${region.minLevel}-й уровень.`;
  if (region.id === 'reg_whisper_woods' && player.currentRegionId !== region.id && !player.unlockedRegionIds?.includes(region.id)
    && !player.regionProgress?.[region.id]?.kills && !player.regionProgress?.[region.id]?.eliteWins && !player.regionProgress?.[region.id]?.bossWins
    && (!regionCompleted(player, {id:'reg_plains', minLevel:1}) || (player.ascension?.rank || 'E') === 'E'))
    return 'Завершите освоение Зелёных равнин и вознеситесь до ранга D.';
  return null;
}
export function claimRegionalReward(player: PlayerCharacter, region: { id: string; minLevel: number }): PlayerCharacter {
  if (!regionCompleted(player, region) || player.regionalRewardsClaimed?.includes(region.id)) return player;
  return { ...player, regionalRewardsClaimed: [...(player.regionalRewardsClaimed || []), region.id],
    gold: player.gold + 200 * region.minLevel, silver: player.silver + 60 * region.minLevel,
    arenaTickets: player.arenaTickets + 1 };
}
