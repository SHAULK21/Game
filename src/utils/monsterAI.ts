import type { Monster, MonsterSkill, StatusEffect } from '../types/game';
import { predictedMonsterSkill } from './autoBattle';

export type MonsterActionKind = 'attack' | 'super' | 'defend' | 'potion';
const identityHash = (id: string) => [...id].reduce((hash, letter) => (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0, 17);
export function monsterActionKind(skill?: MonsterSkill | null): MonsterActionKind {
  if (!skill) return 'attack';
  if (skill.actionKind) return skill.actionKind;
  return skill.effect && ['fortify', 'shield', 'invulnerable'].includes(skill.effect) ? 'defend' : 'super';
}
/** Identity and speed set the rhythm; randomness only adds a small bounded jitter. */
export function monsterDelayRange(monster: Monster, kind: MonsterActionKind, fast = false): [number, number] {
  const hash = identityHash(monster.id + ':' + kind);
  const base = { attack: 620, super: 1080, defend: 760, potion: 940 }[kind];
  const min = Math.max(480, base + hash % 221 - Math.min(110, Math.max(0, monster.speed) * 2));
  const width = 100 + hash % 81;
  const pace = fast ? .7 : 1;
  return [Math.round(min * pace), Math.round((min + width) * pace)];
}
export function sampleMonsterDelay(monster: Monster, kind: MonsterActionKind, fast = false, random = Math.random): number {
  const [min, max] = monsterDelayRange(monster, kind, fast);
  return min + Math.floor(Math.max(0, Math.min(.999999, random())) * (max - min + 1));
}
/** Probabilities are attempts per turn; mana, cooldown, control and stock still apply. */
export function monsterActionWeights(monster: Monster) {
  const progress = Math.min(1, Math.max(0, monster.level - 1) / 60);
  return { defend: .04 + progress * .18, super: .10 + progress * .30,
    potion: monster.level < 15 ? 0 : .06 + progress * .08 };
}
export function chooseMonsterSkill(monster: Monster, effects: StatusEffect[], random = Math.random): MonsterSkill | null {
  // Player opponents and rank trials retain their authored rotations.
  if (monster.regionId === 'arena' || monster.regionId === 'ascension') return predictedMonsterSkill(monster);
  const ready = (monster.skills || []).filter(skill => (skill.currentCooldown || 0) <= 0 && monster.mp >= skill.manaCost
    && (monsterActionKind(skill) !== 'potion' || (monster.potionCharges || 0) > 0)
    && (monsterActionKind(skill) !== 'defend' || !effects.some(e => ['fortify','shield','invulnerable'].includes(e.type) && e.duration > 0)));
  const weights = monsterActionWeights(monster);
  const roll = random();
  let boundary = 0;
  for (const kind of ['defend', 'super', 'potion'] as const) {
    const candidates = ready.filter(skill => monsterActionKind(skill) === kind);
    // Unavailable skills give their probability back to the ordinary attack.
    boundary += candidates.length ? weights[kind] : 0;
    if (roll < boundary) return candidates.sort((a,b) => b.damageMultiplier - a.damageMultiplier)[0];
  }
  return null;
}
function monsterThrowingPotion(monster: Monster): MonsterSkill {
  const fire = identityHash(monster.id) % 2 === 0;
  return { id: monster.id + '_flask', name: fire ? 'Огненная склянка' : 'Ядовитая склянка', icon: '🧪', actionKind: 'potion',
    manaCost: 0, cooldown: 4, damageMultiplier: 1.05, damageType: fire ? 'fire' : 'poison',
    effect: fire ? 'burn' : 'poison', effectChance: 1, effectDuration: 2,
    effectPower: Math.max(3, Math.round(Math.max(monster.attack, monster.magicAttack) * .10)),
    description: 'Бросает склянку: урон и краткий периодический эффект. Запас ограничен.' };
}

const getBaseMonsterCombatSkills = (monster: Monster): MonsterSkill[] => {
  if (monster.id === 'm_stone_golem') return [
    {id:'golem_guard',name:'Каменная стойка',icon:'🛡️',manaCost:0,cooldown:5,currentCooldown:0,damageMultiplier:.65,damageType:'physical',effect:'fortify',effectChance:1,effectDuration:2,effectPower:40,description:'Укрепляет броню на два хода. Сохраните сильный приём до окончания стойки.'},
    {id:'golem_slam',name:'Размашистый удар',icon:'💥',manaCost:0,cooldown:4,currentCooldown:2,damageMultiplier:1.7,damageType:'physical',description:'После удара голем раскрывается: +35% получаемого урона на два хода.'}
  ];
  if (monster.skills?.length) return monster.skills.map(s => ({ ...s, currentCooldown: s.currentCooldown || 0 }));
  const common: MonsterSkill[] = [
    { id: monster.id + '_heavy', name: 'Сокрушительный удар', icon: '💥', manaCost: 0, cooldown: 3, damageMultiplier: 1.45, damageType: monster.damageType || 'physical', description: 'Сильная атака с повышенным уроном.' },
    { id: monster.id + '_guard', name: 'Укрепление', icon: '🛡️', manaCost: 0, cooldown: 4, damageMultiplier: 0, actionKind: 'defend', damageType: monster.damageType || 'physical', effect: 'fortify', effectChance: 1, effectDuration: 2, effectPower: 25, description: 'Укрепляет защиту вместо атаки.' }
  ];
  if (monster.damageType === 'poison' || monster.id.includes('spider')) {
    common[0] = { id: monster.id + '_venom', name: 'Ядовитый плевок', icon: '☠️', manaCost: 12, cooldown: 3, damageMultiplier: 1.25, damageType: 'poison', effect: 'poison', effectChance: 0.9, effectDuration: 3, effectPower: Math.max(10, Math.round(monster.attack * 0.25)), description: 'Наносит урон и накладывает яд.' };
  } else if (monster.damageType === 'fire') {
    common[0] = { id: monster.id + '_flame', name: 'Пылающий взрыв', icon: '🔥', manaCost: 20, cooldown: 3, damageMultiplier: 1.55, damageType: 'fire', effect: 'burn', effectChance: 0.75, effectDuration: 3, effectPower: Math.max(12, Math.round(monster.magicAttack * 0.2)), description: 'Огненная атака с поджиганием.' };
  } else if (monster.damageType === 'dark') {
    common[0] = { id: monster.id + '_curse', name: 'Проклятие тьмы', icon: '🌑', manaCost: 20, cooldown: 4, damageMultiplier: 1.35, damageType: 'dark', effect: 'vulnerability', effectChance: 0.65, effectDuration: 2, effectPower: 20, description: 'Тёмный удар, ослабляющий защиту.' };
  } else if (monster.isBoss) {
    common[0] = { id: monster.id + '_ultimate', name: 'Королевский натиск', icon: '👑', manaCost: 35, cooldown: 4, damageMultiplier: 1.85, damageType: monster.damageType || 'physical', effect: 'stun', effectChance: 0.25, effectDuration: 1, effectPower: 0, description: 'Особый приём босса с шансом оглушения.' };
  }
  return common;
};

export function getMonsterCombatSkills(monster: Monster): MonsterSkill[] {
  const skills = getBaseMonsterCombatSkills(monster);
  if (monster.level >= 15 && monster.regionId !== 'arena' && monster.regionId !== 'ascension'
      && !skills.some(skill => skill.actionKind === 'potion')) skills.push(monsterThrowingPotion(monster));
  return skills;
}

export const prepareMonsterForCombat = (monster: Monster): Monster => {
  if(monster.regionId==='ascension') return {...monster,skills:getMonsterCombatSkills(monster)};
  const levelFactor = 1 + Math.min(0.55, monster.level * 0.006);
  const roleFactor = monster.isBoss ? 1.35 : monster.isElite ? 1.18 : 1;
  const hpMultiplier = 2.15 * levelFactor * roleFactor * (!monster.isBoss && !monster.isElite ? (monster.level < 5 ? 1.25 : 1.6) : 1);
  const levelPressure = monster.regionId === 'arena' ? 1 : 1 + Math.min(monster.isBoss ? .8 : monster.isElite ? 1.4 : 2, Math.max(0, monster.level - 3) / 30);
  const damageMultiplier = 1.35 * Math.sqrt(levelFactor) * (monster.isBoss ? 1.12 : 1) * levelPressure * (monster.isBoss ? 1.35 : monster.isElite ? 1.5 : 1) * (monster.regionId === 'arena' ? 1 : monster.level < 12 ? monster.isBoss ? 1.6 : monster.isElite ? 1.5 : 1 : 1);
  const defenseMultiplier = 1.28 * Math.sqrt(levelFactor);

  return {
    ...monster,
    hp: Math.max(1, Math.round(monster.maxHp * hpMultiplier)),
    maxHp: Math.max(1, Math.round(monster.maxHp * hpMultiplier)),
    mp: monster.maxMp,
    maxMp: monster.maxMp,
    attack: Math.max(1, Math.round(Math.max(monster.attack * damageMultiplier, monster.regionId !== 'arena' && !monster.isElite && !monster.isBoss && monster.level >= 4 && monster.level <= 12 ? 18 + monster.level * 9 : 0))),
    magicAttack: Math.max(0, Math.round(monster.magicAttack * damageMultiplier)),
    defense: Math.max(0, Math.round(monster.defense * defenseMultiplier)),
    magicDefense: Math.max(0, Math.round(monster.magicDefense * defenseMultiplier)),
    expReward: Math.max(1, Math.round(monster.expReward * 1.2)),
    goldReward: Math.max(1, Math.round(monster.goldReward * 1.12)),
    potionCharges: monster.regionId === 'arena' ? 0 : monster.level < 15 ? 0 : monster.level < 40 ? 1 : monster.level < 75 ? 2 : 3,
    skills: getMonsterCombatSkills(monster)
  };
};
