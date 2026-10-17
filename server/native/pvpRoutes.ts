import type {Express, RequestHandler} from 'express';
import {NativePool} from './pool';
import {PVP_CLASSES, PVP_STANCES, pvpRatingDelta, simulateDuel, type PvpStance} from '../../src/utils/pvp';
import {nextArenaReset} from '../../src/utils/gameCadence';
import {queueNotification} from '../socialFeatures';
const same = (a: any, b: any) => a != null && b != null && String(a) === String(b);
const uuid = (value: any) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function random() {const bytes = new Uint32Array(1), limit = Math.floor(4294967296 / 1000000) * 1000000; do {crypto.getRandomValues(bytes);} while (bytes[0] >= limit); return (bytes[0] % 1000000) / 1000000;}
export function registerNativePvp(app: Express, native: NativePool, auth: RequestHandler) {
  const table = (name: string) => native.table(name), now = () => native.now(), today = () => new Date(now()).toISOString().slice(0, 10);
  const player = (id: any) => table('players').find(row => same(row.telegram_id, id));
  const profile = (id: number) => {
    let row = table('pvp_profiles').find(row => same(row.telegram_id, id));
    if (!row) {row = {telegram_id: id, rating: 1000, wins: 0, losses: 0, tickets: 5, ticket_day: today(), stance: 'balanced', enrolled: false, last_fight_at: null}; table('pvp_profiles').push(row);}
    return row;
  };
  const recent = (a: any, b: any) => table('pvp_matches').some(row => (same(row.attacker, a) && same(row.defender, b) || same(row.attacker, b) && same(row.defender, a)) && new Date(row.created_at).getTime() > now() - 86400000);
  app.get('/api/pvp', auth, (req, res) => {
    const id = req.authUser!.id, row = profile(id), account = player(id)!;
    if (String(row.ticket_day).slice(0, 10) < today()) {row.ticket_day = today(); row.tickets = 5;}
    const opponents = table('pvp_profiles').filter(other => other.enrolled && !same(other.telegram_id, id) && Math.abs(Number(other.rating) - Number(row.rating)) <= 400 && player(other.telegram_id) && (!player(other.telegram_id)!.clan_id || player(other.telegram_id)!.clan_id !== account.clan_id) && !recent(id, other.telegram_id))
      .sort((a, b) => Math.abs(Number(a.rating) - Number(row.rating)) - Math.abs(Number(b.rating) - Number(row.rating)) || Number(a.telegram_id) - Number(b.telegram_id)).slice(0, 10)
      .map(other => ({telegram_id: other.telegram_id, rating: other.rating, stance: other.stance, class_id: player(other.telegram_id)!.class_id, name: player(other.telegram_id)!.character_name || player(other.telegram_id)!.display_name}));
    const history = table('pvp_matches').filter(match => same(match.attacker, id) || same(match.defender, id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10).map(row => ({id: row.id, attacker: row.attacker, defender: row.defender, result: row.result, created_at: row.created_at}));
    const leaders = table('pvp_profiles').filter(row => row.enrolled && player(row.telegram_id)).sort((a, b) => Number(b.rating) - Number(a.rating) || Number(b.wins) - Number(a.wins) || Number(a.telegram_id) - Number(b.telegram_id)).slice(0, 20).map(row => ({rating: row.rating, wins: row.wins, name: player(row.telegram_id)!.character_name || player(row.telegram_id)!.display_name}));
    res.json({profile: row, opponents, history, leaders, starsEnabled: false, resetAt: new Date(nextArenaReset(now())).toISOString()});
  });
  app.post('/api/pvp/enroll', auth, (req, res) => {
    if (!PVP_STANCES.includes(req.body?.stance) || typeof req.body?.enrolled !== 'boolean') {res.status(400).json({error: 'Выберите тактику и участие.'}); return;}
    Object.assign(profile(req.authUser!.id), {stance: req.body.stance, enrolled: req.body.enrolled}); res.json({ok: true});
  });
  app.post('/api/pvp/challenge', auth, async (req, res) => {
    try {
      const id = req.authUser!.id, target = Number(req.body?.targetId), matchId = req.body?.matchId;
      if (!uuid(matchId) || !Number.isSafeInteger(target) || target === id) throw new Error('Неверный соперник или ID боя.');
      if (req.body?.stars) throw new Error('Бои со ставками Stars отключены.');
      const cached = table('pvp_matches').find(row => row.id === matchId);
      if (cached) {if (!same(cached.attacker, id) || !same(cached.defender, target)) throw new Error('ID боя уже используется.'); res.json(cached.result); return;}
      const a = table('pvp_profiles').find(row => same(row.telegram_id, id)), b = table('pvp_profiles').find(row => same(row.telegram_id, target));
      const attacker = player(id), defender = player(target);
      if (!a?.enrolled || !b?.enrolled || !attacker || !defender) throw new Error('Оба игрока должны включить участие в PvP.');
      if (attacker.clan_id && attacker.clan_id === defender.clan_id) throw new Error('Соклановцы не участвуют в рейтинговых дуэлях между собой.');
      if (Math.abs(Number(a.rating) - Number(b.rating)) > 400) throw new Error('Разница рейтинга слишком большая.');
      if (a.last_fight_at && now() - new Date(a.last_fight_at).getTime() < 60000) throw new Error('Между боями нужна минута отдыха.');
      const tickets = String(a.ticket_day).slice(0, 10) === today() ? Number(a.tickets) : 5;
      if (tickets < 1) throw new Error('Попытки PvP закончились до 00:00 UTC.');
      if (recent(id, target)) throw new Error('С этим соперником можно сразиться раз в 24 часа.');
      const classOf = (value: string) => PVP_CLASSES.includes(value as any) ? value : 'warrior';
      const attackerName = attacker.character_name || attacker.display_name, defenderName = defender.character_name || defender.display_name;
      const duel = simulateDuel({classId: classOf(attacker.class_id), name: attackerName, stance: a.stance as PvpStance}, {classId: classOf(defender.class_id), name: defenderName, stance: b.stance as PvpStance}, random);
      const delta = pvpRatingDelta(Number(a.rating), Number(b.rating), duel.winner as any);
      const aRating = Math.max(0, Number(a.rating) + delta), bRating = Math.max(0, Number(b.rating) - delta);
      Object.assign(a, {rating: aRating, tickets: tickets - 1, ticket_day: today(), last_fight_at: new Date(now()).toISOString(), wins: Number(a.wins) + (duel.winner === 'attacker' ? 1 : 0), losses: Number(a.losses) + (duel.winner === 'defender' ? 1 : 0)});
      Object.assign(b, {rating: bRating, wins: Number(b.wins) + (duel.winner === 'defender' ? 1 : 0), losses: Number(b.losses) + (duel.winner === 'attacker' ? 1 : 0)});
      const result = {...duel, matchId, attackerName, defenderName, attackerRating: aRating, defenderRating: bRating, delta};
      table('pvp_matches').push({id: matchId, attacker: id, defender: target, result, created_at: new Date(now()).toISOString()});
      await queueNotification(native.asPool(), target, 'pvp_' + matchId, 'pvp', `⚔️ ${attackerName} вызвал вас на дуэль. ${duel.winner === 'draw' ? 'Ничья' : duel.winner === 'defender' ? 'Вы победили' : 'Вы проиграли'}. Ваш рейтинг: ${bRating}.`, new Date(now()));
      res.json(result);
    } catch (error) {res.status(400).json({error: error instanceof Error ? error.message : 'Не удалось провести бой.'});}
  });
}
