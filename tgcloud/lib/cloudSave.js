// Cloud save: the hero (the game's local save) shared between devices — Telegram on any phone / PC and the Android app.
// GET  /api/ae-save            → {rev, savedAt, device, level, heroName} (no data) or {rev: 0}
// GET  /api/ae-save?full=1     → the same + data
// POST /api/ae-save {baseRev, device, data, force} → {rev} | 409 {conflict, rev, savedAt, device, level, heroName}
import {db} from 'sdk';
import {encodeDocument, decodeDocument} from './storageCodec.js';

const MAX = 600 * 1024;
const meta = r => r ? {rev: Number(r.rev) || 0, savedAt: r.saved_at, device: r.device, level: Number(r.level) || 1, heroName: r.hero_name || ''} : {rev: 0};

export async function handleCloudSave(input, userId, isAdmin = false) {
  const me = String(userId), method = String(input?.method || 'GET').toUpperCase(), path = String(input?.path || '');
  if (/^\/api\/ae-save\/audit/.test(path)) {  // admin: every hero in the cloud, with the kept previous version
    if (!isAdmin) return {status: 403, body: {error: 'Недостаточно прав.'}};
    const rows = await db.all('SELECT user_id, rev, saved_at, device, level, hero_name FROM cloud_saves ORDER BY saved_at DESC');
    return {status: 200, body: {rows: rows.map(r => ({u: r.user_id, rev: r.rev, at: r.saved_at, dev: r.device, lv: r.level, name: r.hero_name}))}};
  }
  const row = await db.get('SELECT rev, saved_at, device, level, hero_name, data FROM cloud_saves WHERE user_id=:u', {':u': me});
  if (method === 'GET' && /[?&]bak=1/.test(path)) {
    const b = await db.get('SELECT rev, saved_at, device, level, hero_name, data FROM cloud_saves WHERE user_id=:u', {':u': me + '#bak'});
    if (!b) return {status: 404, body: {error: 'Прошлой версии нет.'}};
    let data; try { data = decodeDocument(b.data); } catch { data = b.data; }
    return {status: 200, body: {...meta(b), data}};
  }
  if (method === 'GET') {
    const out = meta(row);
    const b = await db.get('SELECT rev, saved_at, device, level, hero_name FROM cloud_saves WHERE user_id=:u', {':u': me + '#bak'});
    if (b) out.backup = meta(b);
    if (row && /[?&]full=1/.test(path)) { try { out.data = decodeDocument(row.data); } catch { out.data = row.data; } }
    return {status: 200, body: out};
  }
  if (method !== 'POST') return {status: 405, body: {error: 'Метод не поддерживается.'}};
  const b = input.body || {}, data = typeof b.data === 'string' ? b.data : '';
  if (!data || data.length > MAX) return {status: 400, body: {error: 'Сохранение слишком большое или пустое.'}};
  let save; try { save = JSON.parse(data); } catch { return {status: 400, body: {error: 'Повреждённое сохранение.'}}; }
  if (!save?.player || String(save.player.userId) !== me) return {status: 403, body: {error: 'Это сохранение другого игрока.'}};
  const cur = Number(row?.rev) || 0, device = String(b.device || '').slice(0, 40);
  // a lower hero never replaces a higher one silently (old clients included): the player has to choose
  if (row && !b.force && (Number(save.player.level) || 1) < (Number(row.level) || 1)) return {status: 409, body: {conflict: true, lower: true, ...meta(row)}};
  // someone else (another device) saved after this device last synced: do not overwrite silently
  if (row && !b.force && Number(b.baseRev) !== cur && row.device !== device) return {status: 409, body: {conflict: true, ...meta(row)}};
  const now = new Date().toISOString(), level = Math.max(1, Math.min(999, Number(save.player.level) || 1)), name = String(save.player.name || '').slice(0, 40);
  const enc = encodeDocument(data);
  // keep the replaced hero when the new one is weaker or comes from another device: «Вернуть прошлую версию» can bring it back
  if (row && (level < (Number(row.level) || 1) || row.device !== device || b.force)) {
    const bak = me + '#bak';
    await db.run('DELETE FROM cloud_saves WHERE user_id=:u', {':u': bak});
    await db.run('INSERT INTO cloud_saves (user_id, rev, saved_at, device, level, hero_name, data) VALUES (:u, :r, :t, :d, :l, :n, :x)', {':u': bak, ':r': cur, ':t': row.saved_at, ':d': row.device, ':l': Number(row.level) || 1, ':n': row.hero_name || '', ':x': row.data});
  }
  if (row) await db.run('UPDATE cloud_saves SET rev=:r, saved_at=:t, device=:d, level=:l, hero_name=:n, data=:x WHERE user_id=:u', {':r': cur + 1, ':t': now, ':d': device, ':l': level, ':n': name, ':x': enc, ':u': me});
  else await db.run('INSERT INTO cloud_saves (user_id, rev, saved_at, device, level, hero_name, data) VALUES (:u, 1, :t, :d, :l, :n, :x)', {':u': me, ':t': now, ':d': device, ':l': level, ':n': name, ':x': enc});
  return {status: 200, body: {rev: cur + 1, savedAt: now}};
}
