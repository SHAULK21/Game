import {handleSocialRequest} from '../tgcloud/lib/social.js';
const E = await import('../tgcloud/lib/gameEngine.js');
async function run(level, cls, blood, smart) {
  let now = Date.now(); const world = {tables: {}}; const pool = new E.NativePool(world, () => now);
  pool.ensurePlayer({id: 1, displayName: 'A'}); Object.assign(world.tables.players[0], {level, class_id: cls, character_name: 'A'});
  const call = (path, method = 'GET', body) => handleSocialRequest(world, {path, method, body}, {id: 1}, now);
  let r = await call('/api/horde/start', 'POST', {blood}); let v = r.body.run, reqs = 0;
  while (v.status === 'active' && reqs < 2000) {
    const a = smart && v.hp < v.maxHp * 0.35 && v.potions ? 'potion' : smart && v.powerCd === 0 ? 'power' : 'attack';
    r = await call('/api/horde/act', 'POST', {action: a, steps: 6}); v = r.body.run; reqs++; now += 400;
  }
  const c = await call('/api/horde/claim', 'POST', {});
  return {kills: v.kills, reqs, loot: c.body.reward};
}
for (const lvl of [10, 30, 60]) for (const blood of [false, true]) for (const smart of [false, true]) {
  const rs = []; for (let i = 0; i < 25; i++) rs.push(await run(lvl, ['warrior', 'mage', 'rogue', 'druid'][i % 4], blood, smart));
  const k = rs.map(x => x.kills).sort((a, b) => a - b), med = k[12];
  console.log(`lvl${lvl} ${blood ? 'BLOOD' : 'normal'} ${smart ? 'smart' : 'auto '} kills min/med/max ${k[0]}/${med}/${k.at(-1)} ≥20:${k.filter(x => x >= 20).length} ≥40:${k.filter(x => x >= 40).length} ≥60:${k.filter(x => x >= 60).length} /25  reqs~${rs[12].reqs} gold~${rs[12].loot.gold} exp~${rs[12].loot.exp}`);
}
