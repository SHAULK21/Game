import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 44, worldPlace: 'settlement', royalBriefingStep: 99, name: 'Sanvile'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
await p.evaluate(() => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => n.textContent.includes('Сумка'))?.click()); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => document.querySelector('header .header-content').outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').replace(/<img[^>]*>/g, '<img>').slice(0, 2500)));
await s.close();
