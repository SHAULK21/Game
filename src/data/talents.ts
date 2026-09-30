import type { CharacterClassId, PlayerCharacter, Talent, StatusEffectType } from '../types/game';

export type TalentBranch = 'damage' | 'survival' | 'class';
export const CLASS_BRANCHES: Record<CharacterClassId, [string, string, string]> = {
  warrior: ['Оружейное мастерство', 'Бастион', 'Боевой ритм'],
  berserker: ['Неистовство', 'Несокрушимость', 'Кровавая ярость'],
  knight: ['Рыцарский натиск', 'Стальной оплот', 'Защитник'],
  rogue: ['Дуэлянт', 'Ловкач', 'Грязные приёмы'],
  assassin: ['Смертельный удар', 'Тень', 'Ликвидация'],
  archer: ['Меткость', 'Следопыт', 'Ловушки'],
  mage: ['Разрушение', 'Магический барьер', 'Стихийные сочетания'],
  necromancer: ['Проклятия', 'Костяная броня', 'Похищение жизни'],
  paladin: ['Правосудие', 'Хранитель', 'Священный свет'],
  druid: ['Гнев природы', 'Дубовая кожа', 'Живой круг'],
};
const CLASS_SIGNATURES: Record<CharacterClassId, { name: string; stat: string; description: string; value: number; status?: StatusEffectType }> = {
  warrior: { name: 'Ритм победителя', stat: 'momentumDamage', value: 20, description: 'Каждый накопленный заряд боевого ритма даёт ещё +5% урона (до +20%).' },
  berserker: { name: 'На грани', stat: 'berserkDamage', value: 30, description: 'При HP ниже 40% наносите на 30% больше урона.' },
  knight: { name: 'Живой бастион', stat: 'skillBarrier', value: 8, description: 'Каждый навык создаёт щит на 8% максимального HP на 2 хода.' },
  rogue: { name: 'Коварный дуэлянт', stat: 'focusDamage', value: 25, description: 'Удар с классовым фокусом наносит ещё на 25% больше урона.' },
  assassin: { name: 'Идеальная ликвидация', stat: 'executeDamage', value: 35, description: 'Наносите на 35% больше урона врагу с HP ниже 30%.' },
  archer: { name: 'Смертельная западня', stat: 'trapPower', value: 75, status: 'poison', description: 'Яд ловушек наносит на 75% больше урона и действует на 1 ход дольше.' },
  mage: { name: 'Стихийный цикл', stat: 'alternatingDamage', value: 30, description: 'Разные навыки, применённые подряд в пределах 3 ходов, получают +30% урона.' },
  necromancer: { name: 'Жатва жизни', stat: 'skillLeech', value: 15, description: 'Атакующие навыки восстанавливают HP в размере 15% нанесённого урона.' },
  paladin: { name: 'Свет в каждом ударе', stat: 'skillHeal', value: 6, description: 'Применение любого навыка восстанавливает 6% максимального HP.' },
  druid: { name: 'Непрерывный рост', stat: 'turnHeal', value: 3, description: 'В начале каждого своего хода восстанавливаете 3% максимального HP.' },
};
const LEVELS = [1, 10, 21, 30, 41, 50, 61, 70, 81, 90];
const REQUIRED = [0, 0, 5, 8, 12, 18, 23, 28, 36, 44];
const spec = (name: string, description: string, stat: string, value: number, special = false, effects?: Talent['effects']) =>
  ({ name, description, effect: { stat, valuePerRank: value }, special, effects });

