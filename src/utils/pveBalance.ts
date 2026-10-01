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
  const hp = Math.round(elite ? (200 + level * 24) * 3 : (340 + level * 34) * (2 + level * .01));
  const defense = Math.round(elite ? 12 + level * .75 : 18 + level * 1.05);
  return { hp, maxHp: hp, defense, magicDefense: Math.round(defense * .85),
    attack: Math.round(elite ? 22 + level * 3 + Math.pow(level, 1.55) * .22 : 28 + level * 3.5 + Math.pow(Math.max(0, level - 12), 1.65) * .4),
    magicAttack: Math.round(elite ? 20 + level * 2.8 + Math.pow(level, 1.55) * .22 : 26 + level * 3.3 + Math.pow(Math.max(0, level - 12), 1.65) * .4),
    evasion: Math.min(elite ? 12 : 15, monster.evasion), critChance: elite ? 8 : 10 };
}
