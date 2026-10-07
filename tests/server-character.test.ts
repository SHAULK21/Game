import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { CharacterStore, CharacterError } from "../server/characterStore";
import { GameEngine } from "../server/gameEngine";
import { validateCommand } from "../server/characterCommands";
import { resetPlayerAccount } from "../server/accountReset";
import type { EngineSave } from "../server/gameEngine";
const id = () => crypto.randomUUID();
async function setup() {
  const db = new PGlite();
  await db.exec(
    (await fs.readFile("server/schema.sql", "utf8")).replace(
      "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
      "",
    ),
  );
  const query = (sql: string, args: any[] = []) => db.query<any>(sql, args);
  const pool: any = { query, connect: async () => ({ query, release() {} }) };
  await query("INSERT INTO players(telegram_id) VALUES(1),(2),(3)");
  await query(
    "INSERT INTO character_saves(telegram_id,reset_version,migration_until) VALUES(1,0,NOW()+INTERVAL '30 days'),(2,0,NOW()+INTERVAL '30 days')",
  );
  const api: any = async (
    _client: any,
    userId: number,
    _reset: number,
    path: string,
  ) => {
    if (path === "/api/items/owned")
      return {
        items: (
          await query("SELECT * FROM owned_items WHERE owner_telegram_id=$1", [
            userId,
          ])
        ).rows,
      };
    if (path === "/api/market/income") return { balanceGold: 120 };
    throw Error("Unexpected API " + path);
  };
  const store = new CharacterStore(pool, api, "1");
  return { db, query, pool, store };
}
async function writer(store: CharacterStore, userId = 1) {
  const read = await store.read(userId);
  const sessionId = id();
  const claimed = await store.claim(userId, {
    sessionId,
    expectedVersion: read.version,
    expectedGeneration: read.sessionGeneration,
  });
  const body = (
    command: string,
    args: any[] = [],
    version = claimed.version,
  ) => ({
    sessionId,
    sessionGeneration: claimed.sessionGeneration,
    expectedVersion: version,
    operationId: id(),
    command,
    args,
  });
  return { sessionId, claimed, body };
}
function legacy(userId = 1) {
  const engine = new GameEngine(userId, 0, null, async () => ({}) as any);
  return engine
    .command("createCharacter", ["Локальный", "warrior", false])
    .then(() => ({
      resetVersion: 0,
      player: engine.model.player,
      quests: engine.model.quests,
      achievements: engine.model.achievements,
    }));
}

test("two devices share one character; explicit takeover revokes old writer and prevents rollback", async () => {
  const { db, store } = await setup();
  try {
    const pc = await writer(store);
    const created = await store.execute(
      1,
      0,
      pc.body("createCharacter", ["Один", "warrior", true]),
    );
    assert.equal(created.state.player!.name, "Один");
    const phone = await store.read(1);
    assert.deepEqual(phone.state.player, created.state.player);
    await assert.rejects(
      () =>
        store.claim(1, {
          sessionId: id(),
          expectedVersion: phone.version,
          expectedGeneration: phone.sessionGeneration,
        }),
      (e) => e instanceof CharacterError && e.code === "SESSION_ACTIVE",
    );
    const phoneId = id();
    const moved = await store.claim(1, {
      sessionId: phoneId,
      takeover: true,
      expectedVersion: phone.version,
      expectedGeneration: phone.sessionGeneration,
    });
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          pc.body("allocateAttribute", ["strength"], created.version),
        ),
      (e) => e instanceof CharacterError && e.code === "SESSION_REVOKED",
    );
    const changed = await store.execute(1, 0, {
      sessionId: phoneId,
      sessionGeneration: moved.sessionGeneration,
      expectedVersion: moved.version,
      operationId: id(),
      command: "allocateAttribute",
      args: ["strength"],
    });
    const reloaded = await store.read(1, pc.sessionId);
    assert.equal(
      reloaded.state.player!.attributes.strength,
      changed.state.player!.attributes.strength,
    );
    assert.equal(reloaded.ownsSession, false);
    assert.equal((await store.read(2)).state.player, null);
  } finally {
    await db.close();
  }
});