export function createTalentTree(classId: CharacterClassId): Talent[] {
  const signature = CLASS_SIGNATURES[classId];
  const branches = {
    damage: [
      spec('Сила удара', '+2% физического и магического урона за ранг.', 'damagePercent', 2),
      spec('Точный расчёт', '+2 точности за ранг.', 'accuracy', 2),
      spec('Пробивающий удар', '+2 пробития брони за ранг.', 'armorPenetration', 2),
      spec('Опасный крит', '+4% критического урона за ранг.', 'critDamage', 4),
      spec('Двойной приём', 'Атакующий навык получает дополнительный удар на 35% обычного урона. Цена: 5 очков.', 'extraStrike', 35, true),
      spec('Мастер навыков', '+3% урона атакующих навыков за ранг.', 'skillDamage', 3),
      spec('Сосредоточенность', 'Критическое попадание возвращает 1% максимального MP за ранг.', 'critMana', 1),
      spec('Развитие успеха', 'После крита следующая атака или атакующий навык получает +20% урона. Цена: 8 очков.', 'critFollowup', 20, true),
      spec('Добивание', '+3% урона за ранг по врагам с HP ниже 30%.', 'executeDamage', 3),
      spec('Наступательная доктрина', '+25% урона при HP выше 70%, но получаемый урон возрастает на 10%. Цена: 10 очков.', 'offensiveStance', 25, true),
    ],
    survival: [
      spec('Запас прочности', '+3% максимального HP за ранг.', 'hpPercent', 3),
      spec('Стойкость', '+3% физической и магической защиты за ранг.', 'defensePercent', 3),
      spec('Второе дыхание', '+2 восстановления HP за ранг.', 'hpRegen', 2),
      spec('Осмотрительность', '+1 уклонения за ранг.', 'evasion', 1),
      spec('Укреплённый щит', 'Щиты навыков и действия «Защита» поглощают на 30% больше урона. Цена: 5 очков.', 'shieldPower', 30, true),
      spec('Оборонительная подготовка', 'Действие «Защита» восстанавливает 1% максимального HP за ранг.', 'defendHeal', 1),
      spec('Сохранение сил', 'После поглощения урона щитом возвращается 1% максимального MP за ранг (раз за вражеское действие).', 'blockMana', 1),
      spec('Ответный натиск', 'После поглощения урона щитом следующая атака или атакующий навык получает +20% урона. Цена: 8 очков.', 'blockFollowup', 20, true),
      spec('Не сдавайся', 'При HP ниже 40% получаете на 2% меньше прямого урона за ранг.', 'lowHpReduction', 2),
      spec('Оборонительная доктрина', 'Получаете на 20% меньше прямого урона, но наносите на 10% меньше урона. Цена: 10 очков.', 'defensiveStance', 20, true),
    ],
    class: [
      spec('Внутренний резерв', '+3% максимального MP за ранг.', 'manaPercent', 3),
      spec('Концентрация', '+1 восстановления MP за ранг.', 'mpRegen', 1),
      spec('Бережный расход', 'Навыки расходуют на 2% меньше MP за ранг.', 'manaCostReduction', 2),
      spec('Усиленные эффекты', 'Яд, кровотечение и горение от навыков наносят на 5% больше урона за ранг.', 'dotPower', 5),
      spec('Долгое воздействие', 'Вредные эффекты ваших навыков действуют на 1 ход дольше. Цена: 5 очков.', 'effectDuration', 1, true),
      spec('Целительное искусство', 'Лечение навыками эффективнее на 4% за ранг.', 'healPower', 4),
      spec('Использовать слабость', '+2% урона за ранг по врагу с ядом, кровотечением, горением или уязвимостью.', 'afflictedDamage', 2),
      spec('Награда за победу', 'После убийства восстанавливается 10% HP и MP — полезно в сериях и подземельях. Цена: 8 очков.', 'killRecovery', 10, true),
      spec('Надёжное воздействие', '+2 процентных пункта к шансу вредного эффекта навыка за ранг.', 'effectChance', 2),
      spec(signature.name, signature.description + ' Цена: 10 очков.', signature.stat, signature.value, true),
    ],
  };
  // Adapt the utility path to the class toolkit: no poison talents on a shield knight.
  if (classId === 'knight' || classId === 'paladin') {
    branches.class[3] = spec('Световая преграда', 'Ваши щиты поглощают на 5% больше урона за ранг.', 'shieldPower', 5);
    branches.class[4] = spec('Непрерывная защита', 'Полезные эффекты навыков действуют на 1 ход дольше. Цена: 5 очков.', 'buffDuration', 1, true);
    branches.class[6] = spec('Из-под защиты', '+2% урона за ранг, пока на вас действует щит.', 'shieldedDamage', 2);
    branches.class[8] = spec('Священный резерв', 'Каждый навык возвращает 1% максимального MP за ранг.', 'skillManaReturn', 1);
    if (classId === 'knight') branches.class[5] = spec('Бастион живых', 'Действие «Защита» восстанавливает 1% максимального HP за ранг.', 'defendHeal', 1);
  }
  if (classId === 'assassin') {
    branches.class[3] = spec('Нападение из тени', '+4% урона за ранг после «Скрытности», в течение 3 ходов.', 'stealthDamage', 4);
    branches.class[4] = spec('Острая грань', 'Навыки получают +10 пробития брони. Цена: 5 очков.', 'skillPenetration', 10, true);
    branches.class[5] = spec('Скрытый резерв', 'Навыки расходуют на 2% меньше MP за ранг.', 'manaCostReduction', 2);
    branches.class[6] = spec('Найти слабое место', '+2% урона за ранг по цели с HP ниже 30%.', 'executeDamage', 2);
    branches.class[8] = spec('Холодный расчёт', '+2% урона навыков за ранг.', 'skillDamage', 2);
  }
  if (classId === 'necromancer') {
    branches.class[3] = spec('Сила проклятия', '+4% к силе уязвимости от навыков за ранг.', 'vulnerabilityPower', 4);
    branches.class[8] = spec('Сбор душ', 'Навыки возвращают 1% максимального MP за ранг.', 'skillManaReturn', 1);
  }
  if (classId === 'archer') {
    branches.class[4] = spec('Ядовитая ловушка', 'Первое попадание каждым атакующим навыком накладывает яд: 8% силы атаки за ход, 2 хода. Цена: 5 очков.', 'classDot', 100, true);
    branches.class[5] = spec('Устройство ловушки', '+5% урона яда ловушек за ранг.', 'dotPower', 5);
    branches.class[8] = spec('Долгая охота', '+2% урона за ранг по отравленным и ослабленным врагам.', 'afflictedDamage', 2);
  }
  if (classId === 'warrior' || classId === 'berserker' || classId === 'rogue' || classId === 'mage') {
    branches.class[5] = spec('Ресурс для связки', 'Каждый навык возвращает 1% максимального MP за ранг.', 'skillManaReturn', 1);
  }
  const talents = (Object.keys(branches) as TalentBranch[]).flatMap((branch, branchIndex) => branches[branch].map((entry, index) => ({
    id: `${classId}_${branch}_${index + 1}`, name: entry.name, description: entry.description,
    branch, branchName: CLASS_BRANCHES[classId][branchIndex], levelReq: LEVELS[index], branchPointsReq: REQUIRED[index],
    tier: Math.floor(index / 2) + 1, maxRank: entry.special ? 1 : 5, currentRank: 0,
    pointCost: entry.special ? (index === 4 ? 5 : index === 7 ? 8 : 10) : 1,
    icon: ['⚔️', '🛡️', '✨'][branchIndex], effect: entry.effect, effects: entry.effects,
  })));
  const masteries = [
    ['hpPercent', 'Мастерство стойкости', 15], ['damagePercent', 'Мастерство оружия', 10],
    ['manaPercent', 'Мастерство ресурса', 15], ['defensePercent', 'Мастерство защиты', 10],
  ] as const;
  return [...talents, ...masteries.map(([stat, name, cap]) => ({
    id: `${classId}_mastery_${stat}`, name, description: `Плавный прирост до +${cap}%. Каждый следующий ранг даёт меньшую прибавку; стоимость растёт каждые 5 рангов.`,
    branch: 'mastery' as const, branchName: 'Мастерство', levelReq: 101, tier: 6,
    maxRank: Number.MAX_SAFE_INTEGER, currentRank: 0, pointCost: 1, icon: '🏅',
    effect: { stat, valuePerRank: cap },
  }))];
}

