import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']); ls.aeth_ui_scale = 'big';
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 430, height: 932}); await p.waitForTimeout(8000);
const max = {};
const scan = () => p.evaluate(() => [...document.querySelectorAll('img')].map(i => { const r = i.getBoundingClientRect(); return [new URL(i.src, location.href).pathname, Math.round(Math.max(r.width, r.height))]; }).filter(([u, w]) => w && /ui\/(icons|resources|gear)|items\//.test(u)));
for (const tab of ['Поселение', 'Сумка', 'Герой', 'Мир', 'Арена', 'Меню', 'Ещё']) { await p.evaluate(t => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => n.textContent.includes(t))?.click(), tab); await p.waitForTimeout(1300); for (const [u, w] of await scan()) { const g = u.split('/').slice(-2, -1)[0]; max[g] = Math.max(max[g] || 0, w); } }
await p.locator('[data-inventory-item]').first().click().catch(() => {}); await p.waitForTimeout(800); for (const [u, w] of await scan()) { const g = u.split('/').slice(-2, -1)[0]; max[g] = Math.max(max[g] || 0, w); }
console.log(style, JSON.stringify(max));
await s.close();