test("lost responses and repeated purchases are idempotent; stale versions cannot spend or overwrite", async () => {
  const { db, store, query } = await setup();
  try {
    const pc = await writer(store);
    const created = await store.execute(
      1,
      0,
      pc.body("createCharacter", ["Один", "warrior", false]),
    );
    const buy = pc.body(
      "buyBasicConsumable",
      ["pot_hp_small", 0],
      created.version,
    );
    const first = await store.execute(1, 0, buy);
    const retry = await store.execute(1, 0, JSON.parse(JSON.stringify(buy)));
    assert.equal(retry.replayed, true);
    assert.equal(retry.state.player!.gold, first.state.player!.gold);
    assert.deepEqual(
      retry.state.player!.inventory,
      first.state.player!.inventory,
    );
    assert.equal(first.state.player!.gold, 85);
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          pc.body("buyBasicConsumable", ["pot_hp_small", 0], created.version),
        ),
      (e) => e instanceof CharacterError && e.code === "VERSION_CONFLICT",
    );
    assert.equal(
      (await query("SELECT count(*)::int AS n FROM character_operations"))
        .rows[0].n,
      2,
    );
    const other = { ...buy, args: ["pot_mp_small", 0] };
    await assert.rejects(
      () => store.execute(1, 0, other),
      (e) => e instanceof CharacterError && e.code === "OPERATION_CONFLICT",
    );
  } finally {
    await db.close();
  }
});

test("migration makes backups, replaces only explicitly, never adds balances or duplicates owned_items, closes after explicit conflict resolution", async () => {
  const { db, store, query } = await setup();
  try {
    const pc = await writer(store);
    const raw = await legacy();
    const owned = raw.player!.inventory[0];
    const row = (
      await query(
        "INSERT INTO owned_items(owner_telegram_id,item_json,origin) VALUES(1,$1::jsonb,'clan_raid') RETURNING id",
        [JSON.stringify(owned)],
      )
    ).rows[0];
    raw.player!.inventory.push({ ...owned, id: row.id, serverOwned: true });
    const body = { ...pc.body("", []), save: raw };
    const migrated = await store.execute(1, 0, body, true);
    assert.equal(migrated.state.player!.gold, 120);
    assert.equal(
      migrated.state.player!.inventory.filter((i: any) => i.id === row.id)
        .length,
      1,
    );
    const state = (
      await query("SELECT state_json FROM character_saves WHERE telegram_id=1")
    ).rows[0].state_json as EngineSave;
    assert(!state.state.player.inventory.some((i: any) => i.id === row.id));
    const different = await legacy();
    different.player!.id = "phone_hero";
    different.player!.gold = 1000;
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          { ...pc.body("", [], migrated.version), save: different },
          true,
        ),
      (e) => e instanceof CharacterError && e.code === "CHARACTER_CONFLICT",
    );
    const chosen = await store.execute(
      1,
      0,
      {
        ...pc.body("", [], migrated.version),
        save: different,
        replace: true,
        confirmCharacterId: "phone_hero",
      },
      true,
    );
    assert.equal(chosen.state.player!.gold, 1000);
    assert.equal(
      (await query("SELECT count(*)::int AS n FROM character_backups")).rows[0]
        .n,
      3,
    );
    await store.execute(
      1,
      0,
      pc.body("allocateAttribute", ["strength"], chosen.version),
    );
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          { ...pc.body("", [], chosen.version + 1), save: raw },
          true,
        ),
      (e) => e instanceof CharacterError && e.code === "MIGRATION_CLOSED",
    );
  } finally {
    await db.close();
  }
});

test("migration rejects foreign owner, invalid values and pre-reset data; reset revokes state and sessions atomically", async () => {
  const { db, store, pool, query } = await setup();
  try {
    const pc = await writer(store);
    const raw = await legacy();
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          {
            ...pc.body("", []),
            save: { ...raw, player: { ...raw.player, userId: "2" } },
          },
          true,
        ),
      /другому/,
    );
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          {
            ...pc.body("", []),
            save: { ...raw, player: { ...raw.player, gold: -1 } },
          },
          true,
        ),
      /gold/,
    );
    const created = await store.execute(
      1,
      0,
      pc.body("createCharacter", ["Новый", "warrior"]),
    );
    await resetPlayerAccount(pool, 3, 1, id(), 0);
    const fresh = await store.read(1);
    assert.equal(fresh.resetVersion, 1);
    assert.equal(fresh.state.player, null);
    assert.equal(fresh.migrationAllowed, false);
    await assert.rejects(
      () =>
        store.execute(
          1,
          0,
          pc.body("allocateAttribute", ["strength"], created.version),
        ),
      (e) => e instanceof CharacterError && e.code === "ACCOUNT_RESET",
    );
    assert.equal(
      (
        await query(
          "SELECT state_json FROM character_saves WHERE telegram_id=1",
        )
      ).rows[0].state_json,
      null,
    );
  } finally {
    await db.close();
  }
});