export function talentCost(talent: Talent): number {
  return talent.branch === 'mastery' ? 1 + Math.floor(talent.currentRank / 5) : talent.pointCost || 1;
}
export function spentTalentPoints(talent: Talent): number {
  if (talent.branch !== 'mastery') return talent.currentRank * (talent.pointCost || 1);
  const groups = Math.floor(talent.currentRank / 5);
  return 5 * groups * (groups + 1) / 2 + (talent.currentRank % 5) * (groups + 1);
}
export function branchSpent(talents: Talent[], branch: string): number {
  return talents.filter(t => t.branch === branch).reduce((sum, t) => sum + spentTalentPoints(t), 0);
}
export function talentLockReason(player: PlayerCharacter, talent: Talent): string | null {
  if (talent.branch === 'legacy') return 'Сохранённый талант: доступен только сброс';
  if (talent.currentRank >= talent.maxRank) return 'Максимальный ранг';
  if (player.level < (talent.levelReq || 1)) return `Нужен уровень ${talent.levelReq}`;
  if (branchSpent(player.talents, talent.branch || '') < (talent.branchPointsReq || 0)) return `Нужно вложить ${talent.branchPointsReq} очков в эту ветку`;
  if (player.talentPoints < talentCost(talent)) return `Нужно очков: ${talentCost(talent)}`;
  return null;
}
export function learnTalent(player: PlayerCharacter, id: string): PlayerCharacter {
  const talent = player.talents.find(t => t.id === id);
  if (!talent || talentLockReason(player, talent)) return player;
  return { ...player, talentPoints: player.talentPoints - talentCost(talent), talents: player.talents.map(t => t.id === id ? { ...t, currentRank: t.currentRank + 1 } : t) };
}
export function talentBonuses(talents: Talent[]): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const talent of talents) {
    if (!talent.currentRank) continue;
    for (const effect of [talent.effect, ...(talent.effects || [])]) {
      const value = talent.branch === 'mastery' ? effect.valuePerRank * (1 - Math.exp(-talent.currentRank / 100)) : effect.valuePerRank * talent.currentRank;
      bonuses[effect.stat] = (bonuses[effect.stat] || 0) + value;
    }
  }
  return bonuses;
}
export const talentResetPrice = (level: number) => Math.max(100, Math.floor(level) * 20);
export function resetTalents(player: PlayerCharacter): PlayerCharacter {
  const spent = player.talents.reduce((sum, t) => sum + spentTalentPoints(t), 0);
  const price = talentResetPrice(player.level);
  if (!spent || player.silver < price) return player;
  return { ...player, silver: player.silver - price, talentPoints: player.talentPoints + spent, talents: createTalentTree(player.classId) };
}

