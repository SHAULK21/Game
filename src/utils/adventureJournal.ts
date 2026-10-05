import type { AdventureChapterId, AdventureJournalState, PlayerCharacter, Quest } from '../types/game';

/** Historical milestones unlock replay, without showing old scenes automatically. */
export function migrateAdventureJournal(player: PlayerCharacter, quests: Quest[]): PlayerCharacter {
  if (player.adventureJournal) return player;
  const unlocked: AdventureChapterId[] = [];
  if (quests.some(q => q.id === 'q_royal_first_journey' && q.claimed)) unlocked.push('royal-return');
  if (quests.some(q => q.targetMonsterId === 'm_queen_bat' && q.currentCount > 0)
    || (player.regionProgress?.reg_plains?.bossWins || 0) > 0) unlocked.push('first-boss');
  return { ...player, adventureJournal: { unlocked } };
}

export function beginAdventureChapter(player: PlayerCharacter, chapter: AdventureChapterId,
  encounter?: NonNullable<AdventureJournalState['pending']>['encounter']): PlayerCharacter {
  if (player.adventureJournal?.pending || player.adventureJournal?.unlocked.includes(chapter)) return player;
  return { ...player, adventureJournal: {
    unlocked: [...(player.adventureJournal?.unlocked || []), chapter],
    pending: { chapter, step: 0, ...(encounter ? { encounter } : {}) }
  } };
}

export function availableAdventureChapters(player: PlayerCharacter): string[] {
  const available = ['intro'];
  if (player.firstJourney && player.firstJourney !== 'battle') available.push('royal-order');
  return [...available, ...(player.adventureJournal?.unlocked || [])];
}
