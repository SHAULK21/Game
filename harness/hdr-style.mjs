import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
console.log('FOUND', await p.evaluate(() => { const out = []; for (const e of document.querySelectorAll('summary, button, section, details')) { if (!/Стиль интерфейса/.test(e.textContent || '') && e.getAttribute('aria-label') !== 'Стиль интерфейса') continue; const r = e.getBoundingClientRect(); const chain = []; let n = e; for (let i = 0; i < 5 && n; i++) { chain.push(n.tagName + '.' + String(n.className).slice(0, 40)); n = n.parentElement; } out.push(`${e.tagName} vis=${r.height > 0} y=${Math.round(r.top)} h=${Math.round(r.height)} :: ${chain.join(' < ')}`); } return out.join('\n'); }));
console.log('HDR', await p.evaluate(() => { const h = document.querySelector('header'); return h ? Math.round(h.getBoundingClientRect().height) + ' ' + h.className.slice(0, 60) : 'none'; }));
await p.screenshot({path: `hdr-${style}.png`, clip: {x: 0, y: 0, width: 390, height: 260}});
await s.close(); process.exit(0);
