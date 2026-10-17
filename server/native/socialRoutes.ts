import type {Express, RequestHandler} from 'express';
import {NativePool} from './pool';
import {CLASS_EQUIPMENT} from '../../src/utils/classEquipment';
import {nextArenaReset, ENERGY_REGEN_MS} from '../../src/utils/gameCadence';
import {NOTIFICATION_CATEGORIES, queueNotification} from '../socialFeatures';
import {translateText} from '../../src/i18n/translate';
import {gameMenuButton} from './messages';
import {APP_URL, BOT_USERNAME} from './config';
const same = (a: any, b: any) => a != null && b != null && String(a) === String(b);
export function registerNativeSocial(app: Express, native: NativePool, auth: RequestHandler, options: {isAdmin?: (id: number) => boolean} = {}) {
  const table = (name: string) => native.table(name), now = () => native.now(), stamp = () => new Date(now()).toISOString();
  const player = (id: any) => table('players').find(row => same(row.telegram_id, id))!;
  const premium = (row: any) => new Date(row.premium_until || 0).getTime() > now();
  const safe = (fn: any, status = 200): RequestHandler => async (req, res) => {
    try {res.status(status).json(await fn(req, res));} catch (error) {res.status(400).json({error: error instanceof Error ? error.message : 'Действие не выполнено.'});}
  };
  const notify = (id: number, key: string, category: string, text: string, at = now()) => queueNotification(native.asPool(), id, key, category, text, new Date(at));
  app.get('/api/health', auth, (_req, res) => {res.json({ok: true, service: 'aethelgard', hosting: 'telegram-serverless', database: {ok: true}, time: stamp()});});
  app.get('/api/profile/state', auth, (req, res) => {res.json({resetVersion: Number(player(req.authUser!.id).reset_version)});});
  app.get('/api/admin/status', auth, (req, res) => {res.json({isAdmin: options.isAdmin?.(req.authUser!.id) === true});});
  app.post('/api/profile/sync', auth, (req, res) => {
    const row = player(req.authUser!.id);
    if (row.character_authority === 'server-actions-v1') {res.json({ok: true, canonical: true}); return;}
    const level = Number(req.body?.level || 1), rating = Number(req.body?.arenaRating ?? 1000);
    row.level = Number.isFinite(level) ? Math.max(1, Math.min(120, Math.floor(level))) : 1;
    row.arena_rating = Number.isFinite(rating) ? Math.max(0, Math.min(2147483647, Math.floor(rating))) : 1000;
    if (typeof req.body?.characterName === 'string' && req.body.characterName.trim()) row.character_name = req.body.characterName.trim();
    if (Object.hasOwn(CLASS_EQUIPMENT, String(req.body?.classId))) row.class_id = req.body.classId;
    row.updated_at = stamp(); res.json({ok: true});
  });
  app.post('/api/profile/heartbeat', auth, (req, res) => {
    const row = player(req.authUser!.id); if (!row.last_seen_at || new Date(row.last_seen_at).getTime() < now() - 60000) row.last_seen_at = stamp(); res.json({ok: true});
  });
  app.get('/api/community/stats', auth, (_req, res) => {res.json({totalPlayers: table('players').length, onlinePlayers: table('players').filter(row => new Date(row.last_seen_at || 0).getTime() >= now() - 300000).length, onlineWindowMinutes: 5});});
  app.get('/api/leaderboard', auth, (_req, res) => {
    res.json({players: [...table('players')].sort((a, b) => Number(b.level) - Number(a.level) || Number(b.arena_rating) - Number(a.arena_rating) || String(a.updated_at).localeCompare(String(b.updated_at))).slice(0, 100)
      .map(row => ({telegram_id: row.telegram_id, character_name: row.character_name?.trim() || 'Игрок', level: row.level, arena_rating: row.arena_rating, is_online: new Date(row.last_seen_at || 0).getTime() >= now() - 300000}))});
  });
  app.get('/api/chat/global', auth, (req, res) => {
    const after = String(req.query.afterId || '');
    if (after && (!/^[0-9]{1,19}$/.test(after) || BigInt(after) > 9223372036854775807n)) {res.status(400).json({error: 'Неверный курсор чата.'}); return;}
    const rows = table('global_chat_messages').filter(row => !after || BigInt(row.id) > BigInt(after)).sort((a, b) => after ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id)).slice(0, 80);
    if (!after) rows.reverse();
    res.json({messages: rows.flatMap(row => {const author = player(row.telegram_id); return author ? [{id: row.id, telegram_id: row.telegram_id, text: row.text, created_at: row.created_at, display_name: author.character_name?.trim() || 'Игрок', is_premium: premium(author)}] : [];})});
  });
  app.post('/api/chat/global', auth, safe((req: any) => {
    const text = String(req.body?.text || '').trim(); if (!text || text.length > 500) throw new Error('Сообщение: 1–500 символов.');
    const id = table('global_chat_messages').reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1;
    const row = {id, telegram_id: req.authUser.id, text, created_at: stamp()}; table('global_chat_messages').push(row);
    return {message: {...row, display_name: player(req.authUser.id).character_name?.trim() || 'Игрок', is_premium: premium(player(req.authUser.id))}};
  }, 201));
  app.get('/api/premium/status', auth, (req, res) => {
    const row = player(req.authUser!.id); res.json({active: premium(row), premiumUntil: row.premium_until ? new Date(row.premium_until).toISOString() : null, priceStars: 150, periodDays: 30});
  });
  app.post('/api/premium/invoice', auth, (req, res) => {
    const row = player(req.authUser!.id); if (premium(row)) {res.json({alreadyActive: true, premiumUntil: new Date(row.premium_until).toISOString()}); return;}
    const language = req.get('X-Game-Language') === 'uk' || row.preferred_language === 'uk' ? 'uk' : 'ru';
    res.locals.effect = {method: 'createInvoiceLink', payload: {title: 'Aethelgard Premium',
      description: translateText('Premium на 30 дней: автобой, автопродолжение серии и расширенные настройки автобоя.', language),
      payload: 'aethelgard_premium:' + req.authUser!.id, currency: 'XTR',
      prices: [{label: translateText('Aethelgard Premium · 30 дней', language), amount: 150}], subscription_period: 30 * 86400}};
    res.json({priceStars: 150, periodDays: 30});
  });
  app.get('/api/notifications', auth, (req, res) => {
    const row = player(req.authUser!.id);
    res.json({settings: row.notification_settings, botStarted: row.bot_started,
      notifications: table('game_notifications').filter(row => same(row.telegram_id, req.authUser!.id) && new Date(row.due_at).getTime() <= now()).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 50).map(row => ({id: row.id, category: row.category, text: row.text, due_at: row.due_at, read_at: row.read_at}))});
  });
  app.post('/api/preferences/language', auth, safe((req: any) => {
    const {language, interfaceStyle} = req.body || {};
    if (!['ru', 'uk'].includes(language) || interfaceStyle !== undefined && !['modern', 'fantasy', 'fantasy-beta'].includes(interfaceStyle)) throw new Error('Unsupported language or interface style.');
    const row = player(req.authUser.id), changed = row.preferred_language !== language; row.preferred_language = language;
    if (interfaceStyle !== undefined) row.preferred_interface = interfaceStyle;
    if (changed && row.bot_started) table('telegram_outbox').push({id: crypto.randomUUID(), method: 'setChatMenuButton', payload: {chat_id: req.authUser.id, menu_button: gameMenuButton(APP_URL, language)}, created_at: stamp(), attempts: 0, completed_at: null});
    return {language};
  }));
  app.post('/api/notifications/settings', auth, (req, res) => {
    const settings: Record<string, boolean> = {enabled: req.body?.enabled === true, onboardingSeen: true};
    for (const category of NOTIFICATION_CATEGORIES) settings[category] = req.body?.[category] !== false;
    const row = player(req.authUser!.id); row.notification_settings = settings;
    if (settings.enabled && req.authUser!.allowsWriteToPm === true) row.bot_started = true;
    res.json({settings});
  });
  app.post('/api/notifications/onboarding', auth, (req, res) => {const row = player(req.authUser!.id); row.notification_settings = {...row.notification_settings, onboardingSeen: true}; res.json({ok: true});});
  app.post('/api/notifications/read', auth, (req, res) => {for (const row of table('game_notifications')) if (same(row.telegram_id, req.authUser!.id) && !row.read_at && new Date(row.due_at).getTime() <= now()) row.read_at = stamp(); res.json({ok: true});});
  app.post('/api/notifications/schedule', auth, safe(async (req: any) => {
    const {energy, maxEnergy, regenAt, miningEndsAt} = req.body || {};
    if (!Number.isFinite(energy) || !Number.isFinite(maxEnergy) || energy < 0 || energy > maxEnergy || maxEnergy < 1 || maxEnergy > 1000) throw new Error('Неверное состояние энергии.');
    const due = Number.isFinite(regenAt) && regenAt > 0 ? Math.min(now(), regenAt) + (maxEnergy - energy) * ENERGY_REGEN_MS : null;
    const entries = [{category: 'energy', due: energy < maxEnergy ? due : null, text: '⚡ Энергия полностью восстановилась. Можно продолжить приключение!'},
      {category: 'arena', due: nextArenaReset(now()), text: '🎟️ Настал новый день арены: доступно до 5 ежедневных билетов. Откройте игру, чтобы обновить их.'},
      {category: 'mining', due: Number.isFinite(miningEndsAt) && miningEndsAt > now() && miningEndsAt < now() + 86400000 ? miningEndsAt : null, text: '⛏️ Шахтёрская экспедиция завершена. Заберите добычу!'}];
    for (const entry of entries) {
      native.world.tables.game_notifications = table('game_notifications').filter(row => !(same(row.telegram_id, req.authUser.id) && row.category === entry.category && !row.sent_at && !row.read_at && !String(row.event_key).startsWith('expedition_')));
      if (entry.due) await notify(req.authUser.id, entry.category + '_' + Math.floor(entry.due / 1000), entry.category, entry.text, entry.due);
    }
    return {ok: true};
  }));
  app.get('/api/referrals', auth, (req, res) => {res.json({url: 'https://t.me/' + BOT_USERNAME + '?start=ref_' + req.authUser!.id, rewardDays: 3, requiredLevel: 10, count: table('referral_rewards').filter(row => same(row.inviter, req.authUser!.id)).length});});
  app.post('/api/referrals/check', auth, safe(async (req: any) => {
    const row = player(req.authUser.id), match = String(req.verifiedStartParam || '').match(/^ref_(\d+)$/);
    if (match && !same(match[1], req.authUser.id) && !row.referred_by && new Date(row.created_at).getTime() > now() - 600000) {
      const inviter = player(match[1]); if (inviter && new Date(inviter.created_at).getTime() < new Date(row.created_at).getTime()) row.referred_by = match[1];
    }
    let rewarded = false;
    if (Number(row.level) >= 10 && row.referred_by && !table('referral_rewards').some(entry => same(entry.invitee, req.authUser.id))) {
      const inviter = player(row.referred_by); if (!inviter) throw new Error('Пригласивший игрок не найден.');
      table('referral_rewards').push({invitee: req.authUser.id, inviter: row.referred_by, created_at: stamp()});
      for (const id of [Number(row.referred_by), req.authUser.id]) {
        const account = player(id); account.premium_until = new Date(Math.max(now(), new Date(account.premium_until || 0).getTime()) + 3 * 86400000).toISOString();
        await notify(id, 'referral_' + req.authUser.id, 'referral', '🎁 Друг достиг 10 уровня! Вам начислен игровой Premium на 3 дня.');
        await notify(id, 'premium_expire_' + account.premium_until, 'premium', '👑 Срок игрового Premium истёк.', new Date(account.premium_until).getTime());
      }
      rewarded = true;
    }
    return {rewarded};
  }));
}
