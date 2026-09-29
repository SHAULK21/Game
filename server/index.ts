import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
    body: JSON.stringify(payload)
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

const ensureGlobalChatSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_chat_messages (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES players(telegram_id) ON DELETE CASCADE,
      text VARCHAR(500) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_global_chat_created
      ON global_chat_messages(created_at DESC);
  `);
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

type AuthUser = { id: number; username?: string; displayName: string };
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

    await pool.query(
      `INSERT INTO players (telegram_id, username, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, display_name = EXCLUDED.display_name, updated_at = NOW()`,
      [req.authUser.id, req.authUser.username || null, req.authUser.displayName]
    );
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
  const level = Math.max(1, Math.min(120, Math.floor(Number(req.body?.level || 1))));
  const arenaRating = Math.max(0, Math.min(10000, Math.floor(Number(req.body?.arenaRating || 1000))));
  await pool.query(
    'UPDATE players SET level = $1, arena_rating = $2, updated_at = NOW() WHERE telegram_id = $3',
    [level, arenaRating, req.authUser!.id]
  );
  res.json({ ok: true });
});

app.get('/api/community/stats', auth, async (_req, res) => {
  const result = await pool.query(
    `SELECT
       COUNT(*)::int AS total_players,
       COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '5 minutes')::int AS online_players
     FROM players`
  );
  res.json({
    totalPlayers: Number(result.rows[0]?.total_players || 0),
    onlinePlayers: Number(result.rows[0]?.online_players || 0),
    onlineWindowMinutes: 5
  });
});

app.get('/api/leaderboard', auth, async (_req, res) => {
  const result = await pool.query(
    `SELECT telegram_id, display_name, username, level, arena_rating
     FROM players
     ORDER BY level DESC, arena_rating DESC, updated_at ASC
     LIMIT 100`
  );
  res.json({ players: result.rows });
});

app.get('/api/clans', auth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const result = await pool.query(
    `SELECT c.id, c.tag, c.name, c.description, c.level, c.xp, c.max_members,
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
    `SELECT c.*, cm.role
     FROM players p
     JOIN clans c ON c.id = p.clan_id
     JOIN clan_members cm ON cm.clan_id = c.id AND cm.telegram_id = p.telegram_id
     WHERE p.telegram_id = $1`,
    [req.authUser!.id]
  );
  if (!result.rows[0]) return res.json({ clan: null });

  const clan = result.rows[0];
  const members = await pool.query(
    `SELECT cm.telegram_id, cm.role, cm.joined_at, p.display_name, p.username
     FROM clan_members cm JOIN players p ON p.telegram_id = cm.telegram_id
     WHERE cm.clan_id = $1
     ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, cm.joined_at ASC`,
    [clan.id]
  );
  const messages = await pool.query(
    `SELECT m.id, m.text, m.created_at, p.display_name, p.username
     FROM clan_chat_messages m JOIN players p ON p.telegram_id = m.telegram_id
     WHERE m.clan_id = $1 ORDER BY m.created_at DESC LIMIT 50`,
    [clan.id]
  );
  res.json({ clan, members: members.rows, messages: messages.rows.reverse() });
});

app.post('/api/clan/create', auth, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const tag = String(req.body?.tag || '').trim().toUpperCase();
  const description = String(req.body?.description || '').trim();

  if (!/^[A-ZА-ЯЁ0-9]{2,6}$/.test(tag)) return res.status(400).json({ error: 'Тег: 2–6 букв или цифр.' });
  if (name.length < 3 || name.length > 32) return res.status(400).json({ error: 'Название: 3–32 символа.' });
  if (description.length > 280) return res.status(400).json({ error: 'Описание слишком длинное.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query('SELECT clan_id FROM players WHERE telegram_id = $1 FOR UPDATE', [req.authUser!.id]);
    if (owner.rows[0]?.clan_id) throw new Error('Сначала выйдите из текущего клана.');

    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO clans (id, tag, name, description, owner_telegram_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tag, name, description, req.authUser!.id]
    );
    await client.query(
      `INSERT INTO clan_members (clan_id, telegram_id, role) VALUES ($1, $2, 'owner')`,
      [id, req.authUser!.id]
    );
    await client.query('UPDATE players SET clan_id = $1, updated_at = NOW() WHERE telegram_id = $2', [id, req.authUser!.id]);
    await client.query('COMMIT');
    res.status(201).json({ ok: true, clanId: id });
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Не удалось создать клан.';
    res.status(400).json({ error: message.includes('duplicate') ? 'Такое название или тег уже занят.' : message });
  } finally {
    client.release();
  }
});

