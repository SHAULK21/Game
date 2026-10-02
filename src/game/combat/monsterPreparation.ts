import type { Monster, MonsterSkill, RegionModifier } from '../../types/game';
import { MONSTERS, REGIONS, getRegionMonster } from '../../data/gameData';
import { applyHuntingMode } from '../../utils/huntingModes';

const getMonsterCombatSkills = (monster: Monster): MonsterSkill[] => {
  if (monster.id === 'm_stone_golem') return [
    {id:'golem_guard',name:'Каменная стойка',icon:'🛡️',manaCost:0,cooldown:5,currentCooldown:0,damageMultiplier:.65,damageType:'physical',effect:'fortify',effectChance:1,effectDuration:2,effectPower:40,description:'Укрепляет броню на два хода. Сохраните сильный приём до окончания стойки.'},
    {id:'golem_slam',name:'Размашистый удар',icon:'💥',manaCost:0,cooldown:4,currentCooldown:2,damageMultiplier:1.7,damageType:'physical',description:'После удара голем раскрывается: +35% получаемого урона на два хода.'}
  ];
  if (monster.skills?.length) return monster.skills.map(skill => ({ ...skill, currentCooldown: skill.currentCooldown || 0 }));
  const common: MonsterSkill[] = [
    { id: monster.id + '_heavy', name: 'Сокрушительный удар', icon: '💥', manaCost: 0, cooldown: 3, damageMultiplier: 1.45, damageType: monster.damageType || 'physical', description: 'Сильная атака с повышенным уроном.' },
    { id: monster.id + '_guard', name: 'Укрепление', icon: '🛡️', manaCost: 15, cooldown: 5, damageMultiplier: 0.55, damageType: monster.damageType || 'physical', effect: 'fortify', effectChance: 1, effectDuration: 2, effectPower: 25, description: 'Атака и укрепление защиты.' }
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

export const prepareMonsterForCombat = (monster: Monster): Monster => {
  if (monster.regionId === 'ascension') return { ...monster, skills: getMonsterCombatSkills(monster) };
  const levelFactor = 1 + Math.min(0.55, monster.level * 0.006);
  const roleFactor = monster.isBoss ? 1.35 : monster.isElite ? 1.18 : 1;
  const hpMultiplier = 2.15 * levelFactor * roleFactor * (!monster.isBoss && !monster.isElite ? (monster.level < 5 ? 1.25 : 1.6) : 1);
  const damageMultiplier = 1.35 * Math.sqrt(levelFactor) * (monster.isBoss ? 1.12 : 1);
  const defenseMultiplier = 1.28 * Math.sqrt(levelFactor);

  return {
    ...monster,
    hp: Math.max(1, Math.round(monster.maxHp * hpMultiplier)),
    maxHp: Math.max(1, Math.round(monster.maxHp * hpMultiplier)),
    mp: monster.maxMp,
    maxMp: monster.maxMp,
    attack: Math.max(1, Math.round(monster.attack * damageMultiplier)),
    magicAttack: Math.max(0, Math.round(monster.magicAttack * damageMultiplier)),
    defense: Math.max(0, Math.round(monster.defense * defenseMultiplier)),
    magicDefense: Math.max(0, Math.round(monster.magicDefense * defenseMultiplier)),
    expReward: Math.max(1, Math.round(monster.expReward * 1.2)),
    goldReward: Math.max(1, Math.round(monster.goldReward * 1.12)),
    skills: getMonsterCombatSkills(monster)
  };
};

export const buildCombatChain = (
  firstMonster: Monster,
  playerLevel: number,
  regionId: string,
  mode?: RegionModifier
): Monster[] => {
  const region = REGIONS.find(candidate => candidate.id === regionId) || REGIONS[0];
  const normalPool = region.monsters
    .map(id => MONSTERS[id])
    .filter((monster): monster is Monster => Boolean(monster) && !monster.isBoss && !monster.isElite)
    .map(monster => getRegionMonster(monster, region));
  const pool = normalPool.length > 0 ? normalPool : [firstMonster];
  const count = firstMonster.isBoss || firstMonster.isElite ? 1 : 2 + Math.floor(Math.random() * (playerLevel < 8 ? 2 : playerLevel < 25 ? 4 : 6));
  const chain: Monster[] = [applyHuntingMode(prepareMonsterForCombat(firstMonster), mode)];
  for (let i = 1; i < count; i += 1) {
    const candidate = pool[Math.floor(Math.random() * pool.length)] || firstMonster;
    chain.push(applyHuntingMode(prepareMonsterForCombat(candidate), mode));
  }
  return chain;
};
