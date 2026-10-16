import type {CharacterAttributes, GameItem, ItemType, AutoBattleSettings} from '../src/types/game';
import {BASIC_SHOP} from '../src/game/shop';
import {ProgressError} from './progressValidation';
import {GameActor} from './gameActor';

export type GameCommand = {type: string; [key: string]: unknown};
const fail = (message = 'Некорректные параметры игрового действия.'): never => {throw new ProgressError('INVALID_COMMAND', message, 400);};
const string = (value: unknown, optional = false) => value === undefined && optional ? undefined : typeof value === 'string' && value.length > 0 && value.length <= 160 ? value : fail();
const boolean = (value: unknown, fallback = false) => value === undefined ? fallback : typeof value === 'boolean' ? value : fail();
const integer = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fail();
const choice = <T extends string>(value: unknown, options: readonly T[], optional = false): T | undefined => value === undefined && optional ? undefined : options.includes(value as T) ? value as T : fail();
const ATTRIBUTES = ['strength','agility','intelligence','vitality','luck','spirit','willpower'] as const;
const SLOTS = ['weapon','offhand','helmet','armor','pants','gloves','boots','amulet','ring','belt','cloak','pet','pickaxe','alchemyTool','artifact','potion','ore','material'] as const;
const PRESENTATION = new Set(['keepServer','dismissFlightWarning','dismissOfflineReport','dismissAdventureStory','setAdventureStoryStep']);
export function isPresentationCommand(command: GameCommand) {return PRESENTATION.has(command.type);}
function owned(actor: GameActor, id: unknown): GameItem {
  const itemId = string(id), item = actor.current.player?.inventory.find(item => item.id === itemId);
  if (!item) throw new ProgressError('ITEM_CHANGED', 'Предмет больше не находится в вашей сумке.');
  return item;
}
/** Finite commands resolve objects from the locked inventory or the real server
 * catalogue. No monster stats, reward, wallet or player snapshot is accepted. */
