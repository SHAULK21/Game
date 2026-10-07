import {authenticatePlayer, heartbeatPlayer, communityStatsCache} from './playerSession';
import { sellToResidents } from './localMarket';
import { recordTelegramWriteAccess } from './telegramWriteAccess';
import { translateText } from '../src/i18n/translate';
import { registerClanProjects } from './clanProjects';
import { clanRaidHealth, clanRaidReward, clanRaidItem } from '../src/utils/clanProjects';
import { leavePlayerClan } from './clanLeave';
import { createPaidClan } from './clanCreation';
import {createMarketListing, buyMarketListing, returnMarketListing, returnExpiredMarketListings} from './marketListings';
import { gameMessagePayload, gameMenuButton, messageLanguage } from './telegramGameMessages';
import { registerSocialFeatures, queueNotification, startNotificationWorker } from './socialFeatures';
import { canUseVault } from '../src/utils/clanRoles';
import { disposeBulkItems, BulkDisposalError } from './bulkDisposal';
import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool, PoolClient } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASS_EQUIPMENT } from '../src/utils/classEquipment';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 10000);
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for production.');
}
if (isProduction && !process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in production.');
}

const PREMIUM_PRICE_STARS = 150;
const PREMIUM_PERIOD_SECONDS = 30 * 24 * 60 * 60;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || (
  telegramBotToken
    ? crypto.createHash('sha256').update('aethelgard:' + telegramBotToken).digest('hex').slice(0, 48)
    : ''
);

const telegramBotApi = async <T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> => {
  if (!telegramBotToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(data.description || `Telegram Bot API error: ${method}`);
  return data.result as T;
};

const createDatabasePool = (useSsl: boolean) => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let databaseUsesSsl = process.env.DATABASE_SSL === 'true';
let pool = createDatabasePool(databaseUsesSsl);

const ensureDatabaseConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`Postgres connected (SSL=${databaseUsesSsl}).`);
  } catch (firstError) {
    console.warn(`Postgres connection failed with SSL=${databaseUsesSsl}; retrying with SSL=${!databaseUsesSsl}.`, firstError);
    await pool.end().catch(() => undefined);
    databaseUsesSsl = !databaseUsesSsl;
    pool = createDatabasePool(databaseUsesSsl);
    await pool.query('SELECT 1');
    console.log(`Postgres connected after fallback (SSL=${databaseUsesSsl}).`);
  }
};

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://telegram.org'],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

type AuthUser = { id: number; username?: string; displayName: string; allowsWriteToPm?: boolean };
declare global {
  namespace Express {
    interface Request { authUser?: AuthUser }
  }
}

const validateTelegramInitData = (initData: string): AuthUser => {
  if (!initData) throw new Error('Telegram initData is required.');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date') || 0);
  if (!hash || !authDate) throw new Error('Invalid Telegram initData.');
  if (Math.abs(Date.now() / 1000 - authDate) > 7 * 86400) throw new Error('Telegram session expired. Reopen the Mini App from the bot.');

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + '=' + value)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest();
  const calculated = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Telegram signature verification failed.');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Telegram user is missing.');
  const user = JSON.parse(userRaw);

  return {
    id: Number(user.id),
    username: user.username,
    allowsWriteToPm: user.allows_write_to_pm === true,
    displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Игрок',
  };
};

const auth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const initData = String(req.headers['x-telegram-init-data'] || '');
    if (!initData && !isProduction) {
      const id = Number(process.env.DEV_TELEGRAM_ID || 749219401);
      req.authUser = { id, displayName: 'Dev Player', username: 'dev_player' };
    } else {
      req.authUser = validateTelegramInitData(initData);
    }

    const resetVersion = await authenticatePlayer(pool,req.authUser);
    if (!['GET', 'HEAD'].includes(req.method) && Number(req.get('X-Game-Reset-Version') || 0) !== resetVersion) {
      res.status(409).json({ code: 'ACCOUNT_RESET', resetVersion, error: 'Прогресс сброшен администратором. Создайте нового персонажа.' });
      return;
    }
    next();
  } catch (error) {
    console.error('Telegram auth failed:', error);
    res.status(401).json({ error: error instanceof Error ? error.message : 'Unauthorized' });
  }
};

const requireClan = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.authUser!.id;
  const result = await pool.query(
    `SELECT c.*, cm.role
     FROM players p
     JOIN clans c ON c.id = p.clan_id
     JOIN clan_members cm ON cm.clan_id = c.id AND cm.telegram_id = p.telegram_id
     WHERE p.telegram_id = $1`,
    [userId]
  );
  if (!result.rows[0]) return res.status(403).json({ error: 'Вы не состоите в клане.' });
  res.locals.clan = result.rows[0];
  next();
};

registerSocialFeatures(app, () => pool, auth, telegramBotApi, publicBaseUrl);

