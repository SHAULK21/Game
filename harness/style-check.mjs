import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy-beta';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.waitForTimeout(4500);
console.log('stored beta -> data-interface:', await p.evaluate(() => document.documentElement.dataset.interface));
for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click().catch(()=>{}); await p.waitForTimeout(300); }
await p.getByText(/Стиль интерфейса|Оформление/).first().click().catch(e => console.log('no switch', e.message.slice(0, 60))); await p.waitForTimeout(800);
const t = await p.innerText('body'); console.log('options:', ['Современный', 'Фэнтези — бета', 'Новый бестиарий'].map(x => x + ':' + t.includes(x)).join(' '));
await s.close();