app.post('/api/clan/:clanId/join', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const player = await client.query('SELECT clan_id FROM players WHERE telegram_id = $1 FOR UPDATE', [req.authUser!.id]);
    if (player.rows[0]?.clan_id) throw new Error('Вы уже состоите в клане.');

    const clan = await client.query(
      `SELECT c.id, c.max_members, COUNT(cm.telegram_id)::int AS members
       FROM clans c LEFT JOIN clan_members cm ON cm.clan_id = c.id
       WHERE c.id = $1 GROUP BY c.id FOR UPDATE`,
      [req.params.clanId]
    );
    if (!clan.rows[0]) throw new Error('Клан не найден.');
    if (clan.rows[0].members >= clan.rows[0].max_members) throw new Error('Клан заполнен.');

    await client.query('INSERT INTO clan_members (clan_id, telegram_id) VALUES ($1, $2)', [req.params.clanId, req.authUser!.id]);
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
  const clan = res.locals.clan;
  if (clan.role === 'owner') return res.status(400).json({ error: 'Перед выходом передайте руководство другому игроку.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM clan_members WHERE clan_id = $1 AND telegram_id = $2', [clan.id, req.authUser!.id]);
    await client.query('UPDATE players SET clan_id = NULL, updated_at = NOW() WHERE telegram_id = $1', [req.authUser!.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Ошибка выхода из клана.' });
  } finally {
    client.release();
  }
});

app.post('/api/clan/donate', auth, requireClan, async (req, res) => {
  const amount = Math.floor(Number(req.body?.amount));
  if (!Number.isInteger(amount) || amount < 100 || amount > 100000) return res.status(400).json({ error: 'Сумма должна быть от 100 до 100000.' });
  res.status(501).json({ error: 'Казна будет подключена к серверному кошельку персонажа на следующем этапе.' });
});

app.post('/api/clan/raid/attack', auth, requireClan, async (req, res) => {
  const damage = 450 + crypto.randomInt(0, 251);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const clan = await client.query('SELECT * FROM clans WHERE id = $1 FOR UPDATE', [res.locals.clan.id]);
    if (!clan.rows[0]) throw new Error('Клан не найден.');
    let row = clan.rows[0];

    if (new Date(row.raid_reset_at).getTime() <= Date.now()) {
      await client.query(
        `UPDATE clans SET raid_hp = raid_max_hp, raid_reset_at = NOW() + INTERVAL '7 days', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      row.raid_hp = row.raid_max_hp;
    }

    const nextHp = Math.max(0, Number(row.raid_hp) - damage);
    await client.query('UPDATE clans SET raid_hp = $1, updated_at = NOW() WHERE id = $2', [nextHp, row.id]);
    await client.query('COMMIT');
    res.json({ ok: true, raidHp: nextHp, raidMaxHp: Number(row.raid_max_hp), defeated: nextHp === 0 });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка рейда.' });
  } finally {
    client.release();
  }
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
  res.status(201).json({ message: { ...result.rows[0], display_name: req.authUser!.displayName } });
});

app.get('/api/chat/global', auth, async (_req, res) => {
  try {
    await ensureGlobalChatSchema();
    const result = await pool.query(
      `SELECT m.id, m.text, m.created_at, p.display_name, p.username,
              (p.premium_until IS NOT NULL AND p.premium_until > NOW()) AS is_premium
       FROM global_chat_messages m
       JOIN players p ON p.telegram_id = m.telegram_id
       ORDER BY m.created_at DESC
       LIMIT 80`
    );
    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('Global chat read failed:', error);
    res.status(500).json({ error: 'Чат временно недоступен. Сервер не смог прочитать сообщения.' });
  }
});

app.post('/api/chat/global', auth, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 500) return res.status(400).json({ error: 'Сообщение: 1–500 символов.' });

  try {
    await ensureGlobalChatSchema();
    const result = await pool.query(
      `INSERT INTO global_chat_messages (telegram_id, text)
       VALUES ($1, $2)
       RETURNING id, text, created_at`,
      [req.authUser!.id, text]
    );
    const premiumResult = await pool.query(
      'SELECT (premium_until IS NOT NULL AND premium_until > NOW()) AS is_premium FROM players WHERE telegram_id = $1',
      [req.authUser!.id]
    );
    res.status(201).json({
      message: {
        ...result.rows[0],
        display_name: req.authUser!.displayName,
        username: req.authUser!.username,
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
    `SELECT l.id, l.seller_telegram_id, l.item_json, l.quantity, l.price_gold, l.created_at, p.display_name, p.username
     FROM market_listings l JOIN players p ON p.telegram_id = l.seller_telegram_id
     WHERE l.status = 'active' AND l.expires_at > NOW() ${typeFilter}
     ORDER BY l.created_at DESC LIMIT 100`, params
  );
  res.json({ listings: result.rows });
});

app.post('/api/market/list', auth, async (req, res) => {
  const item = req.body?.item;
  const quantity = Math.floor(Number(req.body?.quantity || 1));
  const price = Math.floor(Number(req.body?.price_gold));
  if (!item || typeof item !== 'object') return res.status(400).json({ error: 'Предмет не указан.' });
  if (item.isLocked || item.boundToClan) return res.status(400).json({ error: 'Запертый или клановый предмет нельзя выставить на рынок.' });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return res.status(400).json({ error: 'Количество: 1–999.' });
  if (!Number.isInteger(price) || price < 1 || price > 100000000) return res.status(400).json({ error: 'Цена: 1–100000000 золота.' });
  const safeItem = {
    templateId: String(item.templateId || ''), name: String(item.name || 'Предмет').slice(0, 80),
    type: String(item.type || 'material'), rarity: String(item.rarity || 'common'), level: Number(item.level || 1),
    upgradeLevel: Number(item.upgradeLevel || 0), icon: String(item.icon || '📦'), stats: item.stats || {},
    armorClass: ['heavy', 'medium', 'light'].includes(item.armorClass) ? item.armorClass : undefined,
    weaponClass: ['twoHanded', 'dagger', 'staff', 'shield', 'bow'].includes(item.weaponClass) ? item.weaponClass : undefined,
    description: String(item.description || '').slice(0, 300), sellPrice: Number(item.sellPrice || 0)
  };
  const result = await pool.query(
    `INSERT INTO market_listings (seller_telegram_id, item_json, quantity, price_gold)
     VALUES ($1, $2::jsonb, $3, $4) RETURNING id, item_json, quantity, price_gold, created_at`,
    [req.authUser!.id, JSON.stringify(safeItem), quantity, price]
  );
  res.status(201).json({ listing: { ...result.rows[0], display_name: req.authUser!.displayName } });
});

app.post('/api/market/:listingId/buy', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const listing = await client.query(`SELECT * FROM market_listings WHERE id = $1 AND status = 'active' AND expires_at > NOW() FOR UPDATE`, [req.params.listingId]);
    if (!listing.rows[0]) throw new Error('Лот уже продан или снят.');
    if (Number(listing.rows[0].seller_telegram_id) === req.authUser!.id) throw new Error('Нельзя купить собственный лот.');
    await client.query(`UPDATE market_listings SET status = 'sold' WHERE id = $1`, [req.params.listingId]);
    await client.query('COMMIT');
    res.json({ ok: true, item: listing.rows[0].item_json, quantity: listing.rows[0].quantity, priceGold: listing.rows[0].price_gold, seller: listing.rows[0].seller_telegram_id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error instanceof Error ? error.message : 'Покупка не удалась.' });
  } finally { client.release(); }
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
      'SELECT premium_until FROM players WHERE telegram_id = $1',
      [req.authUser!.id]
    );
    const currentUntil = status.rows[0]?.premium_until ? new Date(status.rows[0].premium_until) : null;
    if (currentUntil && currentUntil.getTime() > Date.now()) {
      return res.json({ alreadyActive: true, premiumUntil: currentUntil.toISOString() });
    }

    const payload = `aethelgard_premium:${req.authUser!.id}`;
    const invoiceLink = await telegramBotApi<string>('createInvoiceLink', {
      title: 'Aethelgard Premium',
      description: 'Premium на 30 дней: автобой, автопродолжение серии и расширенные настройки автобоя.',
      payload,
      currency: 'XTR',
      prices: [{ label: 'Aethelgard Premium · 30 дней', amount: PREMIUM_PRICE_STARS }],
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
         SET premium_until = $1,
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
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

app.get('*', async (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

const bootstrap = async () => {
  await ensureDatabaseConnection();
  const schema = await fs.readFile(path.resolve(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await ensureGlobalChatSchema();

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
