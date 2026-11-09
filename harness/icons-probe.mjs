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
console.log('CUR:', await p.evaluate(() => [...document.querySelectorAll('header .text-cyan-300')].map(e => e.parentElement.outerHTML.replace(/<path[^>]*>/g,'<path/>').slice(0,500)).join('\n'))); console.log('HEADER:', await p.evaluate(() => { const h = document.querySelector('header'); return [...h.querySelectorAll('svg, img')].slice(0, 12).map(e => (e.tagName === 'IMG' ? e.getAttribute('src') : 'svg') + ' ~ ' + (e.closest('button,div,span')?.textContent || '').trim().slice(0, 20) + ' | ' + (e.closest('[class]')?.className || '')).join('\n'); }));
await p.locator('nav button').first().click(); await p.waitForTimeout(1000);
console.log('PETS PLACE:', await p.evaluate(() => { const b = document.querySelector('[data-settlement-place="pets"]'); return b ? b.outerHTML.replace(/<path[^>]*>/g, '<path/>').slice(0, 900) : 'none'; }));
await p.screenshot({path: `ip-settle-${style}.png`});
await s.close();