/** Preserve old purchased ranks and their effects until the player chooses a paid reset. */
export function migrateTalents(player: PlayerCharacter): PlayerCharacter {
  const catalog = createTalentTree(player.classId);
  const ids = new Set(catalog.map(t => t.id));
  const old = player.talents || [];
  const legacy = old.filter(t => !ids.has(t.id) && t.currentRank > 0).map(t => ({
    ...t, branch: 'legacy' as const, branchName: 'Сохранённые таланты', pointCost: 1,
    effects: t.effects || (t.id === 'arc_t1' ? [{ stat: 'accuracy', valuePerRank: 5 }] : t.id === 'm_t2' ? [{ stat: 'maxMp', valuePerRank: 15 }] : t.id === 'p_t1' ? [{ stat: 'strength', valuePerRank: 5 }] : undefined),
  }));
  return { ...player, talents: [...catalog.map(t => ({ ...t, currentRank: Math.max(0, Math.min(t.maxRank, Math.floor(old.find(o => o.id === t.id)?.currentRank || 0))) })), ...legacy] };
}
export const classTalentStatus = (classId: CharacterClassId) => CLASS_SIGNATURES[classId].status;

export function incomingTalentMultiplier(bonuses: Record<string, number>, hpRatio: number): number {
  return (1 + (bonuses.offensiveStance ? 0.1 : 0)) * (1 - (bonuses.defensiveStance || 0) / 100) * (1 - (hpRatio < 0.4 ? bonuses.lowHpReduction || 0 : 0) / 100);
}

export function talentManaCost(baseCost: number, talents: Talent[]): number {
  return Math.max(0, Math.ceil(baseCost * (1 - (talentBonuses(talents).manaCostReduction || 0) / 100)));
}
