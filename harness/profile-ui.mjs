import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 25, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
// tavern
const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
await p.evaluate(() => window.__aethOpen.profile()); await p.waitForTimeout(1200);
await p.locator('.ae-title-row:not(.is-locked) button').nth(1).click().catch(e => console.log('no veteran btn')); await p.waitForTimeout(700);
await p.locator('.ae-panel').screenshot({path: `prof-titles-${style}.png`});
await p.locator('.ae-pill-btn', {hasText: 'Аватарка'}).evaluate(b => b.click()); await p.waitForTimeout(500);
await p.locator('.ae-avatar-pick').nth(12).evaluate(b => b.click()); await p.waitForTimeout(800);
await p.locator('.ae-panel').screenshot({path: `prof-avatars-${style}.png`});
await p.keyboard.press('Escape'); await p.waitForTimeout(800);
console.log('header avatar:', await p.evaluate(() => document.querySelector('header img.modern-avatar, header .shell-hero-portrait img')?.getAttribute('src')));
const r = await handleSocialRequest(s.world, {path: '/api/ae-profile/card?id=437290420', method: 'GET'}, {id: 555}, Date.now());
console.log('others see:', r.body.profile.title?.name, r.body.profile.avatar.src);
// card of Boris from my side
await handleSocialRequest(s.world, {path: '/api/ae-profile/title', method: 'POST', body: {id: 'newcomer'}}, {id: 555}, Date.now());
await p.evaluate(() => window.__aethOpen.card('555', 'Борис')); await p.waitForTimeout(1000); await p.locator('.ae-panel').screenshot({path: `prof-card-${style}.png`});
console.log('card:', (await p.locator('.ae-panel').innerText()).replace(/\n/g, ' | ').slice(0, 200));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.evaluate(() => window.__aethOpen.horde()); await p.waitForTimeout(800); await p.locator('.ae-horde-go', {hasText: 'Кровавая луна'}).click(); await p.waitForTimeout(700);
for (let i = 0; i < 4; i++) { await p.locator('.ae-horde-attack').dispatchEvent('pointerdown'); await p.waitForTimeout(300); }
await p.locator('.ae-panel').screenshot({path: `horde-hero-${style}.png`}); console.log('hero in horde:', await p.locator('.ae-horde-player img').getAttribute('src'));
await p.screenshot({path: `prof-header-${style}.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n'));
await s.close();
