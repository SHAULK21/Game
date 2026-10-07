import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { returnExpiredMarketListings } from "./marketListings";
import { disposeBulkItems, BulkDisposalError } from "./bulkDisposal";
export function registerPlayerItems(
  app: Express,
  pool: Pool,
  auth: RequestHandler,
) {
  app.get("/api/items/owned", auth, async (req, res) => {
    await returnExpiredMarketListings(pool, req.authUser!.id);
    const items = await pool.query(
      `SELECT id, item_json, quantity, locked, bound_clan_id, equipped_slot, origin
     FROM owned_items WHERE owner_telegram_id = $1 ORDER BY created_at DESC`,
      [req.authUser!.id],
    );
    res.json({ items: items.rows });
  });

  app.post("/api/items/:itemId/equip", auth, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        `SELECT id, item_json, equipped_slot FROM owned_items WHERE id = $1 AND owner_telegram_id = $2 FOR UPDATE`,
        [req.params.itemId, req.authUser!.id],
      );
      const row = found.rows[0];
      if (!row) throw new Error("Предмет не принадлежит персонажу.");
      const slot = String(row.item_json.type || "");
      if (
        ![
          "weapon",
          "offhand",
          "helmet",
          "armor",
          "pants",
          "gloves",
          "boots",
          "amulet",
          "ring",
          "belt",
          "cloak",
          "artifact",
          "pickaxe",
          "alchemyTool",
        ].includes(slot)
      )
        throw new Error("Этот предмет нельзя надеть.");
      await client.query(
        `UPDATE owned_items SET equipped_slot = NULL, updated_at = NOW() WHERE owner_telegram_id = $1 AND equipped_slot = $2`,
        [req.authUser!.id, slot],
      );
      await client.query(
        `UPDATE owned_items SET equipped_slot = $1, updated_at = NOW() WHERE id = $2`,
        [slot, row.id],
      );
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      res
        .status(400)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Не удалось надеть предмет.",
        });
    } finally {
      client.release();
    }
  });

  app.post("/api/items/:itemId/unequip", auth, async (req, res) => {
    await pool.query(
      `UPDATE owned_items SET equipped_slot = NULL, updated_at = NOW() WHERE id = $1 AND owner_telegram_id = $2`,
      [req.params.itemId, req.authUser!.id],
    );
    res.json({ ok: true });
  });

  app.post("/api/items/:itemId/lock", auth, async (req, res) => {
    const result = await pool.query(
      `UPDATE owned_items SET locked = NOT locked, updated_at = NOW() WHERE id = $1 AND owner_telegram_id = $2 RETURNING locked`,
      [req.params.itemId, req.authUser!.id],
    );
    if (!result.rows[0])
      return res.status(404).json({ error: "Предмет не найден." });
    res.json({ locked: result.rows[0].locked });
  });

  app.post("/api/items/bulk-dispose", auth, async (req, res) => {
    try {
      res.json(await disposeBulkItems(pool, req.authUser!.id, req.body));
    } catch (error) {
      if (error instanceof BulkDisposalError)
        return res.status(error.status).json({ error: error.message });
      throw error;
    }
  });

  app.post("/api/items/:itemId/dispose", auth, async (req, res) => {
    const action = String(req.body?.action || "");
    if (!["sell", "disassemble"].includes(action))
      return res.status(400).json({ error: "Недопустимое действие." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        `SELECT * FROM owned_items WHERE id = $1 AND owner_telegram_id = $2 FOR UPDATE`,
        [req.params.itemId, req.authUser!.id],
      );
      const row = found.rows[0];
      if (!row || row.locked || row.equipped_slot)
        throw new Error("Предмет недоступен.");
      const item = row.item_json;
      const quantity = Number(row.quantity);
      const gold =
        action === "sell"
          ? Math.max(0, Math.min(100000, Number(item.sellPrice || 0))) *
            quantity
          : 0;
      const silver =
        action === "disassemble"
          ? Math.max(
              0,
              Math.min(100000, Number(item.disassembleYield?.silver || 0)),
            ) * quantity
          : 0;
      const ore =
        action === "disassemble"
          ? Math.max(
              0,
              Math.min(1000, Number(item.disassembleYield?.ore || 0)),
            ) * quantity
          : 0;
      await client.query("DELETE FROM owned_items WHERE id = $1", [row.id]);
      await client.query("COMMIT");
      res.json({ ok: true, gold, silver, ore });
    } catch (error) {
      await client.query("ROLLBACK");
      res
        .status(400)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Не удалось обработать предмет.",
        });
    } finally {
      client.release();
    }
  });
}
