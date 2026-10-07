import { recordFlight } from "../src/utils/flightPenalty";
import {
  CLASSES,
  INITIAL_QUESTS,
  INITIAL_ACHIEVEMENTS,
} from "../src/data/gameData";
import type { EngineSave } from "./gameEngine";
const fail = (message: string): never => {
  throw new Error(message);
};
const walk = (value: any, depth = 0) => {
  if (depth > 24) fail("Сохранение слишком сложное.");
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
  )
    fail("Некорректное число в сохранении.");
  if (typeof value === "string" && value.length > 20000)
    fail("Слишком длинное поле сохранения.");
  if (Array.isArray(value) && value.length > 3000)
    fail("Слишком большой список в сохранении.");
  if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        fail("Недопустимое поле.");
      walk(child, depth + 1);
    }
};
const amount = (value: any, max: number) =>
  Number.isSafeInteger(value) && value >= 0 && value <= max;
export function validateLegacySave(
  raw: any,
  userId: number,
  resetVersion: number,
) {
  if (!raw || typeof raw !== "object" || !raw.player)
    fail("Персонаж отсутствует.");
  if (Buffer.byteLength(JSON.stringify(raw)) > 512000)
    fail("Сохранение превышает допустимый размер.");
  walk(raw);
  if (String(raw.player.userId) !== String(userId))
    fail("Сохранение принадлежит другому Telegram-аккаунту.");
  // Epoch-less legacy saves are valid only before the FIRST admin reset.
  if ((raw.resetVersion ?? 0) !== resetVersion)
    fail("Сохранение создано до административного сброса.");
  if (raw.cloud) fail("Это серверный кеш, а не старое локальное сохранение.");
  raw = JSON.parse(JSON.stringify(raw));
  const p = raw.player;
  if (
    p.silver === undefined &&
    (p.shards !== undefined || p.crystals !== undefined)
  ) {
    if (!amount(p.shards ?? 0, 10000000) || !amount(p.crystals ?? 0, 10000000))
      fail("Недопустимая старая валюта.");
    p.silver = 0;
  }
  if (
    !Object.hasOwn(CLASSES, p.classId) ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 64
  )
    fail("Некорректный персонаж.");
  for (const [key, max] of Object.entries({
    level: 10000,
    gold: 2147483647,
    silver: 2147483647,
    exp: 1e10,
    statPoints: 100000,
    talentPoints: 100000,
    miningLevel: 10000,
    alchemyLevel: 10000,
    maxInventorySlots: 1000,
  }))
    if (!amount(p[key], max) || (key === "level" && p[key] < 1))
      fail("Недопустимое значение: " + key);
  if (
    !p.attributes ||
    !p.equipped ||
    !Array.isArray(p.inventory) ||
    p.inventory.length > 1000 ||
    !Array.isArray(p.skills) ||
    !Array.isArray(p.talents)
  )
    fail("Повреждена структура персонажа.");
  for (const v of Object.values(p.attributes))
    if (!amount(v, 100000)) fail("Недопустимый атрибут.");
  for (const key of [
    "energy",
    "maxEnergy",
    "stamina",
    "maxStamina",
    "alchemyEnergy",
    "maxAlchemyEnergy",
  ])
    if (p[key] !== undefined && !amount(p[key], 100000))
      fail("Недопустимый ресурс: " + key);
  for (const [current, max] of [
    ["energy", "maxEnergy"],
    ["stamina", "maxStamina"],
    ["alchemyEnergy", "maxAlchemyEnergy"],
  ])
    if (p[current] !== undefined && p[max] !== undefined && p[current] > p[max])
      fail("Ресурс превышает максимум: " + current);
  const ids = new Set<string>();
  for (const item of [
    ...p.inventory,
    ...Object.values(p.equipped).filter(Boolean),
  ] as any[]) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      ![
        "weapon",
        "armor",
        "helmet",
        "boots",
        "gloves",
        "ring",
        "amulet",
        "offhand",
        "pants",
        "belt",
        "cloak",
        "pet",
        "artifact",
        "alchemyTool",
        "potion",
        "material",
        "ore",
        "pickaxe",
      ].includes(item.type) ||
      !amount(item.level, 10000) ||
      !amount(item.upgradeLevel, 100) ||
      !amount(item.stackCount ?? 1, 1000000)
    )
      fail("Некорректный предмет.");
    if (ids.has(item.id)) fail("Повторяющийся ID предмета.");
    ids.add(item.id);
  }
  for (const [key, catalog] of [
    ["quests", INITIAL_QUESTS],
    ["achievements", INITIAL_ACHIEVEMENTS],
  ] as const) {
    if (
      raw[key] !== undefined &&
      (!Array.isArray(raw[key]) ||
        raw[key].some((entry: any) => !catalog.some((c) => c.id === entry.id)))
    )
      fail("Некорректный список: " + key);
  }
  const safe = JSON.parse(JSON.stringify(raw));
  for (const [key, catalog] of [
    ["quests", INITIAL_QUESTS],
    ["achievements", INITIAL_ACHIEVEMENTS],
  ] as const)
    if (safe[key])
      safe[key] = safe[key].map((entry: any) => {
        const definition: any = catalog.find((c) => c.id === entry.id)!;
        const countKey = key === "quests" ? "currentCount" : "progress";
        const maxKey = key === "quests" ? "targetCount" : "maxProgress";
        if (
          !amount(entry[countKey], 10000000) ||
          typeof entry.completed !== "boolean" ||
          (entry.claimed !== undefined && typeof entry.claimed !== "boolean")
        )
          fail("Недопустимый прогресс: " + key);
        return {
          ...definition,
          [countKey]: Math.min(entry[countKey], definition[maxKey]),
          completed: entry.completed,
          claimed: entry.claimed === true,
        };
      });
  if (safe.player.adventureJournal?.pending?.encounter)
    delete safe.player.adventureJournal.pending.encounter;
  if (safe.activeDungeonRun && !safe.activeDungeonRun.completed) {
    safe.activeDungeonRun = null;
    safe.player = recordFlight(safe.player);
  }
  return safe;
}
export function stripLedgerItems(save: EngineSave) {
  const p = save.state.player;
  if (!p) return save;
  p.inventory = p.inventory.filter((i: any) => !i.serverOwned);
  for (const [slot, item] of Object.entries(p.equipped) as any)
    if (item?.serverOwned) delete p.equipped[slot];
  // Device diagnostics and retry records are never a second durable game state.
  save.storage = {};
  delete save.refs.saveSnapshot;
  return save;
}
