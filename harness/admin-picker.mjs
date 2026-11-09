import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_interface_style = process.argv[2] || 'modern';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
await p.evaluate(() => window.__aethBridge.setPlayer(x => ({...x, worldPlace: 'settlement', firstJourney: undefined, firstJourneyDeparture: undefined}))); await p.waitForTimeout(500);
await p.locator('nav button').last().click(); await p.waitForTimeout(600); await p.getByText('Premium', {exact: true}).first().click().catch(()=>{}); await p.waitForTimeout(600);
await p.getByRole('button', {name: /Панель Администратора/}).click(); await p.waitForTimeout(1500);
for (const d of await p.locator('details.admin-fold > summary').all()) await d.click();
await p.waitForTimeout(800);
const trig = p.locator('button:has(.selection-chevron)'); const n = await trig.count(); const out = [];
for (let i = 0; i < n; i++) { await trig.nth(i).scrollIntoViewIfNeeded(); const label = (await trig.nth(i).innerText()).replace(/\n/g, ' '); await trig.nth(i).click({timeout: 2000}).catch(e => out.push(`#${i} ${label}: CLICK FAIL`)); await p.waitForTimeout(400);
  const top = await p.evaluate(() => { const d = document.querySelector('.selection-dialog'); if (!d) return 'no picker'; const r = d.getBoundingClientRect(); return d.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 30)) ? 'on top' : 'COVERED'; });
  const opt = p.locator('.selection-dialog [role=option], .selection-dialog li button').nth(1); const optTxt = await opt.innerText().catch(() => ''); await opt.click().catch(() => {}); await p.waitForTimeout(300);
  out.push(`#${i} "${label}": ${top}; pick "${optTxt.split('\n')[0]}" → field "${(await trig.nth(i).innerText()).replace(/\n/g, ' ')}"`); }
console.log(out.join('\n'));
await s.close();
