import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { registerCharacterStore } from "../server/characterStore";
import { validateTelegramInitData } from "../server/telegramAuth";
const token = "123:test-token";
const signed = (userId: number) => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "Player" }),
  });
  const check = [...params]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + "=" + v)
    .join("\n");
  const secret = crypto
    .createHmac("sha256", "WebAppData")
    .update(token)
    .digest();
  params.set(
    "hash",
    crypto.createHmac("sha256", secret).update(check).digest("hex"),
  );
  return params.toString();
};
const bundle = build({
  stdin: {
    contents: `import React,{act}from'react';import{createRoot}from'react-dom/client';import{GameProvider,useGame}from'./src/context/GameContext';function Probe(){window.game=useGame();return <div data-hero>{window.game.player?.name||'absent'}</div>;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  define: {
    "process.env.NODE_ENV": '"development"',
    "import.meta.env.VITE_ADMIN_TELEGRAM_ID": '""',
  },
});
async function system() {
  const db = new PGlite();
  await db.exec(
    (await fs.readFile("server/schema.sql", "utf8")).replace(
      "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
      "",
    ),
  );
  const query = (sql: string, args: any[] = []) => db.query<any>(sql, args);
  const pool: any = { query, connect: async () => ({ query, release() {} }) };
  const app = express();
  app.use(express.json({ limit: "600kb" }));
  const auth: any = async (req: any, res: any, next: any) => {
    try {
      req.authUser = validateTelegramInitData(
        req.get("X-Telegram-Init-Data") || "",
        token,
      );
      await query(
        "INSERT INTO players(telegram_id) VALUES($1) ON CONFLICT DO NOTHING",
        [req.authUser.id],
      );
      next();
    } catch (e) {
      res.status(401).json({ error: String(e) });
    }
  };
  registerCharacterStore(
    app,
    () => pool,
    auth,
    async () => ({}) as any,
  );
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: String(error) }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as any;
  return {
    db,
    query,
    base: "http://127.0.0.1:" + address.port,
    close: async () => {
      await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
      await db.close();
    },
  };
}
async function device(base: string, userId = 1, cache?: string) {
  const dom = new JSDOM('<div id="root"></div>', {
      url: base,
      runScripts: "outside-only",
    }),
    w: any = dom.window;
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.Headers = Headers;
  w.AbortSignal = AbortSignal;
  w.MessageChannel = class {
    port1 = { onmessage: null as any };
    port2 = {
      postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0),
    };
  };
  w.Telegram = {
    WebApp: {
      initData: signed(userId),
      initDataUnsafe: { user: { id: userId, first_name: "Player" } },
    },
  };
  if (cache) w.localStorage.setItem("aethelgard_save_v1_data_" + userId, cache);
  let offline = false,
    loseResponse = false;
  let holdRead: ((response: Response) => Promise<Response>) | null = null;
  const requests: any[] = [];
  w.fetch = async (path: string, options: any) => {
    requests.push({ path, body: options.body });
    if (offline) throw Error("offline");
    const response = await fetch(new URL(path, base), options);
    if (
      loseResponse &&
      ["/api/game/commands", "/api/game/migrate"].includes(path)
    ) {
      loseResponse = false;
      await response.text();
      throw Error("lost response");
    }
    if (path === "/api/game" && holdRead) {
      const hold = holdRead;
      holdRead = null;
      return hold(response);
    }
    return response;
  };
  w.eval((await bundle).outputFiles[0].text);
  await w.act(async () => w.mount());
  const settle = async () => {
    await w.act(async () => await new Promise((r) => setTimeout(r, 80)));
  };
  for (
    let i = 0;
    i < 30 &&
    !w.game &&
    !w.document.body.textContent.includes("Выберите персонажа для переноса");
    i++
  )
    await settle();
  return {
    w,
    dom,
    requests,
    settle,
    setOffline: (v: boolean) => {
      offline = v;
    },
    holdNextRead: () => {
      let release!: () => void, reached!: () => void;
      const blocked = new Promise<void>((r) => (release = r));
      const started = new Promise<void>((r) => (reached = r));
      holdRead = async (response) => {
        const body = await response.text();
        reached();
        await blocked;
        return new Response(body, {
          status: response.status,
          headers: response.headers,
        });
      };
      return { release, started };
    },
    loseNextResponse: () => {
      loseResponse = true;
    },
    close: async () => {
      await w.act(async () => w.root.unmount());
      dom.window.close();
    },
  };
}
const click = async (d: any, label: string) => {
  const button = [...d.w.document.querySelectorAll("button")].find(
    (b: any) => b.textContent.trim() === label,
  ) as any;
  assert(button, "Missing " + label);
  await d.w.act(async () => button.click());
  await d.settle();
};

test("real provider and signed HTTP API: PC creation appears on phone; transfer revokes PC; lost response survives document restart once", async () => {
  const s = await system();
  const pc = await device(s.base);
  let phone: any;
  try {
    assert.equal(pc.w.game.player, null);
    await pc.w.act(async () =>
      pc.w.game.createCharacter("Общий", "warrior", true),
    );
    const confirmed = JSON.parse(
      pc.w.localStorage.getItem("aethelgard_save_v1_data_1"),
    );
    assert.equal(confirmed.player.name, "Общий");
    phone = await device(s.base);
    assert.equal(phone.w.game.player.name, "Общий");
    assert.match(
      phone.w.document.body.textContent,
      /Играть на этом устройстве/,
    );
    assert(phone.w.document.querySelector("[inert]"));
    await click(phone, "Играть на этом устройстве");
    await phone.w.act(async () => phone.w.game.allocateAttribute("strength"));
    await phone.settle();
    const strength = phone.w.game.player.attributes.strength;
    await pc.w.act(async () => pc.w.game.allocateAttribute("strength"));
    await pc.settle();
    assert.match(pc.w.document.body.textContent, /перенесена/);
    assert.equal(pc.w.game.player.attributes.strength, strength);
    phone.loseNextResponse();
    await phone.w.act(async () =>
      phone.w.game.buyBasicConsumable("pot_hp_small", 0),
    );
    assert.match(phone.w.document.body.textContent, /Нет подтверждения/);
    const afterLoss = (
      await s.query(
        "SELECT state_json FROM character_saves WHERE telegram_id=1",
      )
    ).rows[0].state_json.state.player;
    assert.equal(afterLoss.gold, 85);
    const pending = phone.w.localStorage.getItem("aethelgard_cloud_pending_1");
    assert(pending);
    await phone.w.act(async () => phone.w.root.unmount());
    await phone.w.act(async () => phone.w.mount());
    await phone.settle();
    assert.equal(phone.w.game.player.gold, 85);
    assert.equal(
      phone.w.localStorage.getItem("aethelgard_cloud_pending_1"),
      null,
    );
    const retries = phone.requests
      .filter(
        (r: any) =>
          r.path === "/api/game/commands" &&
          JSON.parse(r.body).command === "buyBasicConsumable",
      )
      .map((r: any) => JSON.parse(r.body).operationId);
    assert.equal(retries.length, 2);
    assert.equal(retries[0], retries[1]);
  } finally {
    await pc.close();
    if (phone) await phone.close();
    await s.close();
  }
});

test("network failure never offers registration before absence confirmation; different Telegram account cannot use another account cache or body ID", async () => {
  const s = await system();
  const pc = await device(s.base);
  let other: any;
  try {
    await pc.w.act(async () => pc.w.game.createCharacter("Первый", "warrior"));
    const cache = pc.w.localStorage.getItem("aethelgard_save_v1_data_1");
    other = await device(s.base, 2, cache);
    assert.equal(other.w.game.player, null);
    assert.equal(
      other.w.document.querySelector("[data-hero]").textContent,
      "absent",
    );
    const response = await fetch(s.base + "/api/game/commands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": signed(2),
        "X-Game-Reset-Version": "0",
      },
      body: JSON.stringify({
        userId: 1,
        operationId: crypto.randomUUID(),
        sessionId: "00000000-0000-4000-8000-000000000000",
        sessionGeneration: 1,
        expectedVersion: 1,
        command: "allocateAttribute",
        args: ["strength"],
      }),
    });
    assert.equal(response.status, 409);
    assert.equal(
      (
        await s.query(
          "SELECT count(*)::int AS n FROM character_saves WHERE state_json IS NOT NULL",
        )
      ).rows[0].n,
      1,
    );
    pc.setOffline(true);
    await pc.w.act(async () => pc.w.game.buyBasicConsumable("pot_hp_small", 0));
    assert.equal(pc.w.game.player.gold, 120);
    assert.match(pc.w.document.body.textContent, /Нет подтверждения/);
    const before = pc.w.localStorage.getItem("aethelgard_save_v1_data_1");
    await pc.w.act(async () => pc.w.root.unmount());
    await pc.w.act(async () => pc.w.mount());
    await pc.settle();
    assert.equal(pc.w.document.querySelector("[data-hero]"), null);
    assert.equal(
      pc.w.localStorage.getItem("aethelgard_save_v1_data_1"),
      before,
    );
    pc.setOffline(false);
    await click(pc, "Повторить");
    assert.equal(pc.w.game.player.gold, 85);
  } finally {
    await pc.close();
    if (other) await other.close();
    await s.close();
  }
});

test("a delayed older GET cannot roll back a confirmed purchase or its device cache", async () => {
  const s = await system();
  const pc = await device(s.base);
  try {
    await pc.w.act(async () => pc.w.game.createCharacter("Версия", "warrior"));
    const delayed = pc.holdNextRead();
    Object.defineProperty(pc.w.document, "hidden", {
      configurable: true,
      value: false,
    });
    await pc.w.act(async () => {
      pc.w.dispatchEvent(new pc.w.Event("online"));
      await delayed.started;
    });
    await pc.w.act(async () => pc.w.game.buyBasicConsumable("pot_hp_small", 0));
    assert.equal(pc.w.game.player.gold, 85);
    await pc.w.act(async () => {
      delayed.release();
      await new Promise((r) => setTimeout(r, 80));
    });
    assert.equal(pc.w.game.player.gold, 85);
    assert.equal(
      JSON.parse(pc.w.localStorage.getItem("aethelgard_save_v1_data_1")).player
        .gold,
      85,
    );
    const tampered = await fetch(s.base + "/api/game", {
      headers: {
        "X-Telegram-Init-Data": signed(2).replace("first_name", "first_namE"),
      },
    });
    assert.equal(tampered.status, 401);
  } finally {
    await pc.close();
    await s.close();
  }
});

test("corrupt device cache cannot block loading the existing server character", async () => {
  const s = await system();
  const pc = await device(s.base);
  let reloaded: any;
  try {
    await pc.w.act(async () =>
      pc.w.game.createCharacter("Серверный", "warrior"),
    );
    reloaded = await device(s.base, 1, "{broken");
    assert.equal(reloaded.w.game.player.name, "Серверный");
    assert.match(
      reloaded.w.document.body.textContent,
      /Играть на этом устройстве/,
    );
  } finally {
    await pc.close();
    if (reloaded) await reloaded.close();
    await s.close();
  }
});

test("migration with a lost response blocks another import and retries the original receipt", async () => {
  const s = await system();
  const pc = await device(s.base);
  let oldDevice: any;
  let pcClosed = false;
  try {
    await pc.w.act(async () =>
      pc.w.game.createCharacter("Выбранный", "warrior"),
    );
    const raw = JSON.parse(
      pc.w.localStorage.getItem("aethelgard_save_v1_data_1"),
    );
    await pc.close();
    pcClosed = true;
    delete raw.cloud;
    oldDevice = await device(s.base, 1, JSON.stringify(raw));
    await click(oldDevice, "Играть на этом устройстве");
    oldDevice.loseNextResponse();
    await click(oldDevice, "Сохранить персонажа этого устройства");
    for (
      let i = 0;
      i < 20 &&
      !oldDevice.w.document.body.textContent.includes("Нет подтверждения");
      i++
    )
      await oldDevice.settle();
    const pending = JSON.parse(
      oldDevice.w.localStorage.getItem("aethelgard_cloud_pending_1"),
    );
    assert(
      pending?.migrate,
      oldDevice.w.document.body.textContent +
        JSON.stringify(oldDevice.requests),
    );
    const importButton = [
      ...oldDevice.w.document.querySelectorAll("button"),
    ].find(
      (b: any) => b.textContent === "Сохранить персонажа этого устройства",
    ) as any;
    assert(importButton.disabled);
    await click(oldDevice, "Повторить");
    for (let i = 0; i < 20 && !oldDevice.w.game; i++) await oldDevice.settle();
    assert.equal(oldDevice.w.game.player.name, "Выбранный");
    assert.equal(
      oldDevice.w.localStorage.getItem("aethelgard_cloud_pending_1"),
      null,
    );
    const ids = oldDevice.requests
      .filter((r: any) => r.path === "/api/game/migrate")
      .map((r: any) => JSON.parse(r.body).operationId);
    assert.deepEqual(ids, [pending.body.operationId, pending.body.operationId]);
    assert.equal(
      (await s.query("SELECT count(*)::int AS n FROM character_backups"))
        .rows[0].n,
      2,
    );
  } finally {
    if (!pcClosed) await pc.close();
    if (oldDevice) await oldDevice.close();
    await s.close();
  }
});
