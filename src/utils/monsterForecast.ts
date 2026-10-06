import type { Monster, MonsterSkill, StatusEffect, Talent } from '../types/game';
import { talentBonuses } from '../data/talents';
import { availableMonsterSkills } from './monsterAI';

export interface MonsterForecast {
  monsterId: string;
  round: number;
  skill: MonsterSkill | null;
  accuracy: number;
}

export const monsterReadingAccuracy = (talents: Talent[]) => Math.min(90, 50 + Math.max(0, talentBonuses(talents).monsterReadAccuracy || 0));

/** Read a privately chosen action; a failed read names another legal possibility. */
export function forecastMonsterAction(monster: Monster, effects: StatusEffect[], actual: MonsterSkill | null,
  talents: Talent[], round: number, random = Math.random): MonsterForecast {
  const accuracy = monsterReadingAccuracy(talents);
  const alternatives = [null, ...availableMonsterSkills(monster, effects)].filter(skill => skill?.id !== actual?.id);
  const correct = random() < accuracy / 100 || alternatives.length === 0;
  const skill = correct ? actual : alternatives[Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length))];
  return { monsterId: monster.id, round, skill, accuracy };
}