export async function executeGameCommand(actor: GameActor, command: GameCommand) {
  if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') fail();
  const p = actor.current.player;
  if (!p) throw new ProgressError('NO_CHARACTER', 'Сначала создайте или перенесите персонажа.');
  if (command.type.startsWith('admin') && !actor.admin) throw new ProgressError('FORBIDDEN', 'Доступно только администратору.', 403);
  switch (command.type) {
    case 'keepServer': return null;
    case 'allocateAttribute': return actor.invoke('allocateAttribute', choice(command.attribute, ATTRIBUTES)! as keyof CharacterAttributes);
    case 'unlockTalent': return actor.invoke('unlockTalent', string(command.talentId)!);
    case 'resetTalentTree': return actor.invoke('resetTalentTree');
    case 'setActivePet': return actor.invoke('setActivePet', string(command.petId)!);
    case 'craftPet': return actor.invoke('craftPet', string(command.petId)!);
    case 'equipItem': return actor.invoke('equipItem', owned(actor, command.itemId));
    case 'unequipItem': return actor.invoke('unequipItem', choice(command.slot, SLOTS)! as ItemType);
    case 'sellItem': return actor.invoke('sellItem', owned(actor, command.itemId));
    case 'disassembleItem': return actor.invoke('disassembleItem', owned(actor, command.itemId));
    case 'toggleItemLock': return actor.invoke('toggleItemLock', owned(actor, command.itemId).id);
    case 'expandInventory': return actor.invoke('expandInventory');
    case 'upgradeItem': return actor.invoke('upgradeItem', owned(actor, command.itemId), boolean(command.useProtection));
    case 'claimRegionCompletion': return actor.invoke('claimRegionCompletion', string(command.regionId)!);
    case 'drinkBeer': return actor.invoke('drinkBeer');
    case 'dismissFlightWarning': return actor.invoke('dismissFlightWarning');
    case 'startBattleWithMonster': {
      const region = actor.catalog.REGIONS.find(region => region.id === p.currentRegionId), monsterId = string(command.monsterId)!;
      const monster = actor.catalog.MONSTERS[monsterId];
      if (!region || !monster || !region.monsters.includes(monsterId) || p.worldPlace !== 'field') throw new ProgressError('INVALID_ENCOUNTER', 'Этот противник недоступен в текущей земле.', 400);
      const modeId = string(command.modeId, true);
      if (modeId && !region.availableMods.includes(modeId)) throw new ProgressError('INVALID_MODE', 'Режим недоступен в этой земле.', 400);
      if (modeId && modeId !== (p.activeRegionModId || region.defaultModId)) throw new ProgressError('MODE_CHANGED', 'Сначала подтвердите переход в выбранный режим.');
      return actor.invoke('startBattleWithMonster', actor.catalog.getRegionMonster(monster, region), {chain: boolean(command.chain, true), huntingModeId: modeId});
    }
    case 'performPlayerAction': return actor.invoke('performPlayerAction', choice(command.action, ['attack','skill','defend','potion','flee'])!, string(command.id, true));
    case 'startNextCombatBattle': return actor.invoke('startNextCombatBattle');
    case 'exitCombat': {
      if (actor.current.isInCombat && !actor.current.isCombatEnded) return actor.invoke('performPlayerAction', 'flee');
      return actor.invoke('exitCombat');
    }
    case 'startTravel': return actor.invoke('startTravel', string(command.regionId)!, string(command.modeId, true));
    case 'setCurrentRegion': return actor.invoke('setCurrentRegion', string(command.regionId)!);
    case 'setActiveRegionMod': return actor.invoke('setActiveRegionMod', string(command.modeId)!);
    case 'returnToSettlement': return actor.invoke('returnToSettlement');
    case 'enterDungeon': return actor.invoke('enterDungeon', string(command.dungeonId)!, choice(command.difficulty, ['normal','hard','nightmare','hell'], true));
    case 'proceedDungeonRoom': return actor.invoke('proceedDungeonRoom', choice(command.choice, ['fight','open','pray','disarm'], true));
    case 'exitDungeon': {
      if (actor.current.isInCombat && !actor.current.isCombatEnded) throw new ProgressError('COMBAT_ACTIVE', 'Сначала завершите бой или сбегите.');
      return actor.invoke('exitDungeon');
    }
    case 'buyPickaxe': return actor.invoke('buyPickaxe', string(command.pickaxeId)!);
    case 'mineNode': return actor.invoke('mineNode', string(command.nodeId)!);
    case 'craftBasicItem': return actor.invoke('craftBasicItem', string(command.recipeId)!);
    case 'buyAlchemyTool': return actor.invoke('buyAlchemyTool', string(command.toolId)!);
    case 'craftAlchemy': return actor.invoke('craftAlchemy', string(command.recipeId)!);
    case 'fishingAction': return actor.invoke('fishingAction', choice(command.action, ['cast','hook','pull','slack','brace','land','cancel','upgrade'])!, string(command.id, true), command.step === undefined ? undefined : integer(command.step, 0, 20));
    case 'challengeAscension': return actor.invoke('challengeAscension', string(command.echoId, true));
    case 'ascend': return actor.invoke('ascend', choice(command.path, ['precision','ward','flow'], true));
    case 'challengeArena': {
      const opponent = actor.catalog.ARENA_BOTS.find(opponent => opponent.id === string(command.opponentId));
      if (!opponent) return fail('Противник арены не найден.');
      return actor.invoke('challengeArena', opponent);
    }
    case 'claimQuestReward': return actor.invoke('claimQuestReward', string(command.questId)!);
    case 'claimAchievementReward': return actor.invoke('claimAchievementReward', string(command.achievementId)!);
    case 'setAdventureStoryStep': return actor.invoke('setAdventureStoryStep', integer(command.step, 0, 20));
    case 'finishAdventureStory': return actor.invoke('finishAdventureStory');
    case 'dismissAdventureStory': return actor.invoke('dismissAdventureStory');
    case 'advanceRoyalBriefing': return actor.invoke('advanceRoyalBriefing');
    case 'acknowledgeFirstJourney': return actor.invoke('acknowledgeFirstJourney');
    case 'dismissOfflineReport': return actor.invoke('dismissOfflineReport');
    case 'toggleAutoBattle': return actor.invoke('toggleAutoBattle');
    case 'updateAutoBattleSettings': {
      const input = command.settings as AutoBattleSettings;
      if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
      const settings: Partial<AutoBattleSettings> = {};
      for (const key of ['useSkills','useUltimate','autoRebattle'] as const) if (input[key] !== undefined) settings[key] = boolean(input[key]);
      for (const key of ['healAtHpPercent','fleeAtHpPercent'] as const) if (input[key] !== undefined) settings[key] = integer(input[key], 0, 100);
      if (input.maxBattles !== undefined) settings.maxBattles = integer(input.maxBattles, 1, 500);
      return actor.invoke('updateAutoBattleSettings', settings);
    }
    case 'buyBasicConsumable': {
      const product = BASIC_SHOP.find(product => product.id === string(command.templateId));
      if (!product) return fail('Товар не найден.');
      return actor.invoke('buyBasicConsumable', product.id, product.price);
    }
    case 'adminAddGold': return actor.invoke('adminAddGold', integer(command.amount, 1, 1000000));
    case 'adminAddSilver': return actor.invoke('adminAddSilver', integer(command.amount, 1, 1000000));
    case 'adminLevelUp': return actor.invoke('adminLevelUp');
    case 'adminSpawnLegendaryItem': return actor.invoke('adminSpawnLegendaryItem');
    case 'adminHealAll': return actor.invoke('adminHealAll');
    default: throw new ProgressError('UNKNOWN_COMMAND', 'Это действие не поддерживается сервером.', 400);
  }
}
