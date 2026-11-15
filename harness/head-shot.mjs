import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const me = w.tables.players.find(p => p.telegram_id == 437290420); if (process.env.PREM) me.premium_until = new Date(Date.now() + 5.4 * 864e5).toISOString(); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.locator('.ae-story button').first().click({timeout: 400}).catch(() => {}); await p.waitForTimeout(300); }
await p.waitForTimeout(2500); await p.evaluate(() => document.querySelectorAll('.ae-toast,.ae-apk-hint,.ae-premium,.ae-story,[role=dialog]').forEach(e => e.remove()));
await p.waitForTimeout(1500);
await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const cs = getComputedStyle(e); if (cs.position === 'fixed' && e.getBoundingClientRect().width >= innerWidth - 2 && e.getBoundingClientRect().height >= innerHeight - 2 && !e.querySelector('header')) e.style.display = 'none'; } }); await p.waitForTimeout(300); await p.screenshot({path: `head-${style}.png`, clip: {x: 0, y: 0, width: 390, height: 190}}); if (process.env.FAKEPREM) { await p.evaluate(() => window.__aeTestPrem(5.4 * 864e5)); await p.waitForTimeout(500); }
for (let k = 0; k < 6; k++) { const b = p.getByRole('button', {name: /Понятно|В бой, герой|Позже|Закрыть|Забрать/}); if (await b.count()) { await b.first().click().catch(() => {}); await p.waitForTimeout(600); } } await p.screenshot({path: `head-${style}.png`, clip: {x: 0, y: 0, width: 390, height: 190}}); console.log('DARK', await p.evaluate(() => document.documentElement.className + ' | body: ' + document.body.className.slice(0, 80) + ' | ' + [...document.querySelectorAll('body > *')].filter(e => getComputedStyle(e).position === 'fixed').map(e => e.tagName + '.' + String(e.className).slice(0, 40)).join(' , '))); console.log('CHIP', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ae-prem-chip')].map(c => c.textContent + ' @' + Math.round(c.getBoundingClientRect().left) + ',' + Math.round(c.getBoundingClientRect().top)))));
if (process.env.BEER) {
  await p.evaluate(() => document.querySelector('[data-settlement-place="chat"]')?.click()); await p.waitForTimeout(1500);
  const sec = []; for (let i = 0; i < 9; i++) { await p.evaluate(() => document.querySelector('[data-drink-beer]')?.click()); await p.waitForTimeout(700); sec.push(await p.evaluate(() => (JSON.parse(localStorage.getItem('aethelgard_save_v1_data_437290420')).player.intoxication || {}).mugs + (document.documentElement.classList.contains('ae-dizzy') ? 'D' : ''))); }
  await p.waitForTimeout(2500); console.log('MUGS', sec.join(','), 'secret', JSON.stringify(s.world.tables.ae_profiles?.find(x => x.u == '437290420')?.secrets), 'events', JSON.stringify((s.world.tables.ae_events || []).filter(e => e.icon === '🍺').map(e => e.text.slice(0, 50))));
  await p.waitForTimeout(2500); console.log('STORY', (await p.locator('.ae-story').innerText().catch(() => 'NONE')).replace(/\n+/g, ' | ').slice(0, 300));
  await p.locator('.ae-story button').first().click().catch(() => {}); await p.waitForTimeout(3500);
  console.log('AFTER', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 200));
  await p.screenshot({path: 'beer.png'});
}
console.log('STYLE visible:', await p.evaluate(() => [...document.querySelectorAll('header *')].some(e => !e.childElementCount && /Стиль интерфейса/.test(e.textContent) && e.offsetParent))); console.log('PREM', JSON.stringify(await p.evaluate(() => window.__aethPremTest || null)), await p.locator('.ae-prem-chip').count());
await p.screenshot({path: `head-${style}.png`, clip: {x: 0, y: 0, width: 390, height: 190}});
await s.close();
