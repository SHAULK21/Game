import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save);
if (style === 'modern') ls['aethelgard_interface'] = 'modern';
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
const failed = []; p.on('requestfailed', r => failed.push(r.url())); p.on('response', r => { if (r.status() >= 400 && /assets/.test(r.url())) failed.push(r.status() + ' ' + r.url()); });
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const b = p.locator('.ae-story button'); if (await b.count()) await b.click().catch(() => {}); await p.waitForTimeout(3000);
const places = await p.evaluate(() => [...document.querySelectorAll('[data-settlement-place]')].map(e => e.getAttribute('data-settlement-place')));
for (const id of places) { await p.evaluate(i => document.querySelector(`[data-settlement-place="${i}"]`)?.click(), id); await p.waitForTimeout(1500);
  const txt = (await p.locator('main').innerText().catch(() => '')).length; if (txt < 40) console.log('EMPTY', id);
  await p.locator('main button', {hasText: /^Назад$/}).first().click().catch(() => {}); await p.waitForTimeout(700);
  if (!(await p.locator('[data-settlement-place]').count())) { await p.locator('nav button, nav a').filter({hasText: 'Поселение'}).first().click({force: true}).catch(() => {}); await p.waitForTimeout(800); } }
await p.locator('.ae-x').first().click({force: true}).catch(() => {});
console.log('nav items:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].map(e => e.textContent.trim()))));
for (const t of ['Мир', 'Герой', 'Сумка', 'Меню', 'Поселение']) { const ok = await p.evaluate(x => { const e = [...document.querySelectorAll('nav button, nav a, footer button')].find(n => n.textContent.trim() === x); if (!e) return false; e.click(); return true; }, t); await p.waitForTimeout(1800);
  console.log('nav', t, ok, '→', (await p.locator('main').innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 70)); }
for (const k of ['wiki', 'horde', 'coop', 'duel', 'profile', 'quests', 'merge', 'friends']) { await p.evaluate(x => window.__aethOpen[x](), k).catch(e => console.log('open fail', k)); await p.waitForTimeout(900); const ok = await p.locator('.ae-panel').count(); if (!ok) console.log('NO PANEL', k); await p.locator('.ae-x').first().click({force: true}).catch(() => {}); await p.waitForTimeout(300); }
console.log('places', places.length, '| failed assets:', failed.length, failed.slice(0, 5).join(' '));
console.log('errors:', s.log.filter(l => /pageerror/.test(l)).slice(0, 5).join(' || ') || 'none');
await s.close();
