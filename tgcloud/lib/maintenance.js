// Housekeeping for the single world document: keeps it small so every request stays cheap.
const DAY = 864e5;
const at = row => Date.parse(row?.created_at || row?.updated_at || '') || 0;
const keepRecent = (rows, cutoff) => (rows || []).filter(row => { const t = at(row); return !t || t >= cutoff; });

export function pruneWorld(world, now = Date.now()) {
  const t = world.tables || {}, before = JSON.stringify(t).length;
  // Idempotency receipts only matter for client retries within minutes.
  if (t.game_operations) t.game_operations = keepRecent(t.game_operations, now - 7 * DAY);
  if (t.progress_api_operations) t.progress_api_operations = keepRecent(t.progress_api_operations, now - 7 * DAY);
  if (t.inventory_bulk_disposals) t.inventory_bulk_disposals = keepRecent(t.inventory_bulk_disposals, now - 7 * DAY);
  // Analytics: the admin panel reads at most 30 days.
  for (const name of ['balance_battles', 'balance_sessions', 'balance_progress']) if (t[name]) t[name] = keepRecent(t[name], now - 45 * DAY);
  // Delivered notifications and outbox rows.
  if (t.game_notifications) t.game_notifications = t.game_notifications.filter(n => !n.sent_at || Date.parse(n.sent_at) >= now - 30 * DAY);
  if (t.telegram_outbox) t.telegram_outbox = t.telegram_outbox.filter(o => !o.completed_at || Date.parse(o.completed_at) >= now - 7 * DAY);
  // Add-on tables: each cleans itself when used, this is the safety net for the ones nobody opens any more.
  const old = (name, days, key = 'at') => { if (t[name]) t[name] = t[name].filter(r => { const x = Date.parse(r?.[key] || ''); return !x || x >= now - days * DAY; }); };
  old('ae_clan_raid_runs', 2); old('ae_clan_raid_setups', 2); old('ae_clan_requests', 8); old('ae_clan_invites', 8); old('ae_deposits', 3); old('ae_quest_log', 8); old('ae_clan_goals', 15);
  old('ae_clan_welcomed', 30); old('ae_bug_reports', 30);
  if (t.ae_events) t.ae_events = t.ae_events.filter(e => Date.parse(e.at) > now - (e.acked ? 7 : 14) * DAY).slice(-800);
  for (const name of ['ae_clan_daily', 'ae_clan_chest']) if (t[name]) { const min = new Date(now - 2 * DAY).toISOString().slice(0, 10); t[name] = t[name].filter(r => String(r.day) >= min); }
  if (t.clan_storage_events) t.clan_storage_events = t.clan_storage_events.slice(-400);
  if (t.clan_chat_messages) { const per = new Map(); t.clan_chat_messages = t.clan_chat_messages.slice().reverse().filter(m => { const n = (per.get(m.clan_id) || 0) + 1; per.set(m.clan_id, n); return n <= 200; }).reverse(); }
  return {before, after: JSON.stringify(t).length};
}

// Server-side sanity limits for values the local-save client reports.
export function clampProfileSync(world, userId, body, now = Date.now()) {
  if (!body || typeof body !== 'object') return body;
  const row = (world.tables?.players || []).find(p => String(p.telegram_id) === String(userId));
  const next = {...body};
  const prevLevel = Math.max(1, Number(row?.level) || 1);
  const prevRating = Number.isFinite(Number(row?.arena_rating)) ? Number(row.arena_rating) : 1000;
  const hours = Math.max(0, (now - (Date.parse(row?.updated_at || '') || now)) / 3600e3);
  if (Number.isFinite(Number(next.level))) next.level = Math.max(1, Math.min(Math.floor(Number(next.level)), prevLevel + 5 + Math.floor(hours * 6), 120));
  if (Number.isFinite(Number(next.arenaRating))) next.arenaRating = Math.max(0, Math.min(Math.floor(Number(next.arenaRating)), prevRating + 500 + Math.floor(hours * 200), 10000));
  return next;
}

// Characters migrated to the server-actions model in October still play with the local-save client.
// The engine ignores their profile sync, so their public level/rating froze; apply it here.
export function syncCanonicalProfile(world, userId, body, now = Date.now()) {
  const row = (world.tables?.players || []).find(p => String(p.telegram_id) === String(userId));
  if (!row || row.character_authority !== 'server-actions-v1' || !body) return null;
  const b = clampProfileSync(world, userId, body, now);
  if (Number.isFinite(Number(b.level))) row.level = Number(b.level);
  if (Number.isFinite(Number(b.arenaRating))) row.arena_rating = Number(b.arenaRating);
  if (typeof b.characterName === 'string' && b.characterName.trim()) row.character_name = b.characterName.trim().slice(0, 32);
  if (typeof b.classId === 'string' && /^[a-z_]{2,20}$/.test(b.classId)) row.class_id = b.classId;
  row.updated_at = new Date(now).toISOString();
  return {status: 200, body: {ok: true}};
}
