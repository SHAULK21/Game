import type {GameItem, PlayerCharacter} from '../types/game';
import {SHARPENABLE_TYPES} from './sharpening';
import {validStackCount} from './stackRules';

export const MAX_ITEM_ASCENSION = 5;
export const ITEM_ASCENSION_STEP = 0.1;
export const ITEM_ASCENSION_STATS = ['attack', 'magicAttack', 'defense', 'magicDefense', 'maxHp', 'maxMp'] as const;
export const itemAscensionLevel = (item: Pick<GameItem, 'ascensionLevel'>) => item.ascensionLevel ?? 0;
export const validItemAscension = (level: unknown): level is number => Number.isSafeInteger(level) && Number(level) >= 0 && Number(level) <= MAX_ITEM_ASCENSION;
export const itemAscensionMultiplier = (level = 0) => 1 + (validItemAscension(level) ? level : 0) * ITEM_ASCENSION_STEP;

/** Rolled stats stay on the chosen base. Identity includes the equipment class,
 * template, level and rarity; sharpening is independent of ascension. */
export function sameAscensionItem(base: GameItem, material: GameItem) {
  return SHARPENABLE_TYPES.includes(base.type) && !!base.templateId &&
    ['templateId', 'name', 'type', 'level', 'rarity', 'targetClass', 'weaponClass', 'armorClass'].every(key => base[key as keyof GameItem] === material[key as keyof GameItem]) &&
    validItemAscension(itemAscensionLevel(base)) && itemAscensionLevel(base) === itemAscensionLevel(material) &&
    Boolean(base.serverOwned) === Boolean(material.serverOwned) && (base.marketTradable === false) === (material.marketTradable === false);
}

export interface ItemAscensionResult {success: boolean; message: string; player?: PlayerCharacter; item?: GameItem}

/** Read-only quote and atomic rule: consume exactly two units and keep the best
 * sharpening. The caller owns persistence, ownership locks and operation receipts. */
export function mergeEquipment(player: PlayerCharacter, itemId: string, materialId: string, splitId: string): ItemAscensionResult {
  const fail = (message: string): ItemAscensionResult => ({success: false, message});
  const equipped = Object.values(player.equipped).filter((item): item is GameItem => !!item);
  const base = [...player.inventory, ...equipped].find(item => item.id === itemId);
  const material = player.inventory.find(item => item.id === materialId);
  if (!base || !material) return fail('Один із предметів більше не належить вам або відсутній у сумці.');
  if (base.isLocked || material.isLocked || base.boundToClan || material.boundToClan) return fail('Захищені та кланові предмети не можна об’єднувати.');
  if (material.isEquipped || equipped.some(item => item.id === materialId)) return fail('Предмет для витрати потрібно зняти зі спорядження.');
  if (!sameAscensionItem(base, material)) return fail('Потрібні однакові предмети одного рівня, рідкісності та ступеня піднесення.');
  const rank = itemAscensionLevel(base);
  if (rank >= MAX_ITEM_ASCENSION) return fail('Досягнуто максимального піднесення: V.');
  const quantity = base.stackCount ?? 1, materialQuantity = material.stackCount ?? 1;
  if (!validStackCount(quantity) || !validStackCount(materialQuantity) ||
    ![base.upgradeLevel, material.upgradeLevel].every(level => Number.isSafeInteger(level) && level >= 0 && level <= 25)) return fail('Некоректний стан предметів. Оновіть сумку.');
  if (itemId === materialId && quantity < 2) return fail('Для об’єднання потрібні два примірники предмета.');
  const worn = equipped.some(item => item.id === itemId);
  if (worn && quantity !== 1) return fail('Некоректна кількість екіпірованого предмета.');
  const remainder = quantity - (itemId === materialId ? 2 : 1);
  if (remainder > 0 && (!splitId || [...player.inventory, ...equipped].some(item => item.id === splitId))) return fail('Не вдалося створити окремий предмет. Повторіть дію.');
  const result: GameItem = {...base, ascensionLevel: rank + 1, upgradeLevel: Math.max(base.upgradeLevel, material.upgradeLevel), stackCount: 1};
  const inventory: GameItem[] = [];
  for (const item of player.inventory) {
    if (item.id === itemId) {
      if (!worn) inventory.push(result);
      if (remainder > 0) inventory.push({...item, id: splitId, stackCount: remainder});
    } else if (item.id === materialId) {
      if (materialQuantity > 1) inventory.push({...item, stackCount: materialQuantity - 1});
    } else inventory.push(item);
  }
  if (inventory.length > Math.max(player.inventory.length, player.maxInventorySlots)) return fail('Звільніть одне місце в сумці для піднесеного предмета.');
  const next = {...player, inventory, equipped: worn ? {...player.equipped, [base.type]: result} : player.equipped};
  return {success: true, player: next, item: result, message: `Піднесення успішне: ступінь ${rank + 1}/${MAX_ITEM_ASCENSION}. Заточення +${result.upgradeLevel} збережено. Витрачено один примірник.`};
}

export function ascensionMaterials(player: PlayerCharacter, base: GameItem) {
  const equippedIds = new Set(Object.values(player.equipped).filter(Boolean).map(item => item!.id));
  return player.inventory.filter(item => !item.isLocked && !item.boundToClan && !item.isEquipped && !equippedIds.has(item.id) &&
    (item.id !== base.id || (item.stackCount ?? 1) >= 2) && sameAscensionItem(base, item));
}
