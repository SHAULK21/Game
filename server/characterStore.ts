import type { Express, RequestHandler } from "express";
import type { Pool, PoolClient } from "pg";
import { GameEngine, type EngineSave } from "./gameEngine";
import { validateCommand } from "./characterCommands";
import { validateLegacySave, stripLedgerItems } from "./characterValidation";
import { inCharacterTransaction } from "./transactionScope";
import { getLeveledEquipmentName } from "../src/data/gameData";
const uuid = (v: any) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const canonical = (value: any): any =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
const same = (a: any, b: any) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export class CharacterError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export type CharacterRow = {
  telegram_id: string;
  reset_version: number;
  version: string;
  state_json: EngineSave | null;
  active_session: string | null;
  session_generation: string;
  migration_until: string | null;
  migration_imported: boolean;
  migration_conflict_resolved: boolean;
};
export type InternalApi = <T>(
  client: PoolClient,
  userId: number,
  resetVersion: number,
  path: string,
  options?: RequestInit,
) => Promise<T>;
export class CharacterStore {
  constructor(
    readonly pool: Pick<Pool, "connect">,
    readonly internalApi: InternalApi,
    readonly adminId = "",
  ) {}
  private async transaction<T>(
    userId: number,
    action: (client: PoolClient, row: CharacterRow) => Promise<T>,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const player = (
        await client.query(
          "SELECT reset_version FROM players WHERE telegram_id=$1 FOR UPDATE",
          [userId],
        )
      ).rows[0];
      if (!player)
        throw new CharacterError("ACCOUNT_MISSING", "Аккаунт не найден.", 404);
      await client.query(
        "INSERT INTO character_saves(telegram_id,reset_version,migration_until) SELECT $1,$2,applied_at+INTERVAL '30 days' FROM game_schema_migrations WHERE name='server_characters_v1' ON CONFLICT(telegram_id) DO NOTHING",
        [userId, player.reset_version],
      );
      let row = (
        await client.query(
          "SELECT * FROM character_saves WHERE telegram_id=$1 FOR UPDATE",
          [userId],
        )
      ).rows[0] as CharacterRow;
      if (Number(row.reset_version) !== Number(player.reset_version)) {
        await client.query(
          "UPDATE character_saves SET reset_version=$2,version=version+1,state_json=NULL,active_session=NULL,session_generation=session_generation+1,migration_until=NULL WHERE telegram_id=$1",
          [userId, player.reset_version],
        );
        row = (
          await client.query(
            "SELECT * FROM character_saves WHERE telegram_id=$1",
            [userId],
          )
        ).rows[0];
      }
      const result = await inCharacterTransaction(client, () =>
        action(client, row),
      );
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  private async engine(client: PoolClient, userId: number, row: CharacterRow) {
    const engine = new GameEngine(
      userId,
      Number(row.reset_version),
      row.state_json,
      (path, options) =>
        this.internalApi(
          client,
          userId,
          Number(row.reset_version),
          path,
          options,
        ),
      String(userId) === this.adminId,
    );
    if (engine.model.player) {
      const rows = (
        await client.query(
          "SELECT id,item_json,quantity,locked,bound_clan_id,equipped_slot,origin FROM owned_items WHERE owner_telegram_id=$1 ORDER BY created_at,id",
          [userId],
        )
      ).rows;
      const p = engine.data.state.player;
      p.inventory = p.inventory.filter(
        (i: any) => !i.serverOwned && !rows.some((r) => r.id === i.id),
      );
      for (const [slot, item] of Object.entries(p.equipped) as any)
        if (item?.serverOwned || rows.some((r) => r.id === item?.id))
          delete p.equipped[slot];
      for (const r of rows) {
        const item = {
          ...r.item_json,
          id: r.id,
          stackCount: r.quantity,
          isLocked: r.locked,
          boundToClan: r.bound_clan_id || undefined,
          serverOwned: true,
          marketTradable: r.origin !== "legacy_market_return",
          isEquipped: !!r.equipped_slot,
          name: getLeveledEquipmentName(
            r.item_json.name,
            r.item_json.type,
            r.item_json.level,
            r.item_json.targetClass,
          ),
        };
        if (r.equipped_slot) {
          if (p.equipped[r.equipped_slot])
            p.inventory.push({
              ...p.equipped[r.equipped_slot],
              isEquipped: false,
            });
          p.equipped[r.equipped_slot] = item;
        } else p.inventory.push(item);
      }
      const profile = (
        await client.query(
          "SELECT clan_id,market_gold,premium_until FROM players WHERE telegram_id=$1",
          [userId],
        )
      ).rows[0];
      p.clanId = profile.clan_id || undefined;
      p.marketGold = Number(profile.market_gold);
      engine.data.state.premium = {
        ...engine.data.state.premium,
        active: Boolean(
          profile.premium_until &&
          new Date(profile.premium_until).getTime() > Date.now(),
        ),
        premiumUntil: profile.premium_until,
        loading: false,
      };
      // Re-render the model with the canonical ledger before accepting any action.
      engine.loadLegacy({
        player: p,
        quests: engine.data.state.quests,
        achievements: engine.data.state.achievements,
        activeDungeonRun: engine.data.state.activeDungeonRun,
      });
    }
    return engine;
  }
  private async response(
    client: PoolClient,
    userId: number,
    row: CharacterRow,
    session?: string,
  ) {
    const engine = await this.engine(client, userId, row);
    return {
      protocol: 1,
      serverTime: Date.now(),
      telegramId: String(userId),
      resetVersion: Number(row.reset_version),
      version: Number(row.version),
      sessionGeneration: Number(row.session_generation),
      activeSession: Boolean(row.active_session),
      ownsSession: !!session && row.active_session === session,
      migrationAllowed:
        !row.migration_conflict_resolved &&
        !!row.migration_until &&
        new Date(row.migration_until).getTime() > Date.now(),
      state: engine.view(),
    };
  }
  async read(userId: number, session?: string) {
    return this.transaction(userId, (client, row) =>
      this.response(client, userId, row, session),
    );
  }
  async claim(userId: number, body: any) {
    if (
      !uuid(body?.sessionId) ||
      !Number.isSafeInteger(body.expectedVersion) ||
      !Number.isSafeInteger(body.expectedGeneration)
    )
      throw new CharacterError("BAD_SESSION", "Некорректная сессия.", 400);
    return this.transaction(userId, async (client, row) => {
      if (row.active_session === body.sessionId)
        return this.response(client, userId, row, body.sessionId);
      if (
        Number(row.version) !== body.expectedVersion ||
        Number(row.session_generation) !== body.expectedGeneration
      )
        throw new CharacterError(
          "VERSION_CONFLICT",
          "Прогресс изменился. Загрузите актуального персонажа.",
        );
      if (row.active_session && !body.takeover)
        throw new CharacterError(
          "SESSION_ACTIVE",
          "Игра открыта на другом устройстве. Перенесите активную сессию явно.",
        );
      await client.query(
        "UPDATE character_saves SET active_session=$2,session_generation=session_generation+1 WHERE telegram_id=$1",
        [userId, body.sessionId],
      );
      row.active_session = body.sessionId;
      row.session_generation = String(Number(row.session_generation) + 1);
      return this.response(client, userId, row, body.sessionId);
    });
  }
  private assertWriter(row: CharacterRow, body: any, resetVersion: number) {
    if (Number(row.reset_version) !== resetVersion)
      throw new CharacterError(
        "ACCOUNT_RESET",
        "Прогресс сброшен администратором.",
      );
    if (
      !uuid(body.sessionId) ||
      row.active_session !== body.sessionId ||
      Number(row.session_generation) !== body.sessionGeneration
    )
      throw new CharacterError(
        "SESSION_REVOKED",
        "Активная сессия перенесена на другое устройство. Здесь изменения остановлены.",
      );
  }
  async execute(
    userId: number,
    resetVersion: number,
    body: any,
    migrate = false,
  ) {
    if (
      !uuid(body?.operationId) ||
      !Number.isSafeInteger(body.expectedVersion) ||
      body.expectedVersion < 0
    )
      throw new CharacterError(
        "BAD_COMMAND",
        "Некорректная версия или ID операции.",
        400,
      );
    return this.transaction(userId, async (client, row) => {
      this.assertWriter(row, body, resetVersion);
      const request = migrate
        ? {
            migration: true,
            save: body.save,
            replace: body.replace === true,
            confirmCharacterId: body.confirmCharacterId,
          }
        : { command: body.command, args: body.args };
      const previous = (
        await client.query(
          "SELECT * FROM character_operations WHERE telegram_id=$1 AND reset_version=$2 AND operation_id=$3",
          [userId, resetVersion, body.operationId],
        )
      ).rows[0];
      if (previous) {
        if (
          !same(previous.request_json, request) ||
          Number(previous.session_generation) !== body.sessionGeneration
        )
          throw new CharacterError(
            "OPERATION_CONFLICT",
            "ID операции уже использован с другими параметрами.",
          );
        return {
          ...(await this.response(client, userId, row, body.sessionId)),
          result: previous.response_json.result,
          replayed: true,
        };
      }
      if (Number(row.version) !== body.expectedVersion)
        throw new CharacterError(
          "VERSION_CONFLICT",
          "На сервере уже есть новый прогресс. Старые изменения остановлены.",
        );
      let engine = await this.engine(client, userId, row),
        result: any;
      const ledgerBefore = new Map<string, any>(
        (
          await client.query(
            "SELECT * FROM owned_items WHERE owner_telegram_id=$1 FOR UPDATE",
            [userId],
          )
        ).rows.map((item) => [item.id, item]),
      );
      engine.events.length = 0;
      if (migrate) {
        if (
          row.migration_conflict_resolved ||
          !row.migration_until ||
          new Date(row.migration_until).getTime() < Date.now()
        )
          throw new CharacterError(
            "MIGRATION_CLOSED",
            "Перенос старого сохранения уже закрыт. Серверный персонаж сохранён.",
          );
        const legacy = validateLegacySave(body.save, userId, resetVersion);
        if (
          row.migration_imported &&
          (!row.state_json ||
            row.state_json.state.player?.id === legacy.player.id)
        )
          throw new CharacterError(
            "MIGRATION_CLOSED",
            "Этот локальный персонаж уже перенесён. Повторная загрузка его состояния запрещена.",
          );
        if (
          row.state_json &&
          (!body.replace || body.confirmCharacterId !== legacy.player.id)
        )
          throw new CharacterError(
            "CHARACTER_CONFLICT",
            "На сервере уже есть персонаж. Подтвердите выбор локального персонажа или оставьте серверного.",
          );
        await client.query(
          "INSERT INTO character_backups(telegram_id,reset_version,source,snapshot_json) VALUES($1,$2,$3,$4::jsonb)",
          [userId, resetVersion, "legacy_import", JSON.stringify(body.save)],
        );
        if (row.state_json)
          await client.query(
            "INSERT INTO character_backups(telegram_id,reset_version,source,snapshot_json) VALUES($1,$2,$3,$4::jsonb)",
            [
              userId,
              resetVersion,
              "before_replacement",
              JSON.stringify(row.state_json),
            ],
          );
        const owned = (
          await client.query(
            "SELECT id FROM owned_items WHERE owner_telegram_id=$1",
            [userId],
          )
        ).rows;
        legacy.player.inventory = legacy.player.inventory.filter(
          (i: any) => !i.serverOwned && !owned.some((r) => r.id === i.id),
        );
        for (const [slot, item] of Object.entries(
          legacy.player.equipped,
        ) as any)
          if (item?.serverOwned || owned.some((r) => r.id === item?.id))
            delete legacy.player.equipped[slot];
        engine = new GameEngine(
          userId,
          resetVersion,
          null,
          (path, options) =>
            this.internalApi(client, userId, resetVersion, path, options),
          String(userId) === this.adminId,
        );
        engine.migrateLegacy(legacy);
        result = {
          success: true,
          message: "Персонаж перенесён. Резервная копия сохранена.",
        };
      } else if (body.command === "api") {
        const [path, options] = body.args || [];
        if (
          typeof path !== "string" ||
          !/^\/api\/(clan\/(?:[0-9a-f-]+\/join|leave|raid\/attack|storage(?:\/[^?#.]+)?|manage|projects\/upgrade)|pvp\/(enroll|challenge)|admin\/premium\/self)$/.test(
            path,
          ) ||
          options?.method !== "POST"
        )
          throw new CharacterError(
            "BAD_COMMAND",
            "Этот API недоступен как игровая команда.",
            400,
          );
        let requestBody = options.body ? JSON.parse(options.body) : {};
        if (engine.model.player) {
          requestBody.gold = engine.model.player.gold;
          requestBody.silver = engine.model.player.silver;
        }
        result = await this.internalApi(client, userId, resetVersion, path, {
          ...options,
          body: JSON.stringify(requestBody),
        });
      } else {
        const args = validateCommand(engine, body.command, body.args);
        result = await engine.command(
          body.command === "setCurrentRegion" ? "startTravel" : body.command,
          args,
        );
      }
      // Shared crafting/consumption rules can consume canonical ingredients too. Persist that
      // delta in the ledger before stripping its projection out of the character JSON.
      if (!migrate && engine.model.player && body.command !== "api") {
        const p = engine.model.player;
        const projected = new Map<string, any>(
          [...p.inventory, ...Object.values(p.equipped).filter(Boolean)]
            .filter((i: any) => i.serverOwned)
            .map((i: any) => [i.id, i]),
        );
        for (const [id, old] of ledgerBefore) {
          const item = projected.get(id);
          if (!item) {
            await client.query(
              "DELETE FROM owned_items WHERE id=$1 AND owner_telegram_id=$2",
              [id, userId],
            );
            continue;
          }
          const slot =
            Object.entries(p.equipped).find(([, i]) => i?.id === id)?.[0] ||
            null;
          if (
            Number(old.quantity) !== (item.stackCount || 1) ||
            old.equipped_slot !== slot
          )
            await client.query(
              "UPDATE owned_items SET quantity=$3,equipped_slot=$4,updated_at=NOW() WHERE id=$1 AND owner_telegram_id=$2",
              [id, userId, item.stackCount || 1, slot],
            );
        }
      }
      // Reconcile the ledger after item transfers; the JSON never stores its own copy.
      const migrationReplacement = migrate && Boolean(row.state_json);
      const saved = stripLedgerItems(engine.export());
      if (saved.state.player) {
        const p = saved.state.player;
        p.lastActiveTimestamp = Date.now();
        await client.query(
          "UPDATE players SET character_name=$2,level=$3,arena_rating=$4,class_id=$5,updated_at=NOW() WHERE telegram_id=$1",
          [userId, p.name, p.level, p.arenaRating, p.classId],
        );
      }
      await client.query(
        "UPDATE character_saves SET state_json=$2::jsonb,version=version+1,migration_imported=migration_imported OR $3,migration_conflict_resolved=migration_conflict_resolved OR $4,migration_until=CASE WHEN $4 THEN NULL ELSE migration_until END,updated_at=NOW() WHERE telegram_id=$1",
        [userId, JSON.stringify(saved), migrate, migrationReplacement],
      );
      row.state_json = saved;
      row.version = String(Number(row.version) + 1);
      if (migrate) {
        row.migration_imported = true;
        if (migrationReplacement) {
          row.migration_conflict_resolved = true;
          row.migration_until = null;
        }
      }
      const response = {
        ...(await this.response(client, userId, row, body.sessionId)),
        result: result ?? null,
        replayed: false,
        events: engine.events.slice(-50),
      };
      await client.query(
        "INSERT INTO character_operations(telegram_id,reset_version,operation_id,session_generation,request_json,response_json) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)",
        [
          userId,
          resetVersion,
          body.operationId,
          body.sessionGeneration,
          JSON.stringify(request),
          JSON.stringify({ result: response.result }),
        ],
      );
      return response;
    });
  }
}
export function registerCharacterStore(
  app: Express,
  getPool: () => Pool,
  auth: RequestHandler,
  internalApi: InternalApi,
) {
  const store = () =>
    new CharacterStore(
      getPool(),
      internalApi,
      String(
        process.env.ADMIN_TELEGRAM_ID ||
          process.env.VITE_ADMIN_TELEGRAM_ID ||
          "",
      ),
    );
  const run =
    (action: (req: any) => Promise<any>): RequestHandler =>
    async (req, res) => {
      try {
        res.json(await action(req));
      } catch (e) {
        if (e instanceof CharacterError) {
          res.status(e.status).json({ code: e.code, error: e.message });
          return;
        }
        if (e instanceof Error && !("severity" in e)) {
          res
            .status(400)
            .json({ code: "INVALID_SAVE_OR_ACTION", error: e.message });
          return;
        }
        throw e;
      }
    };
  app.get(
    "/api/game",
    auth,
    run((req) => store().read(req.authUser.id, req.get("X-Game-Session"))),
  );
  app.post(
    "/api/game/session",
    auth,
    run((req) => store().claim(req.authUser.id, req.body)),
  );
  app.post(
    "/api/game/commands",
    auth,
    run((req) =>
      store().execute(
        req.authUser.id,
        Number(req.get("X-Game-Reset-Version")),
        req.body,
      ),
    ),
  );
  app.post(
    "/api/game/migrate",
    auth,
    run((req) =>
      store().execute(
        req.authUser.id,
        Number(req.get("X-Game-Reset-Version")),
        req.body,
        true,
      ),
    ),
  );
}
