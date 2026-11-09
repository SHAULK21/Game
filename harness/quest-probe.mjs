import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains','reg_whisper_woods','reg_forgotten_crypt','reg_forest','reg_swamp','reg_desert','reg_cursed','reg_rift','reg_dragon']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
// tavern
await p.locator('nav button').first().click(); await p.waitForTimeout(800);
console.log(await p.evaluate(() => [...document.querySelectorAll('[data-settlement-place]')].map(b => b.getAttribute('data-settlement-place') + ':' + b.innerText.split('\n')[0]).join(' | ')));
await p.locator('[data-settlement-place="quests"]').first().click({force: true}).catch(e => console.log('noboard', e.message.split('\n')[0])); await p.waitForTimeout(1200);
await p.waitForTimeout(1500); console.log((await p.locator('main').innerText()).replace(/\n/g,' | ').slice(0,500)); console.log(await p.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main [role=tab]')].map(e => e.tagName + ':' + e.textContent.trim().slice(0, 40)).join(' | ')));
await s.close();
