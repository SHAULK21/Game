import type { AutoBattleSettings, CombatStats, Monster, PlayerCharacter, Skill, StatusEffect } from '../types/game';
import { talentManaCost } from '../data/talents';
import { playerDamagePower } from './pveBalance';
import { getStatusModifiers } from './statusEffects';

export function predictedMonsterSkill(monster: Monster) {
  return (monster.skills || []).filter(s => (s.currentCooldown || 0) <= 0 && monster.mp >= s.manaCost)
    .sort((a, b) => (b.damageMultiplier + (b.effect ? .2 : 0)) - (a.damageMultiplier + (a.effect ? .2 : 0)))[0] || null;
}

export interface AutoBattleInput {
  player: PlayerCharacter; monster: Monster; stats: CombatStats; hp: number; mp: number;
  playerEffects: StatusEffect[]; monsterEffects: StatusEffect[]; settings: AutoBattleSettings;
  damageMultiplier?: number;
}
export type AutoBattleAction = { action: 'attack' | 'defend' | 'skill' | 'potion' | 'flee'; id?: string };

export function chooseAutoBattleAction(input: AutoBattleInput): AutoBattleAction {
  const { player, monster, stats, hp, mp, playerEffects, monsterEffects, settings } = input;
  const hpPercent = 100 * hp / stats.maxHp;
  const ready = settings.useSkills ? player.skills.filter(s => player.level >= s.levelReq && (s.currentCooldown || 0) <= 0
    && talentManaCost(s.manaCost, player.talents) <= mp && (settings.useUltimate || !s.isUltimate)) : [];
  const missingHp = stats.maxHp - hp;
  if (hpPercent <= settings.healAtHpPercent) {
    const healing = player.inventory.filter(i => i.type === 'potion' && (i.stats.healFull || i.stats.heal > 0))
      .sort((a, b) => Math.abs(missingHp - (a.stats.healFull ? stats.maxHp : a.stats.heal)) - Math.abs(missingHp - (b.stats.healFull ? stats.maxHp : b.stats.heal)))[0];
    if (healing) return { action: 'potion', id: healing.id };
  }
  if (hpPercent < Math.max(settings.healAtHpPercent, 60)) {
    const heal = ready.filter(s => s.damageMultiplier === 0 && s.healMultiplier).sort((a, b) => b.healMultiplier! - a.healMultiplier!)[0];
    if (heal) return { action: 'skill', id: heal.id };
  }
  if (settings.fleeAtHpPercent > 0 && hpPercent <= settings.fleeAtHpPercent) return { action: 'flee' };

  const planned = predictedMonsterSkill(monster);
  const type = planned?.damageType || monster.damageType || 'physical';
  const defense = type === 'physical' ? stats.defense : stats.magicDefense;
  const incoming = (type === 'physical' ? monster.attack : monster.magicAttack) * (planned?.damageMultiplier || 1)
    * (input.damageMultiplier || 1) * (type === 'physical' ? 80 : 90) / (defense + (type === 'physical' ? 80 : 90));
  const protectedNow = playerEffects.some(e => e.duration > 1 && (e.type === 'invulnerable' || e.type === 'shield' && e.value >= incoming));
  if (!protectedNow && !getStatusModifiers(monsterEffects).skipTurn && planned
      && (planned.damageMultiplier >= 1.7 || incoming >= hp * .3)) {
    const shield = ready.find(s => s.damageMultiplier === 0 && s.inflicts && ['shield', 'fortify', 'invulnerable'].includes(s.inflicts.type));
    if (shield) return { action: 'skill', id: shield.id };
    if (incoming >= hp * .5) return { action: 'defend' };
  }

  const expectedDamage = (s?: Skill) => {
    const damageType = s?.damageType || 'physical';
    const armor = damageType === 'physical' ? Math.max(0, monster.defense - stats.armorPenetration) : monster.magicDefense;
    const constant = damageType === 'physical' ? 75 : 90;
    const resistance = Math.max(-75, Math.min(85, monster.resistances?.[damageType as keyof NonNullable<Monster['resistances']>] || 0));
    const damage = playerDamagePower(damageType, player.classId, stats) * (s?.damageMultiplier || 1) * (s?.hits || 1)
      * (damageType === 'true' ? 1 : constant / (armor + constant) * (1 - resistance / 100));
    return damage;
  };
  const basic = expectedDamage();
  const attacks = ready.filter(s => s.damageMultiplier > 0).map(skill => {
    let score = expectedDamage(skill);
    if (skill.inflicts && !monsterEffects.some(e => e.type === skill.inflicts!.type && e.duration > 1)) {
      if (['poison', 'bleed', 'burn'].includes(skill.inflicts.type)) score += skill.inflicts.power * Math.min(3, skill.inflicts.duration) * skill.inflicts.chance;
      if (['stun', 'freeze', 'vulnerability'].includes(skill.inflicts.type)) score *= 1.12;
    }
    if (skill.healMultiplier && hpPercent < 80) score *= 1.15;
    return { skill, score };
  }).sort((a, b) => b.score - a.score || a.skill.manaCost - b.skill.manaCost);
  // Do not waste mana on a weaker elemental skill or heal at full health.
  if (attacks[0]?.score >= basic * 1.05 && monster.hp > basic) return { action: 'skill', id: attacks[0].skill.id };
  if (settings.useSkills && ['mage', 'necromancer', 'druid'].includes(player.classId) && monster.hp > basic * 2) {
    const waiting = player.skills.find(s => player.level >= s.levelReq && s.damageMultiplier > 0
      && (settings.useUltimate || !s.isUltimate) && (s.currentCooldown || 0) <= 0
      && talentManaCost(s.manaCost, player.talents) > mp && talentManaCost(s.manaCost, player.talents) <= mp + 25 + stats.mpRegen);
    if (waiting) {
      const mana = player.inventory.find(i => i.type === 'potion' && i.stats.manaRestore > 0);
      if (mana) return { action: 'potion', id: mana.id };
      return { action: 'defend' };
    }
  }
  return { action: 'attack' };
}
