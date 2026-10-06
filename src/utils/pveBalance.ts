import type { CharacterClassId, CombatStats, DamageType, Monster } from '../types/game';

/** Elemental weapon skills still scale with their class's weapon power. */
export function playerDamagePower(type: DamageType, classId: CharacterClassId, stats: CombatStats): number {
  if (type === 'true') return Math.max(stats.attack, stats.magicAttack);
  if (type === 'physical' || !['mage', 'necromancer', 'druid'].includes(classId)) return stats.attack;
  return stats.magicAttack;
}

/** Regional bosses have bounded HP and armor, independent of hero gear. */
export function regionalEnemyStats(monster: Monster, level: number) {
  if (!monster.isBoss && !monster.isElite) return {};
  const elite = !monster.isBoss;
  const hp = Math.round(elite ? (200 + level * 24) * 1.5 : (340 + level * 34) * (.95 + level * .004));
  const defense = Math.round(elite ? 10 + level * .6 : 14 + level * .85);
  return { hp, maxHp: hp, defense, magicDefense: Math.round(defense * .85),
    attack: Math.round((elite ? 22 + level * 3 + Math.pow(level, 1.55) * .22 : 28 + level * 3.5 + Math.pow(Math.max(0, level - 12), 1.65) * .4) * .80),
    magicAttack: Math.round((elite ? 20 + level * 2.8 + Math.pow(level, 1.55) * .22 : 26 + level * 3.3 + Math.pow(Math.max(0, level - 12), 1.65) * .4) * .80),
    evasion: Math.min(elite ? 12 : 15, monster.evasion), critChance: elite ? 8 : 10 };
}

/** Large PvE level gaps are dangerous; nearby levels and PvP/rank trials are unaffected. */
export function pveThreatMultiplier(monster: Monster, heroLevel: number): number {
  if (monster.regionId === 'arena' || monster.regionId === 'ascension') return 1;
  return 1 + Math.min(1.4, Math.max(0, (monster.level || 1) - (heroLevel || 1) - 2) * .22);
}

/** Armor stays useful without reducing late-game monster damage to almost zero. */
export function incomingArmorConstant(monster: Monster, type: DamageType): number {
  const base = type === 'physical' ? 80 : 90;
  return base + (monster.regionId === 'arena' || monster.regionId === 'ascension' ? 0 : Math.max(0, (monster.level || 1) - 3) * 1.2);
}

/** Prevent indefinite shield/heal stalemates while leaving normal-length fights alone. */
export function monsterEnrageMultiplier(monster: Monster, round: number): number {
  if (monster.regionId === 'arena' || monster.regionId === 'ascension') return 1;
  return 1 + Math.min(1, Math.max(0, round - 25) * .04);
}
