import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
// tavern
await p.waitForTimeout(5000);
await p.evaluate(() => window.__aethOpen.horde()); await p.waitForTimeout(1200);
const btn = p.locator('.ae-panel button.ae-horde-go.is-blood');
console.log('blood btn:', await btn.count(), await btn.isDisabled().catch(() => 'n/a'), (await btn.innerText().catch(() => '')).replace(/\n/g, ' | '));
await btn.click().catch(e => console.log('click err', e.message.slice(0, 80))); await p.waitForTimeout(1500);
console.log('calls:', s.calls.filter(c => /horde/.test(c.path)).map(c => c.path + ' ' + c.status + ' ' + c.body.slice(0, 80)).join('\n'));
console.log('view:', (await p.locator('.ae-panel').innerText()).replace(/\n/g, ' | ').slice(0, 250));
console.log('blood class:', await p.locator('.ae-panel.is-blood').count());
await p.screenshot({path: `blood-fight-${style}.png`}); await p.locator('.ae-bv button').filter({hasText: /^Автобой$/}).first().click({force: true}).catch(e => console.log('no auto', e.message.slice(0, 60)));
await p.waitForTimeout(20000);
const errs = s.calls.filter(c => /horde/.test(c.path) && c.status >= 400);
console.log('after 20s auto:', (await p.locator('.ae-panel').innerText()).replace(/\n/g, ' | ').slice(0, 200));
console.log('horde calls', s.calls.filter(c => /horde\/act/.test(c.path)).length, 'errors', errs.length, errs.slice(0, 3).map(c => c.status + ' ' + c.body.slice(0, 100)).join(' / '));
await p.screenshot({path: `blood-${style}.png`});
console.log(s.log.filter(l => /pageerror|error/i.test(l)).slice(0, 5).join('\n'));
await s.close();
