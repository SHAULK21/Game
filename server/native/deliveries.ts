import type {NativeWorld} from './pool';
import {gameMessagePayload} from './messages';
import {APP_URL} from './config';
const time = (value: any) => new Date(value || 0).getTime();
export function claimDeliveries(world: NativeWorld, worker: string, at = Date.now(), limit = 10) {
  const notifications = world.tables.game_notifications || [], outbox = world.tables.telegram_outbox || [];
  const players = new Map((world.tables.players || []).map(row => [String(row.telegram_id), row]));
  const jobs: {kind: string; id: any; worker: string; method: string; payload: any}[] = [];
  const stamp = new Date(at).toISOString(); let suppressed = 0;
  const leased = (row: any) => row.delivery_lease_owner && time(row.delivery_lease_until) > at;
  const lease = (row: any) => {row.delivery_lease_owner = worker; row.delivery_lease_until = new Date(at + 120000).toISOString(); row.attempts = Number(row.attempts || 0) + 1;};
  for (const row of outbox.filter(row => !row.completed_at && Number(row.attempts || 0) < 6 && !leased(row) && time(row.next_attempt_at) <= at).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (jobs.length >= limit) break;
    if (!['sendMessage', 'setChatMenuButton'].includes(row.method)) {row.completed_at = stamp; suppressed++; continue;}
    lease(row); jobs.push({kind: 'outbox', id: row.id, worker, method: row.method, payload: row.payload});
  }
  for (const row of notifications.filter(row => !row.sent_at && time(row.due_at) <= at && time(row.next_attempt_at) <= at && Number(row.attempts || 0) < 6 && !leased(row)).sort((a, b) => time(a.due_at) - time(b.due_at))) {
    if (jobs.length >= limit) break;
    const player = players.get(String(row.telegram_id));
    let skip = !player?.bot_started || player.notification_settings?.enabled !== true || player.notification_settings?.[row.category] === false;
    if (!skip && ['energy', 'mining', 'arena'].includes(row.category)) {
      skip = time(row.due_at) < at - 86400000 || notifications.some(other => String(other.telegram_id) === String(row.telegram_id) && other.category === row.category && (time(other.due_at) > time(row.due_at) || time(other.due_at) === time(row.due_at) && Number(other.id) > Number(row.id))) ||
        row.category === 'energy' && notifications.some(other => String(other.telegram_id) === String(row.telegram_id) && other.category === 'energy' && time(other.sent_at) > at - 1800000 && !other.read_at);
    }
    if (!skip && row.category === 'premium' && String(row.event_key).startsWith('premium_expire_') && time(player!.premium_until) > at) skip = true;
    if (skip) {row.sent_at = stamp; row.read_at = stamp; suppressed++; continue;}
    lease(row); jobs.push({kind: 'notification', id: row.id, worker, method: 'sendMessage', payload: gameMessagePayload(Number(row.telegram_id), row.text, APP_URL, player!.preferred_language === 'uk' ? 'uk' : 'ru')});
  }
  return {jobs, suppressed};
}
export function acknowledgeDelivery(world: NativeWorld, job: {kind: string; id: any; worker: string}, result: {ok: boolean; blocked?: boolean}, at = Date.now()) {
  const table = job.kind === 'outbox' ? 'telegram_outbox' : 'game_notifications';
  const row = (world.tables[table] || []).find(row => String(row.id) === String(job.id));
  if (!row || row.delivery_lease_owner !== job.worker) return {acknowledged: false};
  row.delivery_lease_owner = null; row.delivery_lease_until = null;
  if (result.ok) row[job.kind === 'outbox' ? 'completed_at' : 'sent_at'] = new Date(at).toISOString();
  else {
    row.next_attempt_at = new Date(at + 300000).toISOString();
    if (result.blocked && job.kind === 'notification') {const player = (world.tables.players || []).find(player => String(player.telegram_id) === String(row.telegram_id)); if (player) player.bot_started = false;}
  }
  return {acknowledged: true};
}
