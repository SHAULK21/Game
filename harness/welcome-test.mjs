import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy', mode = process.argv[3] || 'away';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 20, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains"]';
if (mode === 'away') { ls['aeth_last_visit_437290420'] = String(Date.now() - 10 * 864e5); ls['aeth_news_seen_437290420'] = '2000-01-01'; }
if (mode === 'recent') { ls['aeth_last_visit_437290420'] = String(Date.now() - 864e5); ls['aeth_news_seen_437290420'] = '2000-01-01'; }
const seed = JSON.parse(fs.readFileSync('../patches/news-seed.json'));
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.ae_news = seed.map((p, i) => ({id: 'n' + i, title: p.title, text: p.text, at: new Date(Date.now() - (2 - i) * 864e5).toISOString()})); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; await p.setViewportSize({width: 390, height: 844});
await p.waitForTimeout(5000); for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.waitForTimeout(6000);
const n = await p.locator('.ae-welcome').count(); console.log(mode, style, 'welcome shown:', n, n ? (await p.locator('.ae-welcome .ae-story-text').innerText()).replace(/\n/g, ' | ').slice(0, 200) : '');
if (n) { await p.screenshot({path: `welcome-${mode}-${style}.png`}); await p.locator('.ae-welcome button', {hasText: /В бой|Отлично/}).click(); await p.waitForTimeout(500);
  console.log('after close: seen', await p.evaluate(() => localStorage.getItem('aeth_news_seen_437290420')?.slice(0, 10)), 'still open', await p.locator('.ae-welcome').count()); }
console.log(s.log.filter(l => /pageerror/.test(l)).slice(0, 2).join('\n'));
await s.close();
