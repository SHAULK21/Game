/** Local API fixture for production MODULE loading checks. Real store/rules; no Telegram/network claim. */
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { CharacterStore } from "../server/characterStore";
import { GameEngine } from "../server/gameEngine";
export const emptyApi = {
  resetVersion: 0,
  active: false,
  items: [],
  ok: true,
  isAdmin: false,
  clan: null,
  clans: [],
  messages: [],
  players: [],
  listings: [],
  opponents: [],
  members: [],
  onlinePlayers: 0,
  totalGold: 0,
  notifications: [],
  settings: { enabled: false, onboardingSeen: true },
  profile: { enrolled: false },
  history: [],
  leaders: [],
};
export async function interfaceServerFixture(save: any) {
  const db = new PGlite();
  await db.exec(
    (await fs.readFile("server/schema.sql", "utf8")).replace(
      "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
      "",
    ),
  );
  const query = (sql: string, args: any[] = []) => db.query<any>(sql, args);
  const id = 749219401;
  await query("INSERT INTO players(telegram_id) VALUES($1)", [id]);
  const pool: any = { query, connect: async () => ({ query, release() {} }) };
  const api: any = async (
    _client: any,
    _id: number,
    _epoch: number,
    path: string,
  ) => (path === "/api/market/income" ? { balanceGold: 120 } : { ...emptyApi });
  const store = new CharacterStore(pool, api);
  if (save?.player) {
    const engine = new GameEngine(id, 0, null, async (path, options) =>
      api(null, id, 0, path, options),
    );
    engine.migrateLegacy(save);
    await query(
      "INSERT INTO character_saves(telegram_id,reset_version,state_json) VALUES($1,0,$2::jsonb)",
      [id, JSON.stringify(engine.export())],
    );
  }
  return {
    close: () => db.close(),
    request: async (path: string, options: any = {}) => {
      const body = options.body ? JSON.parse(options.body) : {};
      if (path === "/api/game")
        return store.read(
          id,
          new Headers(options.headers).get("X-Game-Session") || undefined,
        );
      if (path === "/api/game/session") return store.claim(id, body);
      if (path === "/api/game/commands") return store.execute(id, 0, body);
      return { ...emptyApi };
    },
  };
}
