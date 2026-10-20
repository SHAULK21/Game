import {PICKAXES} from '../src/utils/mining';
import {ALCHEMY_TOOLS} from '../src/utils/alchemy';
import {validStackCount} from '../src/utils/stackRules';
import type { PlayerCharacter, Quest, Achievement, DungeonRun, TravelState } from '../src/types/game';
import {applyDungeonDifficulty} from '../src/utils/dungeonRewards';
import {recordFlight} from '../src/utils/flightPenalty';

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
    if (!object(item) || typeof item.id !== 'string' || !item.id || !object(item.stats) || !Number.isSafeInteger(item.level) || item.level < 1 || item.level > 120 || !validStackCount(item.stackCount ?? 1)) throw new ProgressError('INVALID_SAVE', 'Некорректный предмет.', 400);
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
/** This is exclusively an admission rule for the one-time legacy migration.
 * Ordinary writes use finite server commands and never call this function. */
export function validateLegacyProgress(input: any, owner: number, epoch: number, catalog: Pick<typeof import('../src/game/actorEntry'), 'INITIAL_QUESTS' | 'INITIAL_ACHIEVEMENTS' | 'CAVES' | 'REGIONS' | 'MONSTERS' | 'getRegionMonster' | 'PETS_LIST'>) {
  // Normalize historical formats before strict admission; retain the untouched
  // source in the migration backup. Conversion is applied exactly once.
  const normalized = structuredClone(input);
  if (normalized?.player) {
    const p = normalized.player;
    p.silver = (p.silver ?? 0) + (p.shards ?? 0) * 10 + (p.crystals ?? 0) * 40;
    delete p.shards; delete p.crystals;
    for (const item of [...(p.inventory || []), ...Object.values(p.equipped || {}).filter(Boolean)] as any[]) {
      if (!item.templateId) item.templateId = item.type === 'pickaxe' ? PICKAXES.find(tool => tool.name === item.name)?.id : item.type === 'alchemyTool' ? ALCHEMY_TOOLS.find(tool => tool.name === item.name)?.id : undefined;
    }
  }
  const save = validateProgress(normalized, owner, epoch, true), p = save.player;
  const bounded = (value: unknown, min: number, max: number, fallback?: number) => {
    const actual = value === undefined && fallback !== undefined ? fallback : value;
    if (!Number.isSafeInteger(actual) || Number(actual) < min || Number(actual) > max) throw new ProgressError('INVALID_SAVE', 'Недопустимое значение прогресса.', 400);
    return Number(actual);
  };
  for (const attribute of ['strength', 'agility', 'intelligence', 'vitality', 'luck', 'spirit', 'willpower'] as const) bounded(p.attributes[attribute], 0, 100000);
  if(p.activePet){const pet=catalog.PETS_LIST.find(pet=>pet.id===p.activePet?.id);if(!pet)throw new ProgressError('INVALID_SAVE','Неизвестный спутник.',400);p.activePet=structuredClone(pet);}
  p.craftedPetIds=(Array.isArray(p.craftedPetIds)?p.craftedPetIds:[p.activePet?.id||'pet_wolf']).filter(id=>catalog.PETS_LIST.some(pet=>pet.id===id));
  p.miningLevel = bounded(p.miningLevel, 1, 100, 1);
  p.miningExp = bounded(p.miningExp, 0, 2147483647, 0);
  p.alchemyLevel = bounded(p.alchemyLevel, 1, 100, 1);
  p.alchemyExp = bounded(p.alchemyExp, 0, 2147483647, 0);
  p.stamina = bounded(p.stamina, 0, 100000, 100); p.maxStamina = bounded(p.maxStamina, 1, 100000, 100);
  p.alchemyEnergy = bounded(p.alchemyEnergy, 0, 100000, 100); p.maxAlchemyEnergy = bounded(p.maxAlchemyEnergy, 1, 100000, 100);
  if (p.stamina > p.maxStamina || p.alchemyEnergy > p.maxAlchemyEnergy) throw new ProgressError('INVALID_SAVE', 'Ресурс превышает свой максимум.', 400);
  p.statPoints = bounded(p.statPoints, 0, 100000, 0); p.talentPoints = bounded(p.talentPoints, 0, 100000, 0);
  p.arenaRating = bounded(p.arenaRating, 0, 2147483647, 1000); p.arenaTickets = bounded(p.arenaTickets, 0, 1000, 5);
  p.statsSummary = {...p.statsSummary};
  for (const key of ['monstersKilled', 'bossesDefeated', 'battlesWon', 'battlesLost', 'totalDamageDealt', 'highestCrit', 'oresMined', 'potionsCrafted', 'itemsUpgraded', 'maxUpgradeReached', 'dungeonsCleared'] as const) {
    p.statsSummary[key] = bounded(p.statsSummary[key], 0, Number.MAX_SAFE_INTEGER, 0);
  }
  p.statsSummary.oresMined ??= 0;
  // Reward definitions come from the server catalogue. Only historical progress
  // and the claimed marker are migrated; a client cannot define a new reward.
  save.quests = catalog.INITIAL_QUESTS.map(definition => {
    const old = save.quests.find(quest => quest.id === definition.id);
    const claimed = old?.claimed === true, currentCount = old?.completed === true || claimed ? definition.targetCount : Math.min(definition.targetCount, bounded(old?.currentCount, 0, 2147483647, 0));
    return {...structuredClone(definition), currentCount, completed: currentCount >= definition.targetCount, claimed};
  });
  save.achievements = catalog.INITIAL_ACHIEVEMENTS.map(definition => {
    const old = save.achievements.find(achievement => achievement.id === definition.id);
    const claimed = old?.claimed === true, progress = old?.completed === true || claimed ? definition.maxProgress : Math.min(definition.maxProgress, bounded(old?.progress, 0, 2147483647, 0));
    return {...structuredClone(definition), progress, completed: progress >= definition.maxProgress, claimed};
  });
  const types = ['weapon','offhand','helmet','armor','pants','gloves','boots','amulet','ring','belt','cloak','pet','pickaxe','alchemyTool','artifact','potion','ore','material'];
  const rarities = ['common','uncommon','rare','epic','legendary','mythic','ancient','divine'];
  for (const item of [...p.inventory, ...Object.values(p.equipped).filter(Boolean)]) {
    if (!types.includes(item.type) || !rarities.includes(item.rarity) || typeof item.templateId !== 'string' || !item.templateId || item.templateId.length > 200 || typeof item.name !== 'string' || item.name.length > 200 || typeof item.icon !== 'string') throw new ProgressError('INVALID_SAVE', 'Неизвестный тип предмета.', 400);
    bounded(item.upgradeLevel, 0, 25, 0); bounded(item.sellPrice, 0, 1000000, 0);
    // Legacy imports predate merging; only authoritative game commands may grant tiers.
    delete item.mergeLevel;
    for (const value of Object.values(item.stats)) if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100000) throw new ProgressError('INVALID_SAVE', 'Некорректная характеристика предмета.', 400);
    for (const value of Object.values(item.disassembleYield || {})) bounded(value, 0, 1000000);
  }
  for (const [slot, item] of Object.entries(p.equipped)) if (item && slot !== item.type) throw new ProgressError('INVALID_SAVE', 'Предмет экипирован в неверном слоте.', 400);
  if (save.activeDungeonRun) {
    const old = save.activeDungeonRun, cave = catalog.CAVES[old.dungeonId], region = catalog.REGIONS.find(item => item.id === cave?.regionId);
    if (!cave || !region || !['normal','hard','nightmare','hell'].includes(old.difficulty) || !Array.isArray(old.rooms) || old.rooms.length !== cave.roomsCount) throw new ProgressError('INVALID_SAVE', 'Некорректный незавершённый поход.', 400);
    const index = bounded(old.currentRoomIndex, 0, cave.roomsCount);
    const rooms = old.rooms.map((room, at) => {
      if (!['combat','boss','elite','treasure','shrine','trap','merchant'].includes(room.type) || (at === cave.roomsCount - 1) !== (room.type === 'boss')) throw new ProgressError('INVALID_SAVE', 'Некорректная комната похода.', 400);
      const type = room.type, id = type === 'boss' ? cave.bossMonsterId : room.monster?.id;
      const monster = id && catalog.MONSTERS[id];
      if (['boss','elite','combat'].includes(type) && (!monster || !region.monsters.includes(monster.id) && type !== 'boss')) throw new ProgressError('INVALID_SAVE', 'Неизвестный противник похода.', 400);
      return {id: `room_${cave.id}_${at + 1}`, roomNumber: at + 1, type, title: typeof room.title === 'string' ? room.title : cave.name, description: typeof room.description === 'string' ? room.description : '', resolved: at < index || room.resolved === true, rewardClaimed: at < index || room.rewardClaimed === true,
        ...(monster ? {monster: applyDungeonDifficulty({...catalog.getRegionMonster(monster, region, cave.minLevel), isElite: type === 'elite' || monster.isElite}, old.difficulty)} : {})};
    });
    save.activeDungeonRun = {dungeonId: cave.id, dungeonName: cave.name, difficulty: old.difficulty, rooms, totalRooms: cave.roomsCount, currentRoomIndex: index, completed: old.completed === true,
      ...(old.savedHp !== undefined ? {savedHp: bounded(old.savedHp, 1, 10000000)} : {}), ...(old.savedMp !== undefined ? {savedMp: bounded(old.savedMp, 0, 10000000)} : {})};
  }
  if (p.worldJourney?.ambushMonsterId) {
    const region = catalog.REGIONS.find(item => item.id === p.worldJourney?.regionId), monster = catalog.MONSTERS[p.worldJourney.ambushMonsterId];
    if (!region?.monsters.includes(monster?.id) || monster?.isBoss || monster?.isElite) throw new ProgressError('INVALID_SAVE', 'Некорректная засада в путешествии.', 400);
  }
  if (save.combat?.isInCombat === true && save.combat.isCombatEnded !== true || p.firstJourney === 'battle') {
    // Legacy clients did not save enough trustworthy combat state. No old reward
    // is granted and no spent energy is refunded; retain cave damage and apply
    // the normal flight penalty. New canonical actors resume the exact turn.
    save.player = recordFlight(p);
    if (save.player.firstJourney === 'battle') save.player.firstJourney = 'briefing';
    if (save.activeDungeonRun) save.activeDungeonRun.savedHp = Math.min(save.activeDungeonRun.savedHp ?? 1, bounded(save.combat?.combatPlayerHp, 0, 10000000, 1) || 1);
  }
  save.combat = null;
  return save;
}
