import type { Skill } from '../types/game';
import { CLASSES } from '../data/gameData';
import { CLASS_SKILLS } from '../data/classEvolution';
import { translateText, type Locale } from '../i18n/translate';

/** Base mechanics, read from the same declarative fields as the PvE resolver.
 * Talent, class and evolution bonuses are deliberately labelled separately. */
export function skillDetails(skill: Skill, locale: Locale = 'ru'): string[] {
  const text = (key: string, ...values: (string | number)[]) => translateText(key, locale).replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)]));
  const pct = (n: number) => Math.round(n * 10000) / 100;
  const lines = [text('Уровень: {0}. Мана: {1} MP. Перезарядка: {2} ходов.', skill.levelReq, skill.manaCost, skill.cooldown)];
  const types: Record<Skill['damageType'], string> = { physical:'Физический', magic:'Магический', fire:'Огонь', ice:'Лёд', lightning:'Молния', poison:'Яд', dark:'Тьма', holy:'Свет', true:'Чистый' };
  if (skill.damageMultiplier > 0) {
    lines.push(text('Базовый урон: {0}% силы атаки. Тип: {1}.', pct(skill.damageMultiplier), translateText(types[skill.damageType], locale)));
    lines.push(text(skill.damageType === 'true' ? 'Основа урона: большее из физической и магической атаки.' : skill.damageType !== 'physical' && ['mage','necromancer','druid'].includes(skill.classId) ? 'Основа урона: магическая атака героя.' : 'Основа урона: физическая атака героя.'));
    if ((skill.hits || 1) > 1) lines.push(text('Удары: {0}. Общий множитель делится между ударами; попадание и крит проверяются отдельно.', skill.hits!));
    lines.push(text('Итоговый урон зависит от защиты и сопротивлений цели, критов и бонусов героя.'));
  } else lines.push(text('Поддержка: занимает ход, не наносит прямого урона.'));
  if (skill.healMultiplier) {
    if (skill.damageMultiplier > 0) lines.push(text('Лечение: {0}% фактически нанесённого урона.', pct(skill.healMultiplier)));
    else if (skill.id.startsWith('asc_')) lines.push(text('Базовое лечение: большее из {0} HP и {1}% максимального HP.', 100 * skill.healMultiplier, 4 * skill.healMultiplier));
    else lines.push(text('Базовое лечение: {0} HP.', 100 * skill.healMultiplier));
    lines.push(text('Лечение усиливается талантами; у паладина дополнительно +15%. Не превышает максимальное HP.'));
  }
  const e = skill.inflicts;
  if (e) {
    const names: Record<string,string> = { shield:'Щит', fortify:'Укрепление', fury:'Ярость', haste:'Ускорение', invulnerable:'Неуязвимость', stun:'Оглушение', freeze:'Заморозка', poison:'Яд', bleed:'Кровотечение', burn:'Ожог', vulnerability:'Уязвимость', focus:'Концентрация' };
    const self = ['shield','fortify','fury','haste','invulnerable'].includes(e.type);
    lines.push(self ? text('На себя: {0}. Длительность: {1} ходов.',translateText(names[e.type] || e.type,locale), e.duration)
      : text('На цель при попадании: {0}. Шанс за удар: {1}%. Длительность: {2} ходов.',translateText(names[e.type] || e.type,locale),pct(e.chance),e.duration));
    if (e.type === 'shield') lines.push(skill.id.startsWith('asc_') ? text('Щит поглощает большее из {0} урона и {1}% максимального HP.',e.power,e.power/25) : text('Щит поглощает до {0} урона.',e.power));
    if (['stun','freeze'].includes(e.type)) lines.push(text('Цель пропускает ход, пока действует контроль.'));
    if (['poison','bleed','burn'].includes(e.type)) lines.push(text('Базовый периодический урон: {0} за ход цели, до сопротивлений и бонусов.',e.power));
    if (e.type === 'poison') lines.push(text('Яд накапливается до 5 слоёв; каждый слой увеличивает периодический урон. Повторное применение обновляет длительность.'));
    if (e.type === 'vulnerability') lines.push(text('Получаемый целью урон: +{0}%.',e.power));
    if (['fury','haste'].includes(e.type)) lines.push(text('Сила атаки: +{0}%.',e.power));
    if (e.type === 'fortify') lines.push(text('Получаемый урон: −{0}%.',e.power));
    if (e.type === 'focus') lines.push(text('Шанс критического удара: +{0}%.',e.power));
  }
  if (skill.armorBreak) lines.push(text('При попадании первого удара: цель получает на {0}% больше урона в течение 3 ходов.',skill.armorBreak));
  if (skill.comboFrom) {
    const prior = [...CLASSES[skill.classId].startingSkills,...CLASS_SKILLS[skill.classId]].find(s=>s.id===skill.comboFrom);
    lines.push(text('Связка: после «{0}», если это последний навык и прошло не более 3 ходов, урон ×{1}.',translateText(prior?.name || skill.comboFrom,locale),skill.comboMultiplier || 1.25));
  }
  if (skill.executeThreshold) lines.push(text('При HP цели не выше {0}%: урон ×{1}.',pct(skill.executeThreshold),skill.executeMultiplier || 1.5));
  if (skill.instantExecutePve) lines.push(text('Добивает обычного монстра в пещере при попадании и достижении порога HP. Не действует на боссов и вне пещеры.'));
  if (skill.guaranteedHit) lines.push(text('Игнорирует обычное уклонение. Против неуязвимости шанс попадания 50%.'));
  if (skill.guaranteedEvade) lines.push(text('Скрытность: неуязвимость на 1 ход. В течение 3 ходов, пока это последний навык, атаки ассасина гарантированно попадают и критуют; против неуязвимости шанс попадания 50%.'));
  if (skill.poisonBurst) lines.push(text('Снимает яд с цели и добавляет 22 процентных пункта к множителю урона за каждый слой. Без яда бонуса нет.'));
  return lines;
}
