import type {Express, RequestHandler} from 'express';
import {NativePool} from './pool';
import {resetPlayerAccount, AccountResetError} from '../accountReset';
import {queueNotification} from '../socialFeatures';
import {validTelemetryEvent} from '../balanceTelemetry';
import {BROADCAST_AUDIENCES, NOTIFICATION_TEMPLATES, renderBroadcast} from '../../src/utils/notificationTemplates';
import {BOT_USERNAME} from './config';
import {balanceAnalytics, playerAnalytics} from './analytics';
const same = (a: any, b: any) => a != null && b != null && String(a) === String(b);
const uuid = (value: any) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function registerNativeAdmin(app: Express, native: NativePool, auth: RequestHandler, options: {isAdmin?: (id: number) => boolean} = {}) {
  const table = (name: string) => native.table(name), now = () => native.now(), stamp = () => new Date(now()).toISOString();
  const player = (id: any) => table('players').find(row => same(row.telegram_id, id))!;
  const admin: RequestHandler = (req, res, next) => {if (options.isAdmin?.(req.authUser!.id) !== true) {res.status(403).json({error: 'Только администратор.'}); return;} next();};
  app.get('/api/admin/players', auth, admin, (req, res) => {
    const search = String(req.query.search || '').trim().slice(0, 80).replace(/^@/, '').toLowerCase();
    res.json({players: table('players').filter(row => !search || String(row.telegram_id) === search || [row.character_name, row.display_name, row.username].filter(Boolean).join(' ').toLowerCase().includes(search))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) || Number(a.telegram_id) - Number(b.telegram_id)).slice(0, 50)
      .map(row => ({telegramId: row.telegram_id, username: row.username, displayName: row.display_name, characterName: row.character_name ?? null, level: row.level, resetVersion: Number(row.reset_version), inClan: row.clan_id != null}))});
  });
  app.post('/api/admin/players/:targetId/reset', auth, admin, async (req, res) => {
    const target = Number(req.params.targetId), {operationId, expectedVersion, confirmTargetId} = req.body || {};
    if (!Number.isSafeInteger(target) || target <= 0 || String(confirmTargetId) !== String(target) || !uuid(operationId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {res.status(400).json({error: 'Выберите игрока и подтвердите сброс его прогресса.'}); return;}
    try {res.json(await resetPlayerAccount(native.asPool(), req.authUser!.id, target, operationId, expectedVersion));}
    catch (error) {if (!(error instanceof AccountResetError)) throw error; res.status(409).json({error: error.message});}
  });
  app.post('/api/admin/premium/self', auth, admin, async (req, res) => {
    const days = Number(req.body?.days ?? 30), id = req.body?.operationId;
    if (!uuid(id) || !Number.isInteger(days) || days < 1 || days > 365) {res.status(400).json({error: 'Укажите 1–365 дней и ID операции.'}); return;}
    const row = player(req.authUser!.id), previous = table('admin_premium_grants').find(row => row.id === id);
    if (previous && (!same(previous.telegram_id, req.authUser!.id) || Number(previous.days) !== days)) {res.status(409).json({error: 'ID операции уже использован.'}); return;}
    if (!previous) {table('admin_premium_grants').push({id, telegram_id: req.authUser!.id, days, created_at: stamp()}); row.premium_until = new Date(Math.max(now(), new Date(row.premium_until || 0).getTime()) + days * 86400000).toISOString();}
    await queueNotification(native.asPool(), req.authUser!.id, 'premium_expire_' + row.premium_until, 'premium', '👑 Срок игрового Premium истёк.', new Date(row.premium_until)); res.json({premiumUntil: row.premium_until});
  });
  const audience = (name: string, row: any) => name === 'all' || name === 'premium' && new Date(row.premium_until || 0).getTime() > now() || name === 'regular' && new Date(row.premium_until || 0).getTime() <= now() || name === 'active' && new Date(row.updated_at).getTime() >= now() - 7 * 86400000;
  const eligible = (row: any) => row.bot_started && row.notification_settings?.enabled === true && row.notification_settings?.announcements !== false;
  app.get('/api/admin/broadcasts', auth, admin, (_req, res) => {
    const audiences: Record<string, any> = {};
    for (const name of Object.keys(BROADCAST_AUDIENCES)) {const rows = table('players').filter(row => audience(name, row)); audiences[name] = {players: rows.length, telegram: rows.filter(eligible).length};}
    const recent = [...table('admin_broadcasts')].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10).map(row => ({id: row.id, template_id: row.template_id, audience: row.audience, players_count: row.players_count, telegram_count: row.telegram_count, created_at: row.created_at}));
    res.json({templates: NOTIFICATION_TEMPLATES, audiences, recent});
  });
  app.post('/api/admin/broadcasts', auth, admin, async (req, res) => {
    try {
      const {operationId, templateId, audience: name, details = ''} = req.body || {};
      if (!uuid(operationId) || !Object.hasOwn(BROADCAST_AUDIENCES, String(name))) throw new Error('Выберите аудиторию и ID операции.');
      const text = renderBroadcast(templateId, details), previous = table('admin_broadcasts').find(row => row.id === operationId);
      if (previous) {if (!same(previous.admin_id, req.authUser!.id) || previous.template_id !== templateId || previous.audience !== name || previous.text !== text) throw new Error('Параметры повторной рассылки не совпадают.'); res.json({id: previous.id, players: Number(previous.players_count), telegram: Number(previous.telegram_count), replayed: true}); return;}
      let players = 0, telegram = 0;
      for (const row of table('players').filter(row => audience(name, row))) {
        const key = 'broadcast_' + operationId;
        if (table('game_notifications').some(entry => same(entry.telegram_id, row.telegram_id) && entry.event_key === key)) continue;
        const body = text + (templateId === 'referral' ? '\n\nВаша ссылка для друга: https://t.me/' + BOT_USERNAME + '?start=ref_' + row.telegram_id : '');
        await queueNotification(native.asPool(), Number(row.telegram_id), key, 'announcements', body, new Date(now()));
        const entry = table('game_notifications').find(entry => same(entry.telegram_id, row.telegram_id) && entry.event_key === key)!;
        if (eligible(row)) telegram++; else entry.sent_at = stamp(); players++;
      }
      table('admin_broadcasts').push({id: operationId, admin_id: req.authUser!.id, template_id: templateId, audience: name, text, players_count: players, telegram_count: telegram, created_at: stamp()});
      res.json({id: operationId, players, telegram, replayed: false});
    } catch (error) {res.status(400).json({error: error instanceof Error ? error.message : 'Не удалось создать рассылку.'});}
  });
  app.post('/api/telemetry', auth, (req, res) => {
    const events = req.body?.events;
    if (!Array.isArray(events) || !events.length || events.length > 25 || !events.every(validTelemetryEvent)) {res.status(400).json({error: 'Некорректные метрики.'}); return;}
    for (const e of events) {
      if (e.kind === 'session') {
        const previous = table('balance_sessions').find(row => same(row.telegram_id, req.authUser!.id) && row.id === e.id);
        if (previous && Number(previous.sequence) >= e.sequence) continue;
        const row = {telegram_id: req.authUser!.id, id: e.id, sequence: e.sequence, level: e.level, duration_ms: e.durationMs, net_gold: e.netGold, net_silver: e.netSilver,
          start_level: previous?.start_level ?? e.startLevel ?? null, max_level: Math.max(Number(previous?.max_level || 0), e.maxLevel ?? e.level),
          last_screen: e.screen ?? previous?.last_screen ?? null, last_state: e.state ?? previous?.last_state ?? null, energy: e.energy ?? previous?.energy ?? null,
          created_at: previous?.created_at ?? stamp(), updated_at: stamp()};
        if (previous) Object.assign(previous, row); else table('balance_sessions').push(row);
        if (e.startLevel !== undefined) {
          const checkpoint = table('balance_progress').find(row => same(row.telegram_id, req.authUser!.id) && row.session_id === e.id && row.level === e.level);
          if (checkpoint) checkpoint.active_ms = Math.min(Number(checkpoint.active_ms), e.durationMs);
          else table('balance_progress').push({telegram_id: req.authUser!.id, session_id: e.id, level: e.level, active_ms: e.durationMs, created_at: stamp()});
        }
      } else if (!table('balance_battles').some(row => same(row.telegram_id, req.authUser!.id) && row.id === e.id)) table('balance_battles').push({telegram_id: req.authUser!.id, id: e.id, session_id: e.sessionId, level: e.level, class_id: e.classId, region: e.region, monster: e.monster, difficulty: e.difficulty, outcome: e.outcome, rounds: e.rounds, duration_ms: e.durationMs, gold: e.gold, silver: e.silver, exp: e.exp, role: e.role || 'unknown', created_at: stamp()});
    }
    const day = new Date(now()).toISOString().slice(0, 10);
    if (!table('balance_activity').some(row => same(row.telegram_id, req.authUser!.id) && String(row.day).slice(0, 10) === day)) table('balance_activity').push({telegram_id: req.authUser!.id, day});
    res.json({ok: true});
  });
  app.get('/api/admin/balance', auth, admin, (_req, res) => {res.json(balanceAnalytics(native));});
  app.get('/api/admin/player-analytics', auth, admin, (req, res) => {
    const days = Number(req.query.days || 30); if (![7, 30, 90].includes(days)) {res.status(400).json({error: 'Период: 7, 30 или 90 дней.'}); return;}
    res.json(playerAnalytics(native, days, req.authUser!.id));
  });
}
