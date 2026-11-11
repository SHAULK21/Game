import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, gold: 20000, silver: 3000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']); ls.aeth_ui_scale = 'big';
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.locator('.ae-x').first().click().catch(() => {});
const shots = [['gems', () => window.__aethOpen.gems('buy')], ['auction', () => window.__aethOpen.auction('all')], ['inbox', () => window.__aethOpen.inbox()], ['horde', () => window.__aethOpen.horde()]];
for (const [n, fn] of shots) { await p.evaluate(fn); await p.waitForTimeout(1200); console.log(n, 'icons:', await p.locator('.ae-panel .ae-ic').count(), 'emoji left:', await p.evaluate(() => (document.querySelector('.ae-panel')?.innerText.match(/[\u{1F300}-\u{1FAFF}☀-➿]/gu) || []).join(''))); await p.screenshot({path: `icui-${style}-${n}.png`}); await p.locator('.ae-x').first().click().catch(() => {}); await p.waitForTimeout(300); }
await p.evaluate(() => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => /Сумка/.test(n.textContent))?.click()); await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('[data-ae-gems]')?.scrollIntoView({block: 'center'})); await p.waitForTimeout(400); await p.screenshot({path: `icui-${style}-bag.png`});
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 3).join('\n') || 'no errors');
await s.close();
