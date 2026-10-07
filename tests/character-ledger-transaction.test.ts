import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { CharacterStore } from "../server/characterStore";
import { registerPlayerItems } from "../server/playerItems";
import { internalGameApi } from "../server/internalGameApi";
import { transactionAwarePool } from "../server/transactionScope";
import { GameEngine } from "../server/gameEngine";

test("real item handlers join the character transaction: disposal and reward commit once; a failure rolls both back", async () => {
  const db = new PGlite();
  const query = (sql: string, args: any[] = []) => db.query<any>(sql, args);
  const raw: any = { query, connect: async () => ({ query, release() {} }) };
  try {
    await db.exec(
      (await fs.readFile("server/schema.sql", "utf8")).replace(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        "",
      ),
    );
    await query("INSERT INTO players(telegram_id) VALUES(1)");
    const app = express(),
      pool = transactionAwarePool(() => raw),
      auth: any = (_req: any, _res: any, next: any) => next();
    registerPlayerItems(app, pool, auth);
    const dispatch = internalGameApi(app);
    const store = new CharacterStore(raw, dispatch);
    const read = await store.read(1),
      sessionId = crypto.randomUUID();
    const lease = await store.claim(1, {
      sessionId,
      expectedVersion: read.version,
      expectedGeneration: read.sessionGeneration,
    });
    const body = (command: string, args: any[], version: number) => ({
      command,
      args,
      sessionId,
      sessionGeneration: lease.sessionGeneration,
      expectedVersion: version,
      operationId: crypto.randomUUID(),
    });
    const created = await store.execute(
      1,
      0,
      body("createCharacter", ["One", "warrior"], 0),
    );
    const canonical = {
      id: "old",
      name: "Server ore",
      templateId: "iron",
      type: "ore",
      rarity: "common",
      level: 1,
      upgradeLevel: 0,
      stats: {},
      sellPrice: 15,
      disassembleYield: {},
      icon: "ore",
    };
    const minted = (
      await query(
        "INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(1,$1::jsonb,2,'test') RETURNING id",
        [JSON.stringify(canonical)],
      )
    ).rows[0];
    const request = body(
      "sellItem",
      [{ id: minted.id, sellPrice: 99999 }],
      created.version,
    );
    const sold = await store.execute(1, 0, request);
    assert.equal(sold.state.player.gold, 150);
    assert.equal(
      (await query("SELECT count(*)::int AS n FROM owned_items")).rows[0].n,
      0,
    );
    const replay = await store.execute(1, 0, request);
    assert.equal(replay.state.player.gold, 150);
    const second = (
      await query(
        "INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(1,$1::jsonb,1,'test') RETURNING id",
        [JSON.stringify(canonical)],
      )
    ).rows[0];
    let injectFailure = true;
    const failingApi: any = async (...args: any[]) => {
      const result = await (dispatch as any)(...args);
      if (injectFailure && String(args[3]).endsWith("/dispose"))
        throw Error("simulated crash before save");
      return result;
    };
    const failStore = new CharacterStore(raw, failingApi);
    const broken = body("sellItem", [{ id: second.id }], sold.version);
    await assert.rejects(
      () => failStore.execute(1, 0, broken),
      /simulated crash/,
    );
    assert.equal(
      (await query("SELECT count(*)::int AS n FROM owned_items")).rows[0].n,
      1,
    );
    assert.equal((await store.read(1)).state.player.gold, 150);
    injectFailure = false;
    const retried = await failStore.execute(1, 0, broken);
    assert.equal(retried.state.player.gold, 165);
    assert.equal(
      (await query("SELECT count(*)::int AS n FROM owned_items")).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("a canonical material used by a shared recipe is consumed in owned_items, never duplicated by JSON hydration", async () => {
  const db = new PGlite();
  const query = (sql: string, args: any[] = []) => db.query<any>(sql, args);
  const raw: any = { query, connect: async () => ({ query, release() {} }) };
  try {
    await db.exec(
      (await fs.readFile("server/schema.sql", "utf8")).replace(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        "",
      ),
    );
    await query("INSERT INTO players(telegram_id) VALUES(1)");
    const app = express();
    registerPlayerItems(
      app,
      transactionAwarePool(() => raw),
      ((_req: any, _res: any, next: any) => next()) as any,
    );
    const store = new CharacterStore(raw, internalGameApi(app));
    const read = await store.read(1),
      sessionId = crypto.randomUUID();
    const lease = await store.claim(1, {
      sessionId,
      expectedVersion: 0,
      expectedGeneration: 0,
    });
    const command = (name: string, args: any[], version: number) => ({
      command: name,
      args,
      expectedVersion: version,
      sessionId,
      sessionGeneration: lease.sessionGeneration,
      operationId: crypto.randomUUID(),
    });
    let result = await store.execute(
      1,
      0,
      command("createCharacter", ["One", "warrior"], read.version),
    );
    // A restored server encounter retains potion consumption in the canonical registry.
    const pot = {
      id: "old",
      templateId: "pot_hp_small",
      name: "Heal",
      type: "potion",
      rarity: "common",
      level: 1,
      upgradeLevel: 0,
      icon: "potion",
      stats: { heal: 120 },
      sellPrice: 10,
      disassembleYield: {},
    };
    const minted = (
      await query(
        "INSERT INTO owned_items(owner_telegram_id,item_json,quantity,origin) VALUES(1,$1::jsonb,2,'test') RETURNING id",
        [JSON.stringify(pot)],
      )
    ).rows[0];
    const saved = (
      await query("SELECT state_json FROM character_saves WHERE telegram_id=1")
    ).rows[0].state_json;
    const engine = new GameEngine(1, 0, saved, async () => ({}) as any);
    engine.data.state.combatPlayerHp = 1;
    await query(
      "UPDATE character_saves SET state_json=$1::jsonb WHERE telegram_id=1",
      [JSON.stringify(engine.export())],
    );
    result = await store.execute(
      1,
      0,
      command("performPlayerAction", ["potion", minted.id], result.version),
    );
    assert.equal(
      (await query("SELECT quantity FROM owned_items WHERE id=$1", [minted.id]))
        .rows[0].quantity,
      1,
    );
    assert.equal(
      result.state.player.inventory.filter((i: any) => i.id === minted.id)
        .length,
      1,
    );
    const stored = (
      await query("SELECT state_json FROM character_saves WHERE telegram_id=1")
    ).rows[0].state_json;
    assert(!stored.state.player.inventory.some((i: any) => i.id === minted.id));
  } finally {
    await db.close();
  }
});
