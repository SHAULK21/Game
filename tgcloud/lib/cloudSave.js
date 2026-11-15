// Cloud save: the hero (the game's local save) shared between devices — Telegram on any phone / PC and the Android app.
// GET  /api/ae-save            → {rev, savedAt, device, level, heroName} (no data) or {rev: 0}
// GET  /api/ae-save?full=1     → the same + data
// POST /api/ae-save {baseRev, device, data, force} → {rev} | 409 {conflict, rev, savedAt, device, level, heroName}
import {db} from 'sdk';
import {encodeDocument, decodeDocument} from './storageCodec.js';

const MAX = 600 * 1024;
const meta = r => r ? {rev: Number(r.rev) || 0, savedAt: r.saved_at, device: r.device, level: Number(r.level) || 1, heroName: r.hero_name || ''} : {rev: 0};

export async function handleCloudSave(input, userId) {
  const me = String(userId), method = String(input?.method || 'GET').toUpperCase(), path = String(input?.path || '');
  const row = await db.get('SELECT rev, saved_at, device, level, hero_name, data FROM cloud_saves WHERE user_id=:u', {':u': me});
  if (method === 'GET') {
    const out = meta(row);
    if (row && /[?&]full=1/.test(path)) { try { out.data = decodeDocument(row.data); } catch { out.data = row.data; } }
    return {status: 200, body: out};
  }
  if (method !== 'POST') return {status: 405, body: {error: 'Метод не поддерживается.'}};
  const b = input.body || {}, data = typeof b.data === 'string' ? b.data : '';
  if (!data || data.length > MAX) return {status: 400, body: {error: 'Сохранение слишком большое или пустое.'}};
  let save; try { save = JSON.parse(data); } catch { return {status: 400, body: {error: 'Повреждённое сохранение.'}}; }
  if (!save?.player || String(save.player.userId) !== me) return {status: 403, body: {error: 'Это сохранение другого игрока.'}};
  const cur = Number(row?.rev) || 0, device = String(b.device || '').slice(0, 40);
  // someone else (another device) saved after this device last synced: do not overwrite silently
  if (row && !b.force && Number(b.baseRev) !== cur && row.device !== device) return {status: 409, body: {conflict: true, ...meta(row)}};
  const now = new Date().toISOString(), level = Math.max(1, Math.min(999, Number(save.player.level) || 1)), name = String(save.player.name || '').slice(0, 40);
  const enc = encodeDocument(data);
  if (row) await db.run('UPDATE cloud_saves SET rev=:r, saved_at=:t, device=:d, level=:l, hero_name=:n, data=:x WHERE user_id=:u', {':r': cur + 1, ':t': now, ':d': device, ':l': level, ':n': name, ':x': enc, ':u': me});
  else await db.run('INSERT INTO cloud_saves (user_id, rev, saved_at, device, level, hero_name, data) VALUES (:u, 1, :t, :d, :l, :n, :x)', {':u': me, ':t': now, ':d': device, ':l': level, ':n': name, ':x': enc});
  return {status: 200, body: {rev: cur + 1, savedAt: now}};
}
