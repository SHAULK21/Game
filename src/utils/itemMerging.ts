import type {GameItem, PlayerCharacter} from '../types/game';
import {SHARPENABLE_TYPES} from './sharpening';

export const MAX_MERGE_LEVEL = 10;
export const mergeLevel = (item: Pick<GameItem, 'mergeLevel'>) => Number.isSafeInteger(item.mergeLevel) && item.mergeLevel! >= 0 && item.mergeLevel! <= MAX_MERGE_LEVEL ? item.mergeLevel! : 0;
export const mergingMultiplier = (level = 0) => 1 + Math.min(MAX_MERGE_LEVEL, Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0)) * 0.1;
export const mergeableItem = (item: GameItem) => SHARPENABLE_TYPES.includes(item.type) && !item.isLocked && !item.boundToClan && (item.stackCount ?? 1) === 1;

/** Random affixes and sharpening may differ; the underlying equipment must match. */
export function sameMergeItem(a: GameItem, b: GameItem) {
  return a.id !== b.id && a.templateId === b.templateId && a.name === b.name && a.type === b.type && a.rarity === b.rarity && a.level === b.level
    && a.targetClass === b.targetClass && a.weaponClass === b.weaponClass && a.armorClass === b.armorClass;
}
export function itemMergeQuote(base: GameItem, donor: GameItem) {
  if (!mergeableItem(base) || !mergeableItem(donor) || donor.isEquipped || !sameMergeItem(base, donor)) return {chance: 0, message: 'Нужны два одинаковых предмета одной редкости и уровня. Снимите блокировку; второй предмет должен быть в сумке.'};
  const level = mergeLevel(base), donorLevel = mergeLevel(donor);
  if (level >= MAX_MERGE_LEVEL) return {chance: 0, message: 'Достигнут предел объединения: 10.'};
  if (donorLevel > level) return {chance: 0, message: 'Выберите предмет с большим уровнем объединения основным.'};
  return {chance: Math.pow(0.5, level - donorLevel), message: ''};
}

/** Pure ownership change: the caller persists this together with its operation receipt. */
export function mergePlayerItems(player: PlayerCharacter, baseId: string, donorId: string, roll: number) {
  const base = [...player.inventory, ...Object.values(player.equipped)].find(i => i?.id === baseId);
  const donor = player.inventory.find(i => i.id === donorId);
  const refused = (message: string) => ({player, result: {success: false, message}});
  if (!base || !donor) return refused('Предмет больше не находится у персонажа.');
  const quote = itemMergeQuote(base, donor);
  if (!quote.chance) return refused(quote.message);
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return refused('Не удалось выполнить объединение.');
  const success = roll < quote.chance;
  const update = (item: GameItem) => item.id === baseId && success ? {...item, mergeLevel: mergeLevel(base) + 1} : item;
  const next = {...player, inventory: player.inventory.filter(i => i.id !== donorId).map(update),
    equipped: Object.fromEntries(Object.entries(player.equipped).map(([slot, item]) => [slot, item ? update(item) : item]))};
  return {player: next, result: {success, message: success
    ? `Объединение успешно: ${base.name}, ступень ${mergeLevel(base) + 1}. Второй предмет израсходован. Заточка и редкость сохранены.`
    : 'Объединение не удалось. Второй предмет израсходован. Основной предмет, заточка и редкость сохранены.'}};
}
