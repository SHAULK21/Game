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


const rm = () => s.world.tables.coop_rooms.at(-1);
const t0 = Date.now(); let clicks = 0;
while (Date.now() - t0 < 5000) { await p.locator('.ae-bv button').filter({hasText: /^Атака$/}).first().click({timeout: 500, force: true}).catch(() => {}); clicks++; await p.waitForTimeout(120); }
const mine = rm().log.filter(l => /^Админ атакует/.test(l.text)).length;
console.log('clicks', clicks, 'attacks registered in 5s', mine, '| enemy turns', rm().log.filter(l => /бьёт|сокрушает/.test(l.text)).length);
console.log('timer text:', await p.locator('[data-ae-foe-timer]').innerText().catch(() => 'none'));
console.log('skills shown:', (await p.locator('.ae-coop-skill b').allInnerTexts()).join(', '));
console.log('hero mana:', (await p.locator('.ae-coop-skills-h span').innerText().catch(() => 'none')));
await p.locator('.ae-coop-skill:not(.is-off)').first().click({force: true}); await p.waitForTimeout(700);
console.log('after skill:', rm().log.slice(-3).map(l => l.text).join(' || '));
console.log('skill state:', (await p.locator('.ae-coop-skill small').allInnerTexts()).join(', '));
await p.screenshot({path: `coop2-${style}.png`, fullPage: true});
console.log('any "с" timers:', (await p.locator('.ae-panel').innerText()).match(/\d+\.\d с/g));
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
