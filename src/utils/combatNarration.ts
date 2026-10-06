import type { Monster, MonsterSkill, PlayerCharacter } from '../types/game';

export type PlayerAction = 'attack' | 'skill' | 'defend' | 'potion' | 'flee';
const pick = (lines: string[], round: number) => lines[Math.abs(round) % lines.length];
const fill = (text: string, ...values: (string | number)[]) => text.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));

export function monsterPreparation(monster: Monster, round: number, skill?: MonsterSkill | null): string[] {
  if (skill?.actionKind === 'defend') return [fill('{0} занимает защитную стойку.', monster.name)];
  if (skill?.actionKind === 'potion') return [fill('{0} достаёт склянку и готовится бросить «{1}».', monster.name, skill.name)];
  const identity = (monster.id + ' ' + monster.name).toLowerCase();
  const lines = /wolf|волк|вовк/.test(identity) ? ['{0} прижимается к земле и готовится к прыжку.', '{0} напрягает лапы, выбирая момент для броска.', '{0} скалит клыки и медленно подкрадывается.']
    : /boar|кабан/.test(identity) ? ['{0} опускает голову и готовится к разбегу.', '{0} роет землю копытом перед рывком.', '{0} отступает на шаг, собираясь таранить вас.']
    : /spider|паук|павук/.test(identity) ? ['{0} поднимает передние лапы и готовится броситься.', '{0} натягивает паутину и выбирает цель.', '{0} раскрывает жвала перед атакой.']
    : /golem|голем/.test(identity) ? ['{0} медленно поднимает каменный кулак.', '{0} переносит вес вперёд, готовя тяжёлый удар.', '{0} отводит массивную руку для замаха.']
    : /dragon|дракон/.test(identity) && (skill?.damageType || monster.damageType) === 'fire' ? ['{0} набирает воздух, готовя огненное дыхание.', '{0} расправляет крылья и целится в вас.', '{0} отводит голову назад перед огненным залпом.']
    : (skill?.damageType || monster.damageType || 'physical') !== 'physical' ? ['{0} собирает магическую силу перед ударом.', '{0} удерживает заряд, готовясь выпустить его.', '{0} направляет на вас сгусток энергии.']
    : /goblin|bandit|skeleton|knight|warrior|гоблин|бандит|скелет|рыцар/.test(identity) ? ['{0} медленно отводит оружие для замаха.', '{0} поднимает оружие и выжидает момент.', '{0} делает шаг вперёд, готовя рубящий удар.']
    : ['{0} поднимает лапу и готовится ударить.', '{0} напрягается перед резким выпадом.', '{0} приближается, выбирая момент для атаки.'];
  const result = [fill(pick(lines, round), monster.name)];
  if (skill) result.push(fill(skill.damageMultiplier > 1 ? 'Усиленный приём: «{0}».' : 'Особый приём: «{0}».', skill.name));
  return result;
}
export function playerPreparation(player: PlayerCharacter, action: PlayerAction, round: number, skillName?: string, incoming?: MonsterSkill | null): string[] {
  if (action === 'defend') return [incoming ? 'Вы поднимаете щит и встречаете готовящуюся атаку.' : 'Вы занимаете защитную стойку и прикрываетесь щитом.'];
  if (action === 'potion') return ['Вы вынимаете зелье и готовитесь выпить его.'];
  if (action === 'flee') return ['Вы отступаете и ищете путь для побега.'];
  if (action === 'skill') return [fill('Вы готовите приём «{0}».', skillName || '')];
  if (player.classId === 'archer') return ['Вы натягиваете тетиву и прицеливаетесь.'];
  if (['mage', 'necromancer', 'druid'].includes(player.classId)) return ['Вы собираете магическую силу для атаки.'];
  return [pick(['Вы медленно отводите оружие и готовите удар.', 'Вы делаете шаг вперёд и выбираете момент для атаки.', 'Вы поднимаете оружие для точного удара.'], round)];
}
export function monsterImpact(name: string, damage: number, blocked: number, evaded: boolean, invulnerable: boolean): string[] {
  if (evaded) return [fill('Вы уклонились: атака {0} прошла мимо.', name)];
  if (invulnerable) return [fill('Магическая защита полностью остановила атаку {0}.', name)];
  if (blocked > 0) return [damage === 0
    ? fill('Вы выставили щит и полностью отбили атаку {0}. Поглощено {1} урона.', name, blocked)
    : fill('Вы встретили атаку {0} щитом: поглощено {1} урона, но {2} прошло сквозь защиту.', name, blocked, damage)];
  return [damage > 0 ? fill('Атака {0} достигла цели: вы получили {1} урона.', name, damage) : fill('Атака {0} не смогла пробить вашу защиту.', name)];
}
