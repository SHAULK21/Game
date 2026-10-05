import type { Quest } from '../types/game';
/** Arrival, including arrival interrupted by an ambush, completes travel objectives. */
export function completeTravelQuests(quests:Quest[],regionId:string):Quest[] {
  return quests.map(quest=>quest.objective==='travel' && quest.targetRegionId===regionId && !quest.completed
    ? {...quest,currentCount:quest.targetCount,completed:true} : quest);
}
