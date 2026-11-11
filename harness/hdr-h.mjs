import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 44, worldPlace: 'settlement', royalBriefingStep: 99, name: 'Sanvile'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({pageOptions: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}, localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.waitForTimeout(8000);
for (const tab of ['Поселение', 'Сумка']) {
  await p.evaluate(t => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => n.textContent.includes(t))?.click(), tab); await p.waitForTimeout(1500);
  const withBell = await p.evaluate(() => document.querySelector('header').getBoundingClientRect().height);
  const noBell = await p.evaluate(async () => { const b = document.querySelector('[data-ae-bell]'); const d = b.style.display; b.style.display = 'none'; const hgt = document.querySelector('header').getBoundingClientRect().height; b.style.display = d; return hgt; });
  console.log(style, tab, 'header with bell', withBell, 'without', noBell);
}
await s.close();