app.get('/api/health', async (_req, res) => {
  try {
    const dbStarted = Date.now();
    await pool.query('SELECT 1');
    let telegramOk = false;
    let telegramUsername: string | null = null;
    if (telegramBotToken) {
      try {
        const bot = await telegramBotApi<{ username?: string }>('getMe', {});
        telegramOk = true;
        telegramUsername = bot?.username || null;
      } catch (error) {
        console.error('Telegram getMe health check failed:', error);
      }
    }
    res.json({
      ok: true,
      service: 'aethelgard',
      database: { ok: true, latencyMs: Date.now() - dbStarted, ssl: databaseUsesSsl },
      telegram: { configured: Boolean(telegramBotToken), ok: telegramOk, username: telegramUsername },
      webhook: { baseUrlConfigured: Boolean(publicBaseUrl), secretConfigured: Boolean(telegramWebhookSecret) },
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check database failure:', error);
    res.status(503).json({
      ok: false,
      service: 'aethelgard',
      database: { ok: false },
      telegram: { configured: Boolean(telegramBotToken) },
      error: error instanceof Error ? error.message : 'Database unavailable',
      time: new Date().toISOString()
    });
  }
});

app.get('/api/admin/status', auth, async (req, res) => {
  const configuredAdminId = String(
    process.env.ADMIN_TELEGRAM_ID ||
    process.env.VITE_ADMIN_TELEGRAM_ID ||
    ''
  ).trim();

  res.json({
    isAdmin: Boolean(configuredAdminId) && String(req.authUser!.id) === configuredAdminId
  });
});

app.post('/api/profile/sync', auth, async (req, res) => {
  const rawLevel = Number(req.body?.level || 1);
  const level = Number.isFinite(rawLevel) ? Math.max(1, Math.min(120, Math.floor(rawLevel))) : 1;
  const arenaRating = Math.max(0, Math.min(2147483647, Math.floor(Number(req.body?.arenaRating ?? 1000))));
  const characterName = typeof req.body?.characterName === 'string' ? req.body.characterName.trim() || null : null;
  const updated = await pool.query(
    'UPDATE players SET level = $1, arena_rating = $2, character_name = COALESCE($3, character_name), updated_at = NOW() WHERE telegram_id = $4 AND reset_version=$5',
    [level, arenaRating, characterName, req.authUser!.id, Number(req.get('X-Game-Reset-Version') || 0)]
  );
  if (!updated.rowCount) {
    const current = (await pool.query('SELECT reset_version FROM players WHERE telegram_id=$1', [req.authUser!.id])).rows[0];
    res.status(409).json({ code: 'ACCOUNT_RESET', resetVersion: Number(current.reset_version), error: 'Прогресс сброшен администратором.' }); return;
  }
  if (Object.hasOwn(CLASS_EQUIPMENT, String(req.body?.classId))) await pool.query('UPDATE players SET class_id = $1 WHERE telegram_id = $2 AND reset_version=$3', [req.body.classId,req.authUser!.id,Number(req.get('X-Game-Reset-Version') || 0)]);
  res.json({ ok: true });
});

const getCommunityStats=communityStatsCache(()=>pool);
app.post('/api/profile/heartbeat',auth,async(req,res)=>{
  await heartbeatPlayer(pool,req.authUser!.id);res.json({ok:true});
});
app.get('/api/community/stats',auth,async(_req,res)=>res.json(await getCommunityStats()));

app.get('/api/leaderboard', auth, async (_req, res) => {
  const result = await pool.query(
    `SELECT telegram_id, COALESCE(NULLIF(BTRIM(character_name), ''), 'Игрок') AS character_name, level, arena_rating,
            last_seen_at >= NOW() - INTERVAL '5 minutes' AS is_online
     FROM players
     ORDER BY level DESC, arena_rating DESC, updated_at ASC
     LIMIT 100`
  );
  res.json({ players: result.rows });
});

app.get('/api/clans', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const result = await pool.query(
    `SELECT c.id, c.tag, c.name, c.description, c.level, c.xp, c.max_members, c.recruitment_open, c.min_join_level,
            COUNT(cm.telegram_id)::int AS members_count
     FROM clans c
     LEFT JOIN clan_members cm ON cm.clan_id = c.id
     WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%' OR c.tag ILIKE '%' || $1 || '%')
     GROUP BY c.id
     ORDER BY c.level DESC, members_count DESC, c.created_at ASC
     LIMIT 30`,
    [q]
  );
  res.json({ clans: result.rows });
});

app.get('/api/clan/me', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, cm.role,
            (SELECT COUNT(*)::int FROM clan_members members WHERE members.clan_id = c.id) AS members_count,
            'Страж клановых врат' AS raid_name
     FROM players p
     JOIN clans c ON c.id = p.clan_id
     JOIN clan_members cm ON cm.clan_id = c.id AND cm.telegram_id = p.telegram_id
     WHERE p.telegram_id = $1`,
    [req.authUser!.id]
  );
  if (!result.rows[0]) return res.json({ clan: null });

  const clan = result.rows[0];
  const members = await pool.query(
    `SELECT cm.telegram_id, cm.role, cm.joined_at, cm.raid_damage, p.level, p.display_name, p.username
     FROM clan_members cm JOIN players p ON p.telegram_id = cm.telegram_id
     WHERE cm.clan_id = $1
     ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, cm.joined_at ASC`,
    [clan.id]
  );
  const messages = await pool.query(
    `SELECT m.id, m.text, m.created_at,
            COALESCE(NULLIF(BTRIM(p.character_name), ''), 'Игрок') AS display_name
     FROM clan_chat_messages m JOIN players p ON p.telegram_id = m.telegram_id
     WHERE m.clan_id = $1 ORDER BY m.created_at DESC LIMIT 50`,
    [clan.id]
  );
  res.json({ clan, members: members.rows, messages: messages.rows.reverse() });
});

app.post('/api/clan/create', auth, async (req, res) => {
  try { res.status(201).json(await createPaidClan(pool, req.authUser!.id, req.body)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось создать клан.' }); }
});

app.post('/api/clan/:clanId/join', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const player = await client.query('SELECT clan_id FROM players WHERE telegram_id = $1 FOR UPDATE', [req.authUser!.id]);
    if (player.rows[0]?.clan_id) throw new Error('Вы уже состоите в клане.');

    const clan = await client.query('SELECT id, max_members, recruitment_open, min_join_level FROM clans WHERE id = $1 FOR UPDATE', [req.params.clanId]);
    if (!clan.rows[0]) throw new Error('Клан не найден.');
    if (!clan.rows[0].recruitment_open) throw new Error('Набор в клан закрыт.');
    const levelRow = await client.query('SELECT level FROM players WHERE telegram_id = $1',[req.authUser!.id]);
    if (Number(levelRow.rows[0].level) < clan.rows[0].min_join_level) throw new Error('Недостаточный уровень для вступления.');
    const members = await client.query('SELECT COUNT(*)::int AS count FROM clan_members WHERE clan_id = $1', [req.params.clanId]);
    if (Number(members.rows[0].count) >= Number(clan.rows[0].max_members)) throw new Error('Клан заполнен.');

    await client.query("INSERT INTO clan_members (clan_id, telegram_id, role) VALUES ($1, $2, 'recruit')", [req.params.clanId, req.authUser!.id]);
    await client.query('UPDATE players SET clan_id = $1, updated_at = NOW() WHERE telegram_id = $2', [req.params.clanId, req.authUser!.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось вступить.' });
  } finally {
    client.release();
  }
});

app.post('/api/clan/leave', auth, requireClan, async (req, res) => {
  try {res.json(await leavePlayerClan(pool,req.authUser!.id,res.locals.clan.id,req.body?.confirmDisband === true));}
  catch(error){res.status(400).json({error:error instanceof Error?error.message:'Ошибка выхода из клана.'});}
});

app.post('/api/clan/donate', auth, requireClan, async (req, res) => {
  const amount = Math.floor(Number(req.body?.amount));
  if (!Number.isInteger(amount) || amount < 100 || amount > 100000) return res.status(400).json({ error: 'Сумма должна быть от 100 до 100000.' });
  res.status(501).json({ error: 'Казна будет подключена к серверному кошельку персонажа на следующем этапе.' });
});

app.post('/api/clan/raid/attack', auth, requireClan, async (req, res) => {
  let damage = 450 + crypto.randomInt(0, 251);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const clan = await client.query('SELECT * FROM clans WHERE id = $1 FOR UPDATE', [res.locals.clan.id]);
    if (!clan.rows[0]) throw new Error('Клан не найден.');
    let row = clan.rows[0];

    if (new Date(row.raid_reset_at).getTime() <= Date.now()) {
      const hp = clanRaidHealth(Number(row.level));
      row = (await client.query(
        `UPDATE clans SET raid_hp=$2,raid_max_hp=$2,raid_reset_at=NOW()+INTERVAL '7 days',updated_at=NOW() WHERE id=$1 RETURNING *`,
        [row.id,hp]
      )).rows[0];
      await client.query('UPDATE clan_members SET raid_damage=0 WHERE clan_id=$1',[row.id]);
    }

    damage = Math.round(damage * (1 + Math.min(10, Number(row.projects?.arsenal || 0)) * 0.05));
    if (Number(row.raid_hp) <= 0) throw new Error('Рейд уже завершён.');
    const attack = await client.query(`UPDATE clan_members SET last_raid_attack = NOW(), raid_damage = raid_damage + $3 WHERE clan_id = $1 AND telegram_id = $2 AND (last_raid_attack IS NULL OR last_raid_attack < date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') RETURNING telegram_id`,[row.id,req.authUser!.id,Math.min(damage,Number(row.raid_hp))]);
    if (!attack.rowCount) throw new Error('Один удар по рейду в сутки. Следующий — в 00:00 UTC.');
    const nextHp = Math.max(0, Number(row.raid_hp) - damage);
    await client.query('UPDATE clans SET raid_hp = $1, updated_at = NOW() WHERE id = $2', [nextHp, row.id]);
    if (nextHp === 0) {
      const rewards = clanRaidReward(Number(row.level), Number(row.projects?.research || 0), Number(row.projects?.supplies || 0));
      await client.query('UPDATE clans SET xp=xp+$2,treasury_gold=treasury_gold+$3,treasury_silver=treasury_silver+$4,treasury_ore=treasury_ore+$5,level=GREATEST(level,LEAST(15,1+((xp+$2)/1000))),max_members=GREATEST(max_members,LEAST(50,30+((xp+$2)/1000)*2)) WHERE id=$1',[row.id,rewards.xp,rewards.gold,rewards.silver,rewards.ore]);
      const clanMembers = await client.query('SELECT telegram_id FROM clan_members WHERE clan_id=$1',[row.id]);
      for (const member of clanMembers.rows) await queueNotification(client,member.telegram_id,'raid_' + row.id + '_' + row.raid_reset_at,'clan',`🏆 Клан победил рейдового босса: +${rewards.xp} опыта клана, +${rewards.gold} золота, +${rewards.silver} серебра и +${rewards.ore} руды в казну.`);
    }
    // A single server-minted personal item per player per UTC week. The client
    // supplies neither its stats nor its rarity, so it cannot forge a deposit.
    const periodStart = new Date();
    periodStart.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCDate(periodStart.getUTCDate() - (periodStart.getUTCDay() + 6) % 7);
    const claim = await client.query(
      `INSERT INTO clan_raid_item_claims (clan_id, telegram_id, period_start)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING telegram_id`,
      [row.id, req.authUser!.id, periodStart.toISOString().slice(0, 10)]
    );
    let reward = null;
    if (claim.rowCount) {
      const rare = crypto.randomInt(100) < 15;
      const item = clanRaidItem(Number(row.level), rare);
      const inserted = await client.query(
        `INSERT INTO owned_items (owner_telegram_id, item_json, origin)
         VALUES ($1, $2::jsonb, 'clan_raid') RETURNING id, item_json`,
        [req.authUser!.id, JSON.stringify(item)]
      );
      reward = inserted.rows[0];
    }
    await client.query('COMMIT');
    res.json({ ok: true, raidHp: nextHp, raidMaxHp: Number(row.raid_max_hp), defeated: nextHp === 0, reward });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка рейда.' });
  } finally {
    client.release();
  }
});

