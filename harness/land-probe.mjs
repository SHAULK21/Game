import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 20, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1300);
if (style === 'fantasy') { console.log(await p.evaluate(() => { const leaf = [...document.querySelectorAll('main *')].find(x => !x.childElementCount && /^Тёмный лес/.test(x.textContent.trim())); let b = leaf; for (let i = 0; i < 5 && b; i++) b = b.parentElement; return b ? b.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 900) : 'none'; }));
  console.log('heading:', await p.evaluate(() => document.querySelector('.region-dispatch-heading')?.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 700)));
  console.log('tail:', await p.evaluate(() => { const d = document.querySelector('.region-dispatch'); return d ? [...d.children].map(c => c.tagName + '.' + String(c.className).slice(0, 40) + ':' + Math.round(c.getBoundingClientRect().height)).join(' | ') : ''; })); }
else { await p.locator('button', {hasText: '6 видов монстров'}).first().click(); await p.waitForTimeout(1000); await p.screenshot({path: 'b5-modern-mode.png'});
  console.log(await p.evaluate(() => { const d = [...document.querySelectorAll('.fixed.inset-0, .game-dialog-backdrop')].pop(); return d ? d.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 1500) + ' H=' + d.firstElementChild.getBoundingClientRect().height : 'none'; })); }
await s.close();
