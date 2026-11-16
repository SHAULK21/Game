import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; Object.assign(save.player, {level: 10, classId: 'mage', royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
const r = await p.evaluate(() => { const U = window.__aeUniques, G = {melee: 'warrior', rogue: 'rogue', ranged: 'archer', caster: 'mage'}, fits = (u, g) => u.type !== 'weapon' || u.group === g;
  let minAll = 1e9, minW = 1e9, minLeg = 1e9, worst = '';
  for (let L = 1; L <= 120; L++) for (const g of Object.keys(G)) { const pool = U.filter(u => fits(u, g) && u.level <= L + 1 && u.level >= L - 4); const w = pool.filter(u => u.type === 'weapon').length, lg = pool.filter(u => u.rarity === 'legendary').length;
    if (pool.length < minAll) { minAll = pool.length; worst = `L${L} ${g}`; } minW = Math.min(minW, w); minLeg = Math.min(minLeg, lg); }
  const named = U.filter(u => u.named).length, rar = {}; U.forEach(u => rar[u.rarity] = (rar[u.rarity] || 0) + 1);
  return {total: U.length, named, rar, minPoolPerLevel: minAll, worst, minWeaponsInWindow: minW, minLegendaryInWindow: minLeg, sample: U.filter(u => u.band === 9).map(u => `${u.level} ${u.rarity[0]} ${u.name}`)}; });
console.log(JSON.stringify(r, null, 1)); await s.close(); process.exit(0);