registerClanProjects(app, () => pool, auth, requireClan);

// All vault transfers lock the canonical item row and the membership record in
// one transaction. The request body contains IDs and quantities, never item stats.
const vaultRole = async (client: PoolClient, clanId: string, userId: number) => {
  const membership = await client.query(
    `SELECT cm.role FROM clan_members cm JOIN players p ON p.telegram_id = cm.telegram_id
     WHERE cm.clan_id = $1 AND cm.telegram_id = $2 AND p.clan_id = $1 FOR SHARE OF cm, p`,
    [clanId, userId]
  );
  if (!membership.rows[0]) throw new Error('Вы больше не состоите в этом клане.');
  return membership.rows[0].role as 'owner' | 'officer' | 'member';
};

const recordVaultEvent = async (client: PoolClient, clanId: string, actor: number, action: string, item: any, quantity: number, gold = 0, silver = 0, ore = 0) => {
  await client.query(
    `INSERT INTO clan_storage_events (clan_id, actor_telegram_id, action, item_name, quantity, gold_delta, silver_delta, ore_delta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [clanId, actor, action, String(item.name || 'Предмет').slice(0, 80), quantity, gold, silver, ore]
  );
};

app.get('/api/items/owned', auth, async (req, res) => {
  await returnExpiredMarketListings(pool,req.authUser!.id);
  const items = await pool.query(
    `SELECT id, item_json, quantity, locked, bound_clan_id, equipped_slot, origin
     FROM owned_items WHERE owner_telegram_id = $1 ORDER BY created_at DESC`,
    [req.authUser!.id]
  );
  res.json({ items: items.rows });
});

app.post('/api/items/:itemId/equip', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT id, item_json, equipped_slot FROM owned_items WHERE id = $1 AND owner_telegram_id = $2 FOR UPDATE`, [req.params.itemId, req.authUser!.id]);
    const row = found.rows[0];
    if (!row) throw new Error('Предмет не принадлежит персонажу.');
    const slot = String(row.item_json.type || '');
    if (!['weapon','offhand','helmet','armor','pants','gloves','boots','amulet','ring','belt','cloak','artifact','pickaxe','alchemyTool'].includes(slot)) throw new Error('Этот предмет нельзя надеть.');
    await client.query(`UPDATE owned_items SET equipped_slot = NULL, updated_at = NOW() WHERE owner_telegram_id = $1 AND equipped_slot = $2`, [req.authUser!.id, slot]);
    await client.query(`UPDATE owned_items SET equipped_slot = $1, updated_at = NOW() WHERE id = $2`, [slot, row.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось надеть предмет.' });
  } finally { client.release(); }
});

