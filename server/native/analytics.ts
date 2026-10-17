import type {NativePool} from './pool';
const ms = (value: any) => new Date(value || 0).getTime();
const same = (a: any, b: any) => String(a) === String(b);
const mean = (rows: any[], get: (row: any) => number, divisor = 1) => rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(get(row)), 0) / rows.length / divisor * 10) / 10 : null;
function groups(rows: any[], key: (row: any) => string): any[][] {
  const map = new Map<string, any[]>(); for (const row of rows) {const id = key(row); if (!map.has(id)) map.set(id, []); map.get(id)!.push(row);} return [...map.values()];
}
export function balanceAnalytics(native: NativePool) {
  const table = (name: string) => native.table(name), now = native.now();
  const battles = groups(table('balance_battles').filter(row => ms(row.created_at) >= now - 30 * 86400000), row => JSON.stringify([row.level < 25 ? '1–24' : row.level < 55 ? '25–54' : '55+', row.region, row.difficulty, row.class_id, row.role]))
    .map(rows => ({band: rows[0].level < 25 ? '1–24' : rows[0].level < 55 ? '25–54' : '55+', region: rows[0].region, difficulty: rows[0].difficulty, class_id: rows[0].class_id, role: rows[0].role,
      battles: rows.length, seconds: mean(rows, row => row.duration_ms, 1000), rounds: mean(rows, row => row.rounds), win_rate: Math.round(rows.filter(row => row.outcome === 'victory').length / rows.length * 1000) / 10, exp: mean(rows, row => row.exp)}))
    .sort((a, b) => JSON.stringify([a.band, a.region, a.difficulty, a.class_id, a.role]).localeCompare(JSON.stringify([b.band, b.region, b.difficulty, b.class_id, b.role])));
  const sessions = table('balance_sessions').filter(row => ms(row.created_at) >= now - 30 * 86400000 && row.duration_ms >= 60000);
  const retention = {eligible_d1: 0, returned_d1: 0, eligible_d7: 0, returned_d7: 0};
  const today = Date.parse(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z');
  for (const rows of groups(table('balance_activity'), row => String(row.telegram_id))) {
    const first = Math.min(...rows.map(row => Date.parse(String(row.day).slice(0, 10) + 'T00:00:00Z')));
    if (first < today - 30 * 86400000) continue;
    for (const day of [1, 7] as const) if (first <= today - (day + 1) * 86400000) {
      retention[day === 1 ? 'eligible_d1' : 'eligible_d7']++;
      if (rows.some(row => Date.parse(String(row.day).slice(0, 10) + 'T00:00:00Z') === first + day * 86400000)) retention[day === 1 ? 'returned_d1' : 'returned_d7']++;
    }
  }
  return {battles, sessions: {sessions: sessions.length, minutes: mean(sessions, row => row.duration_ms, 60000), net_gold: mean(sessions, row => row.net_gold), net_silver: mean(sessions, row => row.net_silver)}, retention, source: 'client_diagnostics'};
}
export function playerAnalytics(native: NativePool, days: number, adminId: number) {
  const table = (name: string) => native.table(name), now = native.now();
  const people = groups(table('balance_sessions').filter(row => !same(row.telegram_id, adminId)), row => String(row.telegram_id)).map(rows => {
    const first = [...rows].sort((a, b) => ms(a.created_at) - ms(b.created_at) || String(a.id).localeCompare(String(b.id)))[0];
    const last = [...rows].sort((a, b) => ms(b.updated_at) - ms(a.updated_at) || ms(b.created_at) - ms(a.created_at) || String(a.id).localeCompare(String(b.id)))[0];
    return {telegram_id: first.telegram_id, first_seen: first.created_at, last_seen: rows.reduce((value, row) => ms(row.updated_at) > ms(value) ? row.updated_at : value, first.updated_at), sessions: rows.length,
      reached_level: Math.max(...rows.map(row => Number(row.max_level ?? row.level))), active_ms: rows.reduce((sum, row) => sum + Number(row.duration_ms), 0),
      start_level: first.start_level, first_ms: first.duration_ms, last_level: last.level, last_screen: last.last_screen, last_state: last.last_state, energy: last.energy, last_session_id: last.id};
  }).filter(row => ms(row.first_seen) >= now - days * 86400000);
  const newcomers = people.filter(row => row.start_level === 1), inactive = (row: any) => ms(row.last_seen) < now - 86400000;
  const summary = {players: people.length, newcomers: newcomers.length, returned: people.filter(row => row.sessions > 1).length, inactive_24h: people.filter(inactive).length,
    stopped_early: newcomers.filter(row => row.reached_level <= 3 && inactive(row)).length, first_minutes: mean(people, row => row.first_ms, 60000), total_minutes: mean(people, row => row.active_ms, 60000),
    collecting_since: people.length ? [...people].sort((a, b) => ms(a.first_seen) - ms(b.first_seen))[0].first_seen : null};
  const funnel = Array.from({length: 10}, (_, index) => ({level: index + 1, eligible: newcomers.length, reached: newcomers.filter(row => row.reached_level >= index + 1).length, inactive_here: newcomers.filter(row => row.last_level === index + 1 && inactive(row)).length}));
  const times: any[] = [];
  for (const person of newcomers) for (const checkpoints of groups(table('balance_progress').filter(row => same(row.telegram_id, person.telegram_id) && row.level <= 10), row => String(row.level))) {
    const ownerSessions = table('balance_sessions').filter(row => same(row.telegram_id, person.telegram_id));
    const located = checkpoints.map(row => ({checkpoint: row, session: ownerSessions.find(session => session.id === row.session_id)})).filter(row => row.session);
    if (!located.length) continue;
    const firstStart = Math.min(...located.map(row => ms(row.session!.created_at)));
    const active = Math.min(...located.filter(row => ms(row.session!.created_at) === firstStart).map(row => Number(row.checkpoint.active_ms))) + ownerSessions.filter(row => ms(row.created_at) < firstStart).reduce((sum, row) => sum + Number(row.duration_ms), 0);
    times.push({level: checkpoints[0].level, active_ms: active});
  }
  const milestones = groups(times, row => String(row.level)).map(rows => ({level: rows[0].level, samples: rows.length, minutes: mean(rows, row => row.active_ms, 60000)})).sort((a, b) => a.level - b.level);
  const personIds = new Set(people.map(row => String(row.telegram_id)));
  const battles = groups(table('balance_battles').filter(row => row.level <= 10 && personIds.has(String(row.telegram_id))), row => String(row.level)).map(rows => ({level: rows[0].level, battles: rows.length,
    defeats: rows.filter(row => row.outcome === 'defeat').length, flees: rows.filter(row => row.outcome === 'flee').length, seconds: mean(rows, row => row.duration_ms, 1000), rounds: mean(rows, row => row.rounds), exp: mean(rows, row => row.exp)})).sort((a, b) => a.level - b.level);
  const joined = people.flatMap(person => {
    const account = table('players').find(row => same(row.telegram_id, person.telegram_id)); if (!account) return [];
    const battle = table('balance_battles').filter(row => same(row.telegram_id, person.telegram_id) && row.session_id === person.last_session_id).sort((a, b) => ms(b.created_at) - ms(a.created_at) || String(b.id).localeCompare(String(a.id)))[0];
    return [{...person, name: account.character_name ?? account.display_name, class_id: account.class_id, preferred_interface: account.preferred_interface, preferred_language: account.preferred_language,
      last_outcome: battle?.outcome ?? null, last_monster: battle?.monster ?? null, last_region: battle?.region ?? null, last_battle_ms: battle?.duration_ms ?? null}];
  });
  const classes = groups(joined.filter(row => row.start_level === 1), row => String(row.class_id)).map(rows => ({class_id: rows[0].class_id, players: rows.length, level4: rows.filter(row => row.reached_level >= 4).length, inactive_early: rows.filter(row => row.reached_level <= 3 && inactive(row)).length})).sort((a, b) => b.players - a.players || String(a.class_id).localeCompare(String(b.class_id)));
  const usage = (key: string, label: string) => groups(joined, row => String(row[key])).map(rows => ({[label]: rows[0][key], players: rows.length})).sort((a, b) => b.players - a.players || String(a[label]).localeCompare(String(b[label])));
  return {days, summary, funnel, milestones, battles, players: [...joined].sort((a, b) => ms(b.last_seen) - ms(a.last_seen) || Number(a.telegram_id) - Number(b.telegram_id)).slice(0, 50), classes,
    interfaceUsage: usage('preferred_interface', 'interface_style'), languageUsage: usage('preferred_language', 'language'), source: 'client_diagnostics'};
}
