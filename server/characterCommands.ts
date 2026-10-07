import {
  CLASSES,
  REGIONS,
  MONSTERS,
  getRegionMonster,
} from "../src/data/gameData";
import { arenaOpponents } from "../src/utils/arena";
import type { GameEngine } from "./gameEngine";
const scalar = (value: any) =>
  value === undefined ||
  value === null ||
  typeof value === "boolean" ||
  typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value));
const commands = new Set([
  "createCharacter",
  "acknowledgeFirstJourney",
  "advanceRoyalBriefing",
  "setAdventureStoryStep",
  "finishAdventureStory",
  "dismissAdventureStory",
  "dismissFlightWarning",
  "allocateAttribute",
  "unlockTalent",
  "resetTalentTree",
  "equipItem",
  "unequipItem",
  "sellItem",
  "sellToResidents",
  "disassembleItem",
  "bulkDisposeItems",
  "toggleItemLock",
  "refreshServerInventory",
  "expandInventory",
  "upgradeItem",
  "meditateOrRefillEnergy",
  "claimRegionCompletion",
  "setActiveRegionMod",
  "setActivePet",
  "craftPet",
  "startBattleWithMonster",
  "startNextCombatBattle",
  "performPlayerAction",
  "toggleAutoBattle",
  "updateAutoBattleSettings",
  "exitCombat",
  "setCurrentRegion",
  "startTravel",
  "enterDungeon",
  "proceedDungeonRoom",
  "exitDungeon",
  "buyAlchemyTool",
  "buyPickaxe",
  "mineNode",
  "startMiningExpedition",
  "claimMiningExpedition",
  "leaveMiningExpedition",
  "craftAlchemy",
  "fishingAction",
  "listMarketItem",
  "refreshMarketIncome",
  "returnMarketListing",
  "buyMarketListing",
  "buyBasicConsumable",
  "craftBasicItem",
  "refreshPremiumStatus",
  "preparePremiumInvoice",
  "createClan",
  "challengeAscension",
  "ascend",
  "challengeArena",
  "claimQuestReward",
  "claimAchievementReward",
  "sendChatMessage",
  "dismissOfflineReport",
  "adminAddGold",
  "adminAddSilver",
  "adminLevelUp",
  "adminSpawnLegendaryItem",
  "adminHealAll",
  "_tick",
]);
const itemCommands = new Set([
  "equipItem",
  "sellItem",
  "sellToResidents",
  "disassembleItem",
  "upgradeItem",
  "listMarketItem",
]);
export function validateCommand(engine: GameEngine, command: any, args: any) {
  if (
    typeof command !== "string" ||
    !commands.has(command) ||
    !Array.isArray(args) ||
    args.length > 4 ||
    JSON.stringify(args).length > 32000
  )
    throw new Error("Недопустимая игровая команда.");
  const player = engine.model.player;
  if (command === "createCharacter") {
    if (player) throw new Error("У этого аккаунта уже есть персонаж.");
    if (
      typeof args[0] !== "string" ||
      args[0].trim().length < 1 ||
      args[0].length > 32 ||
      !Object.hasOwn(CLASSES, args[1])
    )
      throw new Error("Проверьте имя и класс.");
    return [args[0], args[1], true];
  }
  if (!player && command !== "_tick") throw new Error("Персонаж не создан.");
  if (command.startsWith("admin") && !engine.admin)
    throw new Error("Недостаточно прав.");
  if (itemCommands.has(command)) {
    const item = (
      command === "upgradeItem"
        ? [...player!.inventory, ...Object.values(player!.equipped)]
        : player!.inventory
    ).find((i) => i?.id === args[0]?.id);
    if (!item) throw new Error("Предмет отсутствует в серверном инвентаре.");
    args = [item, ...args.slice(1)];
  } else if (command === "startBattleWithMonster") {
    if (
      (engine.model.isInCombat && !engine.model.isCombatEnded) ||
      engine.model.travelState.isTraveling ||
      engine.model.activeDungeonRun
    )
      throw new Error("Сначала завершите текущее действие.");
    const region = REGIONS.find((r) => r.id === player!.currentRegionId)!;
    const id = args[0]?.id;
    if (!region?.monsters.includes(id) || !MONSTERS[id])
      throw new Error("Монстр недоступен в текущей локации.");
    return [
      getRegionMonster(MONSTERS[id], region),
      { chain: args[1]?.chain !== false },
    ];
  } else if (command === "challengeArena") {
    const opponent = arenaOpponents(player!.level).find(
      (o) => o.id === args[0]?.id,
    );
    if (!opponent) throw new Error("Гладиатор не найден.");
    return [opponent];
  } else if (
    command === "allocateAttribute" &&
    !Object.hasOwn(player!.attributes, args[0])
  )
    throw new Error("Атрибут не найден.");
  else if (
    command === "performPlayerAction" &&
    !["attack", "skill", "defend", "potion", "flee"].includes(args[0])
  )
    throw new Error("Недопустимый ход.");
  else if (
    command === "meditateOrRefillEnergy" &&
    !["meditate", "silver", "potion"].includes(args[0])
  )
    throw new Error("Недопустимое восстановление.");
  else if (command === "startMiningExpedition" && ![1, 3, 7].includes(args[0]))
    throw new Error("Недопустимая длительность.");
  else if (command === "buyBasicConsumable") {
    if (!["pot_hp_small", "pot_mp_small"].includes(args[0]))
      throw new Error("Товар не найден.");
    return [args[0], args[0] === "pot_hp_small" ? 35 : 40];
  } else if (
    command === "setAdventureStoryStep" &&
    (!Number.isInteger(args[0]) || args[0] < 0 || args[0] > 20)
  )
    throw new Error("Недопустимый шаг истории.");
  else if (command === "updateAutoBattleSettings") {
    const settings = args[0];
    if (
      !settings ||
      Object.keys(settings).some(
        (k) =>
          ![
            "healAtHpPercent",
            "useSkills",
            "useUltimate",
            "fleeAtHpPercent",
            "autoRebattle",
            "maxBattles",
          ].includes(k),
      ) ||
      Object.entries(settings).some(([k, v]) =>
        k.startsWith("use") || k === "autoRebattle"
          ? typeof v !== "boolean"
          : !Number.isInteger(v) || (v as number) < 0 || (v as number) > 100,
      )
    )
      throw new Error("Недопустимые настройки боя.");
  } else if (command === "createClan") {
    const d = args[0];
    if (
      !d ||
      typeof d.name !== "string" ||
      typeof d.tag !== "string" ||
      typeof d.description !== "string"
    )
      throw new Error("Некорректный клан.");
    args = [{ name: d.name, tag: d.tag, description: d.description }];
  } else if (command === "bulkDisposeItems") {
    if (!args[0] || !["sell", "disassemble"].includes(args[1]))
      throw new Error("Некорректная обработка.");
  } else if (
    !itemCommands.has(command) &&
    command !== "updateAutoBattleSettings" &&
    command !== "createClan" &&
    args.some((v) => !scalar(v))
  )
    throw new Error(
      "Команда принимает только идентификаторы, не состояние персонажа.",
    );
  if (command === "adminAddGold" || command === "adminAddSilver")
    if (!Number.isSafeInteger(args[0]) || args[0] < 0 || args[0] > 1e8)
      throw new Error("Некорректное количество.");
  return args;
}