test("server combat state survives process restart without replenishing HP/MP/potions or replaying a reward", async () => {
  const engine = new GameEngine(1, 0, null, async () => ({}) as any);
  await engine.command("createCharacter", ["Воин", "warrior", true]);
  await engine.command("performPlayerAction", ["attack"]);
  const before = engine.view();
  const restored = new GameEngine(
    1,
    0,
    engine.export(),
    async () => ({}) as any,
  );
  const after = restored.view();
  assert.equal(after.combatPlayerHp, before.combatPlayerHp);
  assert.equal(after.combatPlayerMp, before.combatPlayerMp);
  assert.equal(after.activeMonster!.hp, before.activeMonster!.hp);
  assert.equal(after.player!.energy, before.player!.energy);
  assert.deepEqual(after.player!.inventory, before.player!.inventory);
  assert.deepEqual(after.usedPotionKinds, before.usedPotionKinds);
  assert.deepEqual(after.lastCombatReward, before.lastCombatReward);
});

test("commands resolve canonical items, prices and monsters, and reject arbitrary state uploads", async () => {
  const e = new GameEngine(1, 0, null, async () => ({}) as any);
  await e.command("createCharacter", ["Воин", "warrior", false]);
  assert.throws(
    () => validateCommand(e, "save", [{ player: { gold: 1e9 } }]),
    /Недопустимая/,
  );
  assert.throws(
    () =>
      validateCommand(e, "startBattleWithMonster", [
        { id: "fabricated", hp: 1, expReward: 1e9 },
      ]),
    /Монстр/,
  );
  const item = e.model.player!.inventory[0];
  assert.equal(
    validateCommand(e, "sellItem", [{ ...item, sellPrice: 1e9 }])[0].sellPrice,
    item.sellPrice,
  );
  assert.deepEqual(
    validateCommand(e, "buyBasicConsumable", ["pot_hp_small", 0]),
    ["pot_hp_small", 35],
  );
});

test("travel deadline and chosen ambush survive a new engine; arrival cannot refund energy or repeat quest progress", async () => {
  const now = Date.now(),
    api: any = async () => ({});
  const engine = new GameEngine(1, 0, null, api, false, now);
  await engine.command("createCharacter", ["Путник", "warrior", false]);
  const before = engine.model.player!.energy;
  await engine.command("startTravel", ["reg_plains", "mod_standard"]);
  assert(engine.model.travelState.isTraveling);
  const departure = engine.export();
  assert(departure.state.serverJourney);
  const charged = engine.model.player!.energy;
  assert(charged < before);
  const restored = new GameEngine(1, 0, departure, api, false, now + 4000);
  assert.equal(restored.model.player!.energy, charged);
  await restored.tick();
  assert.equal(restored.model.travelState.isTraveling, false);
  assert.equal(restored.model.player!.energy, charged);
  const progress = restored.model.quests.find(
    (q) => q.id === "q_royal_first_journey",
  )!.currentCount;
  const repeated = new GameEngine(
    1,
    0,
    restored.export(),
    api,
    false,
    now + 5000,
  );
  await repeated.tick();
  assert.equal(
    repeated.model.quests.find((q) => q.id === "q_royal_first_journey")!
      .currentCount,
    progress,
  );
  assert.equal(repeated.model.player!.gold, engine.model.player!.gold);
});

test("legacy unfinished dungeon migrates the hero without granting room rewards or returning spent energy", async () => {
  const { validateLegacySave } = await import("../server/characterValidation");
  const raw: any = await legacy();
  raw.activeDungeonRun = {
    id: "old-run",
    dungeonId: "fake",
    completed: false,
    rooms: [{ resolved: false, monster: { id: "fake", expReward: 1e9 } }],
  };
  const safe = validateLegacySave(raw, 1, 0);
  assert.equal(safe.activeDungeonRun, null);
  assert.equal(safe.player.gold, raw.player.gold);
  assert.equal(safe.player.energy, raw.player.energy);
  assert(safe.player.flightPenalty);
  assert.equal(raw.activeDungeonRun.completed, false);
});

test("parallel requests based on one version commit one change and reject the stale writer", async () => {
  const { db, store, pool } = await setup();
  // PGlite has one connection. Match a pg Pool(max:1), holding it through COMMIT.
  let tail = Promise.resolve();
  pool.connect = async () => {
    const preceding = tail;
    let unlock!: () => void;
    tail = new Promise<void>((r) => (unlock = r));
    await preceding;
    return { query: pool.query, release: unlock };
  };
  try {
    const pc = await writer(store);
    const created = await store.execute(
      1,
      0,
      pc.body("createCharacter", ["Конкуренция", "warrior"]),
    );
    const requests = [
      pc.body("buyBasicConsumable", ["pot_hp_small", 0], created.version),
      pc.body("buyBasicConsumable", ["pot_mp_small", 0], created.version),
    ];
    const results = await Promise.allSettled(
      requests.map((b) => store.execute(1, 0, b)),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    assert.equal(rejected.reason.code, "VERSION_CONFLICT");
    const current = await store.read(1, pc.sessionId);
    assert.equal(current.version, created.version + 1);
    assert.equal(current.state.player!.gold, 85);
  } finally {
    await db.close();
  }
});
