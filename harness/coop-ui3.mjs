import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
// tavern
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
await p.evaluate(() => window.__aethOpen.coop()); await p.waitForTimeout(800);
await p.locator('.ae-panel button', {hasText: 'Открыть'}).nth(1).click(); await p.waitForTimeout(800);
const room = s.world.tables.coop_rooms.at(-1); await handleSocialRequest(s.world, {path: '/api/coop/join', method: 'POST', body: {roomId: room.id}}, {id: 555}, Date.now());
await p.waitForTimeout(1800); await p.locator('.ae-panel button', {hasText: 'Начать поход'}).click(); await p.waitForTimeout(1500);
const CS = JSON.parse(fs.readFileSync('class-skills.json'));
const rm = () => s.world.tables.coop_rooms.at(-1);
const boris = async (body) => handleSocialRequest(s.world, {path: '/api/coop/act', method: 'POST', body}, {id: 555}, Date.now());
await handleSocialRequest(s.world, {path: '/api/ae-stats', method: 'POST', body: {stats: {maxHp: 1500, attack: 250, defense: 60, critChance: 12, maxMp: 300, kit: {skills: CS.mage.map(x => ({id: x.id, name: x.name, icon: x.icon, mana: x.manaCost, mult: x.damageMultiplier, inflicts: x.inflicts})), talents: {}}}}}, {id: 555}, Date.now());
console.log('my kit on server:', (s.world.tables.ae_combat_stats.find(x => x.u === '437290420')?.kit?.skills || []).map(k => k.name).join(', '));
await p.waitForTimeout(800);
console.log('turn:', await p.locator('.ae-bv').first().innerText().then(t => t.split('\n').filter(l => /ход|Ждём/i.test(l)).slice(0, 2).join(' | ')).catch(() => 'none'));
await p.locator('.ae-bv button').filter({hasText: /^Атака$/}).first().click({force: true}); await p.waitForTimeout(900);
console.log('after my attack, waiting:', await p.locator('.ae-panel').innerText().then(t => (t.match(/Ждём хода[^\n]*/) || ['-'])[0]));
await boris({action: 'skill', skillId: 'm_frost'}); await p.waitForTimeout(1200);
console.log('log:', rm().log.slice(-4).map(l => l.text).join(' || '));
console.log('combo banner:', await p.locator('.ae-chain').innerText().catch(() => 'none'));
console.log('combo skills:', (await p.locator('.ae-coop-skill.is-combo b').allInnerTexts()).join(', '));
await p.screenshot({path: `coop3-${style}.png`, fullPage: true});
const combo = p.locator('.ae-coop-skill.is-combo').first(); if (await combo.count()) { await combo.click({force: true}); await p.waitForTimeout(900); }
console.log('after combo:', rm().log.slice(-3).map(l => l.text).join(' || '));
console.log('seconds timers on screen:', (await p.locator('.ae-panel').innerText()).match(/\d+[.,]\d с\b/g));
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
