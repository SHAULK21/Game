import type { Monster } from '../types/game';

const starterTargets: Record<string, Partial<Monster>> = {
  m_wolf: { level: 2 },
  m_goblin: { level: 2, hp: 135, maxHp: 135, attack: 22, magicAttack: 4, defense: 7, magicDefense: 4, expReward: 28, goldReward: 22 },
  m_boar: { level: 3, hp: 225, maxHp: 225, attack: 38, defense: 16, magicDefense: 4, expReward: 50, goldReward: 35 },
  m_bandit: { level: 8 }
};

export function regionalHuntTemplate(monster: Monster, regionId: string): Monster {
  return regionId === 'reg_plains' && !monster.isBoss && !monster.isElite && starterTargets[monster.id]
    ? { ...monster, ...starterTargets[monster.id] } : monster;
}

/** Fixed regional encounters give several choices without following hero levels. */
export function ordinaryHuntLevel(monster: Monster, region: { id: string; minLevel: number }, ordinaryIds: string[]): number {
  if (region.id === 'reg_plains') {
    if (starterTargets[monster.id]?.level) return starterTargets[monster.id].level!;
  }
  return region.minLevel + Math.max(0, ordinaryIds.indexOf(monster.id));
}

/** The chosen hunt, rather than hero level, sets the risk of the whole series. */
export function huntSeriesPool(first: Monster, regionalMonsters: Monster[]): Monster[] {
  const candidates = regionalMonsters.filter(monster => monster.regionId === first.regionId
    && !monster.isBoss && !monster.isElite && Math.abs(monster.level - first.level) <= 1);
  return candidates.length ? candidates : [first];
}
