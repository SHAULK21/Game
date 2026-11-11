import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; const got = new Map();
p.on('response', async r => { const u = new URL(r.url()); if (!/\.(webp|png|jpg|jpeg|svg|gif)$/.test(u.pathname)) return; try { const b = await r.body(); got.set(u.pathname, b.length); } catch {} });
await p.setViewportSize({width: 390, height: 844}); await p.reload(); await p.waitForTimeout(8000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
for (const tab of ['Сумка', 'Герой', 'Мир', 'Арена', 'Меню', 'Ещё', 'Поселение']) { await p.evaluate(t => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => n.textContent.includes(t))?.click(), tab); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 99999)); await p.waitForTimeout(700); }
await p.evaluate(() => window.__aethOpen.horde()); await p.waitForTimeout(800); await p.locator('.ae-horde-go').first().click({force: true}).catch(() => {}); await p.waitForTimeout(2500);
const groups = {}; for (const [k, v] of got) { const g = k.replace(/\/[^/]+$/, ''); groups[g] ||= [0, 0]; groups[g][0]++; groups[g][1] += v; }
const tot = [...got.values()].reduce((a, b) => a + b, 0);
console.log(style, 'images', got.size, 'total', Math.round(tot / 1024), 'KB');
for (const [g, [n, b]] of Object.entries(groups).sort((a, b) => b[1][1] - a[1][1]).slice(0, 14)) console.log(' ', g, n, Math.round(b / 1024) + 'KB');
fs.writeFileSync(`net-${style}.json`, JSON.stringify([...got]));
await s.close();