app.post('/api/items/:itemId/unequip', auth, async (req, res) => {
  await pool.query(`UPDATE owned_items SET equipped_slot = NULL, updated_at = NOW() WHERE id = $1 AND owner_telegram_id = $2`, [req.params.itemId, req.authUser!.id]);
  res.json({ ok: true });
});

app.post('/api/items/:itemId/lock', auth, async (req, res) => {
  const result = await pool.query(`UPDATE owned_items SET locked = NOT locked, updated_at = NOW() WHERE id = $1 AND owner_telegram_id = $2 RETURNING locked`, [req.params.itemId, req.authUser!.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Предмет не найден.' });
  res.json({ locked: result.rows[0].locked });
});

app.post('/api/items/bulk-dispose', auth, async (req, res) => {
  try { res.json(await disposeBulkItems(pool, req.authUser!.id, req.body)); }
  catch (error) {
    if (error instanceof BulkDisposalError) return res.status(error.status).json({error:error.message});
    throw error;
  }
});

app.post('/api/items/:itemId/dispose', auth, async (req, res) => {
  const action = String(req.body?.action || '');
  if (!['sell', 'disassemble'].includes(action)) return res.status(400).json({ error: 'Недопустимое действие.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT * FROM owned_items WHERE id = $1 AND owner_telegram_id = $2 FOR UPDATE`, [req.params.itemId, req.authUser!.id]);
    const row = found.rows[0];
    if (!row || row.locked || row.equipped_slot) throw new Error('Предмет недоступен.');
    const item = row.item_json;
    const quantity = Number(row.quantity);
    const gold = action === 'sell' ? Math.max(0, Math.min(100000, Number(item.sellPrice || 0))) * quantity : 0;
    const silver = action === 'disassemble' ? Math.max(0, Math.min(100000, Number(item.disassembleYield?.silver || 0))) * quantity : 0;
    const ore = action === 'disassemble' ? Math.max(0, Math.min(1000, Number(item.disassembleYield?.ore || 0))) * quantity : 0;
    await client.query('DELETE FROM owned_items WHERE id = $1', [row.id]);
    await client.query('COMMIT');
    res.json({ ok: true, gold, silver, ore });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось обработать предмет.' });
  } finally { client.release(); }
});

app.get('/api/clan/storage', auth, requireClan, async (req, res) => {
  const clanId = res.locals.clan.id;
  const [stored, personal, events] = await Promise.all([
    pool.query(`SELECT id, item_json, quantity, origin FROM owned_items WHERE clan_id = $1 ORDER BY created_at DESC LIMIT 200`, [clanId]),
    pool.query(`SELECT id, item_json, quantity, locked, bound_clan_id, equipped_slot, origin FROM owned_items WHERE owner_telegram_id = $1 ORDER BY created_at DESC LIMIT 200`, [req.authUser!.id]),
    pool.query(`SELECT e.action, e.item_name, e.quantity, e.gold_delta, e.silver_delta, e.ore_delta, e.created_at, p.display_name
                FROM clan_storage_events e JOIN players p ON p.telegram_id = e.actor_telegram_id
                WHERE e.clan_id = $1 ORDER BY e.id DESC LIMIT 30`, [clanId])
  ]);
  res.json({ stored: stored.rows, personal: personal.rows, events: events.rows, role: res.locals.clan.role });
});

app.post('/api/clan/storage/:itemId/deposit', auth, requireClan, async (req, res) => {
  const clanId = res.locals.clan.id;
  const quantity = Number(req.body?.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return res.status(400).json({ error: 'Неверное количество.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await vaultRole(client, clanId, req.authUser!.id);
    const found = await client.query(`SELECT * FROM owned_items WHERE id = $1 AND owner_telegram_id = $2 FOR UPDATE`, [req.params.itemId, req.authUser!.id]);
    const row = found.rows[0];
    if (!row || row.origin === 'legacy_market_return' || row.locked || row.equipped_slot || row.quantity < quantity || (row.bound_clan_id && row.bound_clan_id !== clanId)) throw new Error('Предмет недоступен для вклада.');
    if (row.quantity === quantity) {
      await client.query(`UPDATE owned_items SET owner_telegram_id = NULL, clan_id = $1, bound_clan_id = $1, updated_at = NOW() WHERE id = $2`, [clanId, row.id]);
    } else {
      await client.query(`UPDATE owned_items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, [quantity, row.id]);
      await client.query(`INSERT INTO owned_items (clan_id, bound_clan_id, item_json, quantity, origin) VALUES ($1,$1,$2::jsonb,$3,$4)`, [clanId, JSON.stringify(row.item_json), quantity, row.origin]);
    }
    await recordVaultEvent(client, clanId, req.authUser!.id, 'deposit', row.item_json, quantity);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось положить предмет.' });
  } finally { client.release(); }
});

app.post('/api/clan/storage/:itemId/withdraw', auth, requireClan, async (req, res) => {
  const clanId = res.locals.clan.id;
  const quantity = Number(req.body?.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return res.status(400).json({ error: 'Неверное количество.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = await vaultRole(client, clanId, req.authUser!.id);
    if (!canUseVault(role)) throw new Error('Забирать вещи могут глава, офицеры и казначей.');
    const found = await client.query(`SELECT * FROM owned_items WHERE id = $1 AND clan_id = $2 FOR UPDATE`, [req.params.itemId, clanId]);
    const row = found.rows[0];
    if (!row || row.quantity < quantity) throw new Error('Предмет уже забрали.');
    if (row.quantity === quantity) {
      await client.query(`UPDATE owned_items SET clan_id = NULL, owner_telegram_id = $1, updated_at = NOW() WHERE id = $2`, [req.authUser!.id, row.id]);
    } else {
      await client.query(`UPDATE owned_items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2`, [quantity, row.id]);
      await client.query(`INSERT INTO owned_items (owner_telegram_id, bound_clan_id, item_json, quantity, origin) VALUES ($1,$2,$3::jsonb,$4,$5)`, [req.authUser!.id, clanId, JSON.stringify(row.item_json), quantity, row.origin]);
    }
    await recordVaultEvent(client, clanId, req.authUser!.id, 'withdraw', row.item_json, quantity);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось забрать предмет.' });
  } finally { client.release(); }
});

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient', 'divine'];
app.post('/api/clan/storage/dispose', auth, requireClan, async (req, res) => {
  const clanId = res.locals.clan.id;
  const action = String(req.body?.action || '');
  const rarity = String(req.body?.upToRarity || '');
  const itemId = req.body?.itemId ? String(req.body.itemId) : '';
  if (!['sell', 'disassemble'].includes(action) || (!itemId && !RARITY_ORDER.includes(rarity))) return res.status(400).json({ error: 'Выберите предмет или предел редкости и действие.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const role = await vaultRole(client, clanId, req.authUser!.id);
    if (!canUseVault(role)) throw new Error('Продавать и разбирать вещи могут глава, офицеры и казначей.');
    const result = await client.query(`SELECT * FROM owned_items WHERE clan_id = $1 ${itemId ? 'AND id = $2' : ''} ORDER BY created_at, id LIMIT 200 FOR UPDATE`, itemId ? [clanId, itemId] : [clanId]);
    const selected = result.rows.filter(row => itemId || RARITY_ORDER.indexOf(String(row.item_json.rarity)) <= RARITY_ORDER.indexOf(rarity));
    if (!selected.length) throw new Error('Подходящих вещей в хранилище нет.');
    let gold = 0, silver = 0, ore = 0;
    for (const row of selected) {
      const qty = Number(row.quantity);
      const item = row.item_json;
      if (action === 'sell') gold += Math.max(0, Math.min(100000, Number(item.sellPrice || 0))) * qty;
      else {
        silver += Math.max(0, Math.min(100000, Number(item.disassembleYield?.silver || 0))) * qty;
        ore += Math.max(0, Math.min(1000, Number(item.disassembleYield?.ore || 0))) * qty;
      }
      await client.query('DELETE FROM owned_items WHERE id = $1', [row.id]);
      await recordVaultEvent(client, clanId, req.authUser!.id, action, item, qty,
        action === 'sell' ? Math.max(0, Math.min(100000, Number(item.sellPrice || 0))) * qty : 0,
        action === 'disassemble' ? Math.max(0, Math.min(100000, Number(item.disassembleYield?.silver || 0))) * qty : 0,
        action === 'disassemble' ? Math.max(0, Math.min(1000, Number(item.disassembleYield?.ore || 0))) * qty : 0);
    }
    await client.query('UPDATE clans SET treasury_gold = treasury_gold + $1, treasury_silver = treasury_silver + $2, treasury_ore = treasury_ore + $3, updated_at = NOW() WHERE id = $4', [gold, silver, ore, clanId]);
    await client.query('COMMIT');
    res.json({ ok: true, count: selected.length, gold, silver, ore });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Не удалось обработать вещи.' });
  } finally { client.release(); }
});

app.post('/api/clan/chat', auth, requireClan, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 500) return res.status(400).json({ error: 'Сообщение: 1–500 символов.' });
  const result = await pool.query(
    `INSERT INTO clan_chat_messages (clan_id, telegram_id, text)
     VALUES ($1, $2, $3)
     RETURNING id, text, created_at`,
    [res.locals.clan.id, req.authUser!.id, text]
  );
  const profile = await pool.query(
    "SELECT COALESCE(NULLIF(BTRIM(character_name), ''), 'Игрок') AS display_name FROM players WHERE telegram_id = $1",
    [req.authUser!.id]
  );
  res.status(201).json({ message: { ...result.rows[0], display_name: profile.rows[0]?.display_name || 'Игрок' } });
});

app.get('/api/chat/global', auth, async (req, res) => {
  const afterId=String(req.query.afterId || '');
  if (afterId && (!/^[0-9]{1,19}$/.test(afterId) || BigInt(afterId)>9223372036854775807n)) {res.status(400).json({error:'Неверный курсор чата.'});return;}
  try {
    const result = await pool.query(
      `SELECT m.id, m.telegram_id, m.text, m.created_at,
              COALESCE(NULLIF(BTRIM(p.character_name), ''), 'Игрок') AS display_name,
              (p.premium_until IS NOT NULL AND p.premium_until > NOW()) AS is_premium
       FROM global_chat_messages m
       JOIN players p ON p.telegram_id = m.telegram_id
       ${afterId ? 'WHERE m.id > $1' : ''}
       ORDER BY m.id ${afterId ? 'ASC' : 'DESC'}
       LIMIT 80`, afterId ? [afterId] : []
    );
    res.json({ messages: afterId ? result.rows : result.rows.reverse() });
  } catch (error) {
    console.error('Global chat read failed:', error);
    res.status(500).json({ error: 'Чат временно недоступен. Сервер не смог прочитать сообщения.' });
  }
});

app.post('/api/chat/global', auth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 500) return res.status(400).json({ error: 'Сообщение: 1–500 символов.' });

  try {
    const result = await pool.query(
      `INSERT INTO global_chat_messages (telegram_id, text)
       VALUES ($1, $2)
       RETURNING id, text, created_at`,
      [req.authUser!.id, text]
    );
    const premiumResult = await pool.query(
      "SELECT COALESCE(NULLIF(BTRIM(character_name), ''), 'Игрок') AS display_name, (premium_until IS NOT NULL AND premium_until > NOW()) AS is_premium FROM players WHERE telegram_id = $1",
      [req.authUser!.id]
    );
    res.status(201).json({
      message: {
        ...result.rows[0],
        telegram_id: req.authUser!.id,
        display_name: premiumResult.rows[0]?.display_name || 'Игрок',
        is_premium: Boolean(premiumResult.rows[0]?.is_premium)
      }
    });
  } catch (error) {
    console.error('Global chat send failed:', error);
    res.status(500).json({ error: 'Чат временно недоступен. Сервер не смог сохранить сообщение.' });
  }
});

app.get('/api/market/listings', auth, async (req, res) => {
  const type = String(req.query.type || '').trim();
  const params: unknown[] = [];
  const typeFilter = type ? `AND item_json->>'type' = $1` : '';
  if (type) params.push(type);
  const result = await pool.query(
    `SELECT l.id, l.seller_telegram_id, l.item_json, l.quantity, l.price_gold, l.created_at, COALESCE(NULLIF(BTRIM(p.character_name), ''), 'Игрок') AS display_name
     FROM market_listings l JOIN players p ON p.telegram_id = l.seller_telegram_id
     WHERE l.status = 'active' AND l.verified AND l.expires_at > NOW() ${typeFilter}
     ORDER BY l.created_at DESC LIMIT 100`, params
  );
  res.json({ listings: result.rows });
});

app.post('/api/market/residents', auth, async (req, res) => {
  try { res.json(await sellToResidents(pool, req.authUser!.id, Number(req.get('X-Game-Reset-Version') || 0), req.body)); }
  catch (error) { res.status(400).json({error: error instanceof Error ? error.message : 'Не удалось продать предмет.'}); }
});

app.post('/api/market/list', auth, async (req, res) => {
  try {
    const listing = await createMarketListing(pool,req.authUser!.id,req.body,Number(req.get('X-Game-Reset-Version') || 0));
    const profile = await pool.query("SELECT COALESCE(NULLIF(BTRIM(character_name), ''), 'Игрок') AS display_name FROM players WHERE telegram_id=$1", [req.authUser!.id]);
    res.status(201).json({listing:{...listing,display_name:profile.rows[0]?.display_name || 'Игрок'}});
  } catch(error) {res.status(400).json({error:error instanceof Error?error.message:'Не удалось выставить предмет.'});}
});

app.get('/api/market/income', auth, async (req, res) => {
  const result = await pool.query('SELECT market_gold FROM players WHERE telegram_id=$1',[req.authUser!.id]);
  res.json({ balanceGold:Number(result.rows[0].market_gold) });
});
app.get('/api/market/mine', auth, async (req, res) => {
  await returnExpiredMarketListings(pool,req.authUser!.id);
  const result = await pool.query("SELECT id,item_json,quantity,price_gold,expires_at,verified FROM market_listings WHERE seller_telegram_id=$1 AND status='active' ORDER BY created_at DESC",[req.authUser!.id]);
  res.json({listings:result.rows});
});
app.post('/api/market/:listingId/return', auth, async (req, res) => {
  try { res.json(await returnMarketListing(pool,req.authUser!.id,String(req.params.listingId),Number(req.get('X-Game-Reset-Version') || 0))); }
  catch(error) { res.status(400).json({error:error instanceof Error?error.message:'Возврат не удался.'}); }
});
app.post('/api/market/:listingId/buy', auth, async (req, res) => {
  try { res.json(await buyMarketListing(pool,req.authUser!.id,String(req.params.listingId),req.body,Number(req.get('X-Game-Reset-Version') || 0))); }
  catch(error) { res.status(400).json({error:error instanceof Error?error.message:'Покупка не удалась.'}); }
});

app.get('/api/premium/status', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT premium_until, premium_charge_id
     FROM players
     WHERE telegram_id = $1`,
    [req.authUser!.id]
  );
  const premiumUntil = result.rows[0]?.premium_until ? new Date(result.rows[0].premium_until) : null;
  res.json({
    active: Boolean(premiumUntil && premiumUntil.getTime() > Date.now()),
    premiumUntil: premiumUntil?.toISOString() || null,
    priceStars: PREMIUM_PRICE_STARS,
    periodDays: 30
  });
});

app.post('/api/premium/invoice', auth, async (req, res) => {
  try {
    const status = await pool.query(
      'SELECT premium_until, preferred_language FROM players WHERE telegram_id = $1',
      [req.authUser!.id]
    );
    const currentUntil = status.rows[0]?.premium_until ? new Date(status.rows[0].premium_until) : null;
    if (currentUntil && currentUntil.getTime() > Date.now()) {
      return res.json({ alreadyActive: true, premiumUntil: currentUntil.toISOString() });
    }

    const payload = `aethelgard_premium:${req.authUser!.id}`;
    const invoiceLink = await telegramBotApi<string>('createInvoiceLink', {
      title: 'Aethelgard Premium',
      description: translateText('Premium на 30 дней: автобой, автопродолжение серии и расширенные настройки автобоя.', messageLanguage(req.get('X-Game-Language'),status.rows[0]?.preferred_language)),
      payload,
      currency: 'XTR',
      prices: [{ label: translateText('Aethelgard Premium · 30 дней', messageLanguage(req.get('X-Game-Language'),status.rows[0]?.preferred_language)), amount: PREMIUM_PRICE_STARS }],
      subscription_period: PREMIUM_PERIOD_SECONDS
    });

    res.json({
      invoiceLink,
      priceStars: PREMIUM_PRICE_STARS,
      periodDays: 30
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать счёт Telegram Stars.';
    console.error('Premium invoice creation failed:', error);
    res.status(502).json({ error: `Telegram Stars: ${message}` });
  }
});

app.post('/api/telegram/webhook', async (req, res) => {
  const receivedSecret = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  if (!telegramWebhookSecret || receivedSecret !== telegramWebhookSecret) {
    return res.status(403).json({ error: 'Invalid Telegram webhook secret.' });
  }

  const update = req.body || {};

  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    const valid =
      query.currency === 'XTR' &&
      Number(query.total_amount) === PREMIUM_PRICE_STARS &&
      String(query.invoice_payload || '').startsWith('aethelgard_premium:');

    await telegramBotApi('answerPreCheckoutQuery', {
      pre_checkout_query_id: query.id,
      ok: valid,
      ...(valid ? {} : { error_message: 'Некорректная Premium-подписка.' })
    });

    return res.json({ ok: true });
  }

  const message = update.message || update.edited_message;
  if (await recordTelegramWriteAccess(pool, message)) return res.json({ok:true});
  if (message?.chat?.type === 'private' && message?.from?.id && String(message.text || '').startsWith('/start')) {
    const userId = Number(message.from.id);
    const profile=await pool.query(`INSERT INTO players (telegram_id, display_name, bot_started, preferred_language) VALUES ($1,$2,TRUE,$3) ON CONFLICT (telegram_id) DO UPDATE SET bot_started = TRUE, preferred_language = COALESCE(players.preferred_language,EXCLUDED.preferred_language) RETURNING preferred_language`,[userId,String(message.from.first_name || 'Игрок'),messageLanguage(null,message.from.language_code)]);
    const language=messageLanguage(profile.rows[0]?.preferred_language,message.from.language_code);
    const referral = String(message.text).match(/^\/start(?:@\w+)?\s+ref_(\d+)$/);
    if (referral && Number(referral[1]) !== userId) {
      await pool.query(`UPDATE players SET referred_by = $1 WHERE telegram_id = $2 AND referred_by IS NULL AND created_at > NOW() - INTERVAL '10 minutes' AND EXISTS (SELECT 1 FROM players WHERE telegram_id = $1 AND created_at < (SELECT created_at FROM players WHERE telegram_id = $2))`,[referral[1],userId]);
    }
    await telegramBotApi('sendMessage',gameMessagePayload(userId,'⚔️ Добро пожаловать в Аэтельгард!\n\nНажмите «Играть», чтобы открыть игру. Уведомления об энергии, шахте и других событиях можно включить в разделе «Оповещения» в игре.\n\nПриведите нового друга: когда он достигнет 10 уровня, вы оба получите игровой Premium на 3 дня.',publicBaseUrl,language));
    const menu=gameMenuButton(publicBaseUrl,language);
    if(menu)try{await telegramBotApi('setChatMenuButton',{chat_id:userId,menu_button:menu});}catch{/* The welcome still includes its Play button. */}
    return res.json({ok:true});
  }
  const payment = message?.successful_payment;
  if (payment) {
    const payload = String(payment.invoice_payload || '');
    const match = payload.match(/^aethelgard_premium:(\d+)$/);
    const telegramId = Number(message?.from?.id || 0);

    if (
      match &&
      telegramId &&
      Number(match[1]) === telegramId &&
      payment.currency === 'XTR' &&
      Number(payment.total_amount) === PREMIUM_PRICE_STARS
    ) {
      const expiresAtSeconds = Number(payment.subscription_expiration_date || 0);
      const expiresAt = expiresAtSeconds > 0
        ? new Date(expiresAtSeconds * 1000)
        : new Date(Date.now() + PREMIUM_PERIOD_SECONDS * 1000);

      await pool.query(
        `UPDATE players
         SET premium_until = GREATEST(COALESCE(premium_until,$1::timestamptz),$1::timestamptz),
             premium_charge_id = $2,
             updated_at = NOW()
         WHERE telegram_id = $3`,
        [expiresAt.toISOString(), String(payment.telegram_payment_charge_id || ''), telegramId]
      );

      await pool.query(
        `INSERT INTO premium_payments
          (telegram_id, telegram_payment_charge_id, amount_stars, subscription_expiration_date, is_recurring, is_first_recurring)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (telegram_payment_charge_id) DO NOTHING`,
        [
          telegramId,
          String(payment.telegram_payment_charge_id || ''),
          Number(payment.total_amount),
          expiresAt.toISOString(),
          Boolean(payment.is_recurring),
          Boolean(payment.is_first_recurring)
        ]
      );
      await queueNotification(pool,telegramId,'premium_'+payment.telegram_payment_charge_id,'premium','👑 Оплата принята. Игровой Premium активирован.');
      await queueNotification(pool,telegramId,'premium_expire_'+expiresAt.toISOString(),'premium','👑 Срок игрового Premium истёк.',expiresAt);
    }
  }

  res.json({ ok: true });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error:', req.method, req.path, error);
  if (res.headersSent) return;
  res.status(500).json({
    error: error instanceof Error ? error.message : 'Внутренняя ошибка игрового сервера.'
  });
});

app.use(express.static(path.resolve(__dirname, '../dist'), {
  maxAge: isProduction ? '1d' : 0,
  index: 'index.html',
  setHeaders: (res, filePath) => {
    // Never cache HTML: Telegram Mini App / WebView must always receive
    // the latest Vite asset manifest after a deployment.
    if (isProduction && (/[/\\]assets[/\\][^/\\]+-[\w-]{8,}\.(js|css)$/.test(filePath) || /-[a-f0-9]{12}\.webp$/.test(filePath))) res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

app.get('*', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

const bootstrap = async () => {
  await ensureDatabaseConnection();
  const schema = await fs.readFile(path.resolve(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  if (telegramBotToken && publicBaseUrl && telegramWebhookSecret) {
    try {
      await telegramBotApi('setWebhook', {
        url: publicBaseUrl + '/api/telegram/webhook',
        secret_token: telegramWebhookSecret,
        allowed_updates: ['message', 'pre_checkout_query'],
        drop_pending_updates: false
      });
      console.log('Telegram payment webhook configured.');
    } catch (error) {
      console.error('Failed to configure Telegram payment webhook:', error);
    }
  }

  if (telegramBotToken) {
    const menuButton = gameMenuButton(publicBaseUrl);
    if (menuButton) {
      try { await telegramBotApi('setChatMenuButton', { menu_button: menuButton }); }
      catch (error) { console.error('Could not configure game menu button:', error); }
    }
  }
  startNotificationWorker(() => pool, telegramBotApi, Boolean(telegramBotToken), publicBaseUrl);
  app.listen(port, () => console.log(`Aethelgard server listening on :${port}`));
};

bootstrap().catch(error => {
  console.error(error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
