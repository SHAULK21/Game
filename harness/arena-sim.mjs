// Balance runs: real game fights at a level/region with a gear profile.
// node bal-sim.mjs <level> <regionName> <profile:avg|max> [fights=6] [difficulty]
import {launch} from './browser.mjs'; import fs from 'node:fs';
const [L, REG, PROF, NF = '6'] = [Number(process.argv[2]), process.argv[3], process.argv[4], process.argv[5]];
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const P = save.player;
Object.assign(P, {level: L, energy: 100, maxEnergy: 100, worldPlace: 'settlement', royalBriefingStep: 99, unlockedRegionIds: ['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp', 'reg_desert', 'reg_cursed', 'reg_rift', 'reg_dragon'], currentRegionId: 'reg_plains'});
delete P.firstJourney; delete P.firstJourneyDeparture;
const MULT = {rare: 1.35, epic: 1.65, legendary: 2.1};
function gear(type, rarity, lvl, up, asc, extra = {}) {
  const m = MULT[rarity], st = {}, Lv = lvl;
  if (type === 'weapon') { st.attack = Math.round((12 + Lv * 3) * m); st.critChance = Math.round((2 + Lv / 15) * (m > 1.5 ? 1.5 : 1)); }
  else if (type === 'armor') { st.defense = Math.round((6 + Lv * 2) * m); st.magicDefense = Math.round((4 + Lv) * m); st.maxHp = Math.round((25 + Lv * 9) * m); }
  else if (['helmet', 'offhand', 'pants', 'gloves', 'boots', 'belt', 'cloak'].includes(type)) { st.defense = Math.round((3 + Lv) * m); st.magicDefense = Math.round((2 + Lv * 0.6) * m); st.maxHp = Math.round((12 + Lv * 4) * m); }
  else { st.attack = Math.round((4 + Lv) * m); st.maxHp = Math.round((10 + Lv * 3) * m); st.critChance = 1 + Math.floor(Lv / 20); }
  if (asc) for (const k of Object.keys(st)) if (st[k] >= 10) st[k] = Math.round(st[k] * (1 + 0.1 * asc));
  for (const [k, v] of Object.entries(extra)) st[k] = (st[k] || 0) + v;
  return {id: 'sim_' + type, templateId: 'sim_' + type, name: 'Сим ' + type, type, rarity, level: lvl, upgradeLevel: up, ascension: asc || undefined, stats: st, icon: '⚔️', sellPrice: 10, disassembleYield: {}, stackCount: 1, isEquipped: true};
}
const SLOTS = ['weapon', 'offhand', 'helmet', 'armor', 'pants', 'gloves', 'boots', 'amulet', 'ring', 'belt', 'cloak', 'artifact'];
const eq = {};
for (const s of SLOTS) {
  if (PROF === 'avg') eq[s] = gear(s, 'rare', L, 5, 0);
  else { if (s === 'offhand') continue; const g = gear(s, 'legendary', L, 10, 3, s === 'weapon' || s === 'ring' || s === 'amulet' ? {critChance: 8, critDamage: 30} : {vampirism: 3});
    if (s === 'weapon') { g.twoHanded = true; g.stats.attack = Math.round(g.stats.attack * 1.6); } eq[s] = g; }
}
P.equipped = {...eq}; P.inventory = (P.inventory || []).filter(i => !SLOTS.includes(i.type));
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp', 'reg_desert', 'reg_cursed', 'reg_rift', 'reg_dragon']); ls.aeth_ui_scale = 'big';
ls['aeth_2h_seen_437290420'] = JSON.stringify(['sim_weapon']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const me = w.tables.players.find(p => String(p.telegram_id) === '437290420'); if (me) me.level = L; }});
const p = s.page; p.setDefaultTimeout(3000); await p.setViewportSize({width: 390, height: 1400}); p.on('dialog', d => d.accept());
await p.waitForTimeout(7000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!', 'Понятно']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(200); }
await p.locator('.ae-x').first().click().catch(() => {}); await p.evaluate(([k, a]) => { localStorage.setItem('aeth_autoequip_437290420', '0'); if (k) window.__balK = Number(k); if (a) window.__balA = Number(a); }, [process.env.BAL_K, process.env.BAL_A]);
await p.waitForTimeout(6000); const stats = await p.evaluate(() => { const st = window.__aethBridge.stats || {}; return {threat: window.__aeThreat, hp: st.maxHp, atk: st.attack, def: st.defense, crit: st.critChance, cd: st.critDamage}; });
const OPP = Number(process.env.OPP || 0);
const read = () => p.evaluate(() => { const t = document.querySelector('main')?.innerText || ''; const hp = t.match(/HP[ \t]*\n?[ \t]*([\d  ]+)\/([\d  ]+)/); const foe = t.match(/Здоровье противника[ \t]*\n?[ \t]*([\d  ]+)\/([\d  ]+)/);
  const n = x => Number(String(x).replace(/\D/g, '')); return {hp: hp ? [n(hp[1]), n(hp[2])] : null, foe: foe ? [n(foe[1]), n(foe[2])] : null, round: Math.max(0, ...[...t.matchAll(/Раунд\s*(\d+)/g)].map(m => Number(m[1]))), over: /ВРАГ ПОВЕРЖЕН|Победа|Поражение|пали|Бой завершён/i.test(t), lost: /Поражение|Вы пали|погиб/i.test(t), name: (t.match(/УР\.\s*(\d+)\s*\n\s*([^\n]+)/) || [])[0] }; });
const res = [];
for (let f = 0; f < Number(NF); f++) {
  await p.evaluate(() => { window.__aethBridge.setPlayer(x => ({...x, arenaTickets: 10, energy: 100})); [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => /Арена/.test(n.textContent))?.click(); }); await p.waitForTimeout(1500);
  await p.getByRole('button', {name: 'В бой'}).nth(OPP).click().catch(e => console.log('no fight btn')); await p.waitForTimeout(1500);
  for (const t of ['Начать бой', 'В бой!', 'Сразиться', 'Подтвердить']) if (await p.getByRole('button', {name: t}).count()) { await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(1200); }
  let r0 = await read(); if (!r0.foe || !r0.hp) { console.log('no arena fight:', (await p.locator('main').innerText()).replace(/\n+/g, ' | ').slice(0, 300)); break; }
  const hp0 = r0.hp[0], t0 = Date.now(); let minHp = hp0, r = r0, clicks = 0;
  while (Date.now() - t0 < 60000) { const b = p.getByRole('button', {name: /^Атака/}).first();
    if (!(await b.count()) || await b.isDisabled().catch(() => true)) { await p.waitForTimeout(300); r = await read(); if (r.hp) minHp = Math.min(minHp, r.hp[0]); if (r.over || !r.foe || r.foe[0] === 0 || (r.hp && r.hp[0] === 0)) break; continue; }
    await b.click({noWaitAfter: true}).catch(() => {}); clicks++; await p.waitForTimeout(700); r = await read(); if (r.hp) minHp = Math.min(minHp, r.hp[0]); if (!r.foe || r.foe[0] === 0 || r.over || (r.hp && r.hp[0] === 0)) break; }
  res.push({rounds: Math.max(r.round || 0, clicks), lostPct: Math.round(100 * (hp0 - minHp) / r0.hp[1]), foeMax: r0.foe[1], won: !(r.hp && r.hp[0] === 0) && !r.lost, foe: (r0.name || '').replace(/\n/g, ' ')});
  await p.waitForTimeout(1500); for (const t of ['Продолжить', 'Забрать награду', 'Вернуться', 'Закрыть', 'Назад']) if (await p.getByRole('button', {name: t}).count()) { await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(500); }
}
console.log(JSON.stringify({L, OPP, PROF, stats, fights: res}));
await s.close();
