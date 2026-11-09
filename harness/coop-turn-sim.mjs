import fs from 'node:fs';
const E = await import('../tgcloud/lib/gameEngine.js');
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
const CS = JSON.parse(fs.readFileSync('class-skills.json'));
const dungeon = process.argv[2] || 'spider_den', lvl = Number(process.argv[3] || 16), runs = Number(process.argv[4] || 6);
const kitFor = (cls, level) => ({skills: (CS[cls] || []).filter(s => s.levelReq <= level).map(s => ({id: s.id, name: s.name, icon: s.icon, mana: s.manaCost, mult: s.damageMultiplier * (level >= 20 ? 1.12 : 1), heal: s.damageMultiplier ? 0 : 1, type: s.type, inf: s.inflicts, inflicts: s.inflicts, levelReq: s.levelReq})).map(s => ({...s, inflicts: undefined, inf: undefined, ...(s.inf ? {} : {})})).map((s, i) => ({...s, inflicts: undefined})), talents: {}});
let wins = 0, totalActs = 0, combos = 0;
for (let run = 0; run < runs; run++) {
  const world = JSON.parse(fs.readFileSync('world-after-reg.json'));
  new E.NativePool(world, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(world.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: lvl, class_id: 'mage'});
  Object.assign(world.tables.players.find(p => p.telegram_id == 437290420), {level: lvl, class_id: 'warrior', character_name: 'Админ'});
  const call = async (uid, path, method = 'POST', body = {}) => { const user = {id: uid, displayName: 'U', username: 'u'}, now = Date.now();
    const native = sub => E.handleProgressRequest(world, sub, user, {now: () => now, isAdmin: () => false});
    return (await handleSocialRequest(world, {path, method, body}, {...user, isAdmin: false}, now, native)) || await native({path, method, body}); };
  const mk = cls => ({skills: (CS[cls] || []).filter(s => s.levelReq <= lvl).map(s => ({id: s.id, name: s.name, icon: s.icon, mana: s.manaCost, mult: s.damageMultiplier, heal: s.damageMultiplier ? 0 : 0, type: s.type, inflicts: s.inflicts})), talents: {}});
  const fix = k => ({...k, skills: k.skills.map(s => ({...s, inflicts: s.inflicts}))});
  const statsW = {maxHp: 160 * 1.25 + lvl * 60, attack: 18 + lvl * 7, defense: 6 + lvl * 4, critChance: 12, maxMp: 100 + lvl * 8, kit: fix(mk('warrior'))};
  const statsM = {maxHp: 160 * 0.8 + lvl * 40, attack: (18 + lvl * 7) * 1.3, defense: 6 + lvl * 2, critChance: 12, maxMp: 120 + lvl * 10, kit: fix(mk('mage'))};
  let r = await call(437290420, '/api/coop/create', 'POST', {dungeonId: dungeon, stats: statsW}); const roomId = r.body.room.id;
  await call(555, '/api/coop/join', 'POST', {roomId, stats: statsM}); await call(437290420, '/api/coop/start');
  let acts = 0;
  for (let i = 0; i < 600; i++) {
    const room = world.tables.coop_rooms.find(x => x.id === roomId); if (room.status !== 'active') break;
    if (room.phase === 'choose') { await call(437290420, '/api/coop/choose', 'POST', {optionId: room.options[0].id}); continue; }
    for (const who of [437290420, 555]) {
      const rm = world.tables.coop_rooms.find(x => x.id === roomId); if (rm.status !== 'active' || rm.phase !== 'fight') break;
      const m = rm.members.find(x => String(x.id) === String(who)); if (m.acted || m.hp <= 0) continue;
      const kit = world.tables.ae_combat_stats.find(x => x.u === String(who)).kit, ally = rm.members.find(x => x !== m);
      const v = (await call(who, '/api/coop/room', 'GET')).body.room;
      let body;
      if (ally.hp === 0 && m.potions > 0) body = {action: 'potion', targetId: ally.id};
      else if (m.hp / m.maxHp < 0.35 && m.potions > 0) body = {action: 'potion'};
      else if (rm.foe.intent?.kind === 'heavy' && String(rm.foe.intent.targetId) === String(who) && m.hp / m.maxHp < 0.6) body = {action: 'guard'};
      else { const combo = v.combos?.[0] && kit.skills.find(s => s.id === v.combos[0].id && s.mana <= m.mp); const best = combo || kit.skills.filter(s => s.mana <= m.mp && s.mult > 0).sort((a, b) => b.mult - a.mult)[0]; body = best ? {action: 'skill', skillId: best.id} : m.mp < m.maxMp * 0.3 ? {action: 'guard'} : {action: 'attack'}; }
      r = await call(who, '/api/coop/act', 'POST', body); acts++;
    }
  }
  const room = world.tables.coop_rooms.find(x => x.id === roomId);
  if (room.status === 'won') wins++; totalActs += acts; combos += room.log.filter(l => /СВЯЗКА/.test(l.text)).length;
  if (run === 0) console.log(room.log.filter(l => /СВЯЗКА/.test(l.text)).slice(0, 4).map(l => l.text).join("\n"));
  console.log(`run ${run}: ${room.status} stage ${room.stage} acts ${acts}`);
}
console.log(`${dungeon} lvl ${lvl}: wins ${wins}/${runs}, avg acts ${Math.round(totalActs / runs)}`);
