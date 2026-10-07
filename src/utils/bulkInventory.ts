import {addStackCounts,MAX_STACK_COUNT} from './stackRules';
import type { GameItem, ItemRarity, ItemType, PlayerCharacter } from '../types/game';

export const BULK_EQUIPMENT_TYPES: ItemType[] = ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'];
export const BULK_RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'];
export type BulkAction = 'sell' | 'disassemble';
export interface BulkFilters { rarities: ItemRarity[]; type: ItemType | 'all'; keepUpgraded: boolean }
export interface BulkReward { gold: number; silver: number; ore: number; count: number }
export interface BulkReceipt extends BulkReward { operationId: string; itemIds: string[] }
export interface PendingBulkDisposal { operationId: string; action: BulkAction; filters: BulkFilters; localIds: string[]; serverIds: string[] }

export const nonNegativeAmount = (value: unknown, max = 100000) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.floor(number))) : 0;
};
export function matchesBulkItem(item: GameItem, filters: BulkFilters, equippedIds: Set<string> = new Set()): boolean {
  return BULK_EQUIPMENT_TYPES.includes(item.type) && filters.rarities.includes(item.rarity) &&
    (filters.type === 'all' || filters.type === item.type) &&
    !item.isEquipped && !equippedIds.has(item.id) && !item.isLocked && !item.boundToClan &&
    (!filters.keepUpgraded || !(item.upgradeLevel > 0));
}
export function selectBulkItems(player: PlayerCharacter, filters: BulkFilters): GameItem[] {
  const equipped = new Set(Object.values(player.equipped).filter(Boolean).map(item => item!.id));
  return [...new Map(player.inventory.filter(item => matchesBulkItem(item, filters, equipped)).map(item => [item.id, item])).values()];
}
export function bulkReward(items: GameItem[], action: BulkAction): BulkReward {
  return items.reduce((sum, item) => {
    const quantity = nonNegativeAmount(item.stackCount ?? 1, MAX_STACK_COUNT);
    return {
      count: sum.count + quantity,
      gold: sum.gold + (action === 'sell' ? nonNegativeAmount(item.sellPrice) * quantity : 0),
      silver: sum.silver + (action === 'disassemble' ? nonNegativeAmount(item.disassembleYield?.silver) * quantity : 0),
      ore: sum.ore + (action === 'disassemble' ? nonNegativeAmount(item.disassembleYield?.ore, 1000) * quantity : 0),
    };
  }, {gold:0,silver:0,ore:0,count:0});
}
export function applyBulkDisposal(player: PlayerCharacter, operation: PendingBulkDisposal, receipt: BulkReceipt): PlayerCharacter {
  if (player.lastBulkDisposalId === operation.operationId) return player;
  const ids = new Set(operation.localIds);
  const local = selectBulkItems(player, operation.filters).filter(item => !item.serverOwned && ids.has(item.id));
  const localReward = bulkReward(local, operation.action);
  const removed = new Set([...local.map(item => item.id), ...receipt.itemIds]);
  const inventory = player.inventory.filter(item => !removed.has(item.id)).map(item => ({...item}));
  const ore = localReward.ore + receipt.ore;
  if (ore > 0) {
    const existing = inventory.find(item => item.type === 'ore' && item.templateId === 'iron_ore' && item.name === 'Железная руда' && !item.serverOwned);
    if (existing) existing.stackCount = addStackCounts(existing.stackCount || 1,ore);
    else inventory.push({ id: 'bulk_ore_' + operation.operationId, templateId:'iron_ore',name:'Железная руда',type:'ore',rarity:'common',level:1,upgradeLevel:0,icon:'⚪',stats:{},sellPrice:12,disassembleYield:{ore:1},stackCount:ore,description:'Руда, полученная разбором снаряжения.' });
  }
  return { ...player, inventory, gold: player.gold + localReward.gold + receipt.gold, silver: player.silver + localReward.silver + receipt.silver, lastBulkDisposalId: operation.operationId };
}
export const pendingBulkKey = (userId: string) => 'aethelgard_bulk_pending_' + userId;
