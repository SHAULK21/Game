import type { PlayerCharacter, Quest, Achievement, DungeonRun, TravelState } from '../src/types/game';

export interface ProgressSave {
  resetVersion: number;
  player: PlayerCharacter;
  quests: Quest[];
  achievements: Achievement[];
  activeDungeonRun: DungeonRun | null;
  travelState?: TravelState;
  combat?: Record<string, any> | null;
}
export class ProgressError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
function inspect(value: any, depth = 0) {
  if (depth > 24) throw new ProgressError('INVALID_SAVE', 'Слишком глубокая структура сохранения.', 400);
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new ProgressError('INVALID_SAVE', 'Недопустимое числовое значение.', 400);
  if (typeof value === 'string' && value.length > 10000) throw new ProgressError('INVALID_SAVE', 'Слишком длинное значение.', 400);
  if (Array.isArray(value) && value.length > 5000) throw new ProgressError('INVALID_SAVE', 'Слишком большой список.', 400);
  if (object(value) || Array.isArray(value)) for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new ProgressError('INVALID_SAVE', 'Недопустимое поле.', 400);
    inspect(child, depth + 1);
  }
}
/** Validate ownership before accepting anything; ledger projections are never persisted. */
export function validateProgress(input: any, owner: number, epoch: number, migration = false): ProgressSave {
  if (!object(input) || !object(input.player) || String(input.player.userId) !== String(owner)) throw new ProgressError('WRONG_OWNER', 'Сохранение принадлежит другому Telegram-аккаунту.', 400);
  const version = input.resetVersion ?? (migration && epoch === 0 ? 0 : -1);
  if (version !== epoch) throw new ProgressError('ACCOUNT_RESET', 'Это сохранение создано до административного сброса.');
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 1024 * 1024) throw new ProgressError('INVALID_SAVE', 'Сохранение превышает 1 МБ.', 400);
  inspect(input);
  const p = input.player;
  if (!['warrior','berserker','knight','rogue','assassin','archer','mage','necromancer','paladin','druid'].includes(p.classId) || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || p.name.length > 80) throw new ProgressError('INVALID_SAVE', 'Некорректный персонаж.', 400);
  for (const [field, min, max] of [['level',1,120],['gold',0,2147483647],['silver',0,2147483647],['exp',0,2147483647],['energy',0,100000],['maxEnergy',1,100000],['maxInventorySlots',1,5000]] as const) {
    if (!Number.isSafeInteger(p[field]) || p[field] < min || p[field] > max) throw new ProgressError('INVALID_SAVE', `Недопустимое значение ${field}.`, 400);
  }
  if (p.energy > p.maxEnergy || !object(p.attributes) || !Array.isArray(p.skills) || !Array.isArray(p.inventory) || !object(p.equipped) || !Array.isArray(input.quests) || !Array.isArray(input.achievements)) throw new ProgressError('INVALID_SAVE', 'Неполная структура сохранения.', 400);
  const ids = new Set<string>();
  for (const item of [...p.inventory, ...Object.values(p.equipped).filter(Boolean)] as any[]) {
    if (!object(item) || typeof item.id !== 'string' || !item.id || !object(item.stats) || !Number.isSafeInteger(item.level) || item.level < 1 || item.level > 120 || !Number.isSafeInteger(item.stackCount ?? 1) || (item.stackCount ?? 1) < 1 || (item.stackCount ?? 1) > 999) throw new ProgressError('INVALID_SAVE', 'Некорректный предмет.', 400);
    if (ids.has(item.id)) throw new ProgressError('INVALID_SAVE', 'Предмет повторяется в сохранении.', 400);
    ids.add(item.id);
  }
  const save = structuredClone({resetVersion:epoch,player:p,quests:input.quests,achievements:input.achievements,activeDungeonRun:input.activeDungeonRun || null,travelState:input.travelState,combat:input.combat || null}) as ProgressSave;
  save.player.userId = String(owner);
  save.player.inventory = save.player.inventory.filter(item => !item.serverOwned);
  save.player.equipped = Object.fromEntries(Object.entries(save.player.equipped).filter(([,item]) => !item?.serverOwned));
  // Wallet, clan membership, Premium and ledger item ownership belong to their SQL tables.
  delete save.player.marketGold;
  delete save.player.clanId;
  return save;
}
