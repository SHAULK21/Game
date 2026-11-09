import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
async function run(dungeonId, level, classes, skill) {
  let now = 1.8e12; const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
  classes.forEach((c, i) => { pool.ensurePlayer({id: i + 1, displayName: 'P' + (i + 1)}); Object.assign(world.tables.players.find(p => p.telegram_id == i + 1), {level, class_id: c, character_name: 'P' + (i + 1)}); });
  const call = (u, path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: u}, now);
  let r = await call(1, '/api/coop/create', 'POST', {dungeonId}); for (let i = 2; i <= classes.length; i++) await call(i, '/api/coop/join', 'POST', {roomId: r.body.room.id}); await call(1, '/api/coop/start', 'POST');
  let t0 = now;
  for (let step = 0; step < 6000; step++) {
    now += 250;
    for (let u = 1; u <= classes.length; u++) {
      if (Math.random() > skill) continue;
      const room = (await call(u, '/api/coop/room')).body.room; if (!room) continue;
      if (room.status !== 'active') return {res: room.status, secs: Math.round((now - t0) / 1000), stage: room.stage};
      if (room.phase === 'choose') { if (u === 1) await call(1, '/api/coop/choose', 'POST', {optionId: room.options[Math.floor(Math.random() * room.options.length)].id}); continue; }
      const mine = room.members.find(m => m.id == u), cd = mine.cooldowns || {};
      if (!mine.hp) continue;
      const low = room.members.filter(m => m.hp / m.maxHp < 0.4).sort((a, b) => a.hp - b.hp)[0];
      const danger = room.foe && ['aoe', 'heavy'].includes(room.foe.intent) && room.foe.nextIn < 2200;
      const act = low && !cd.heal ? 'heal' : danger && !cd.guard && !room.members.some(m => m.guardUntil > 0) ? 'guard' : !cd.spell ? 'spell' : !cd.power ? 'power' : !cd.attack ? 'attack' : null;
      if (act) await call(u, '/api/coop/act', 'POST', {action: act, targetId: act === 'heal' ? low.id : undefined});
    }
  }
  return {res: 'timeout'};
}
for (const [d, lv] of (process.env.CASES ? JSON.parse(process.env.CASES) : [['goblin_cave', 3], ['spider_den', 12], ['crypt_depths', 22], ['rift_gate', 40]])) {
  for (const party of [['warrior', 'mage'], ['knight', 'druid', 'hunter']]) for (const skill of [0.35, 0.7]) {
    const res = []; for (let i = 0; i < 10; i++) res.push(await run(d, lv, party, skill));
    const wins = res.filter(x => x.res === 'won'); console.log(d, 'lv' + lv, party.length + 'p', 'skill' + skill, 'wins', wins.length + '/10', 'avg secs', Math.round(wins.reduce((a, b) => a + b.secs, 0) / Math.max(1, wins.length)), 'fails at stage', res.filter(x => x.res !== 'won').map(x => x.stage || x.res).join(','));
  }
}
