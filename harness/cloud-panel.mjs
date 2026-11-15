import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'fantasy';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /^(Ещё|Меню|…\s*Ещё)$/.test(b.textContent.trim()) || /Ещё/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
console.log('ENTRY', await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Перенос героя/.test(b.textContent)); b?.click(); return !!b; })); await p.waitForTimeout(1500);
console.log('PANEL', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || 'none')).replace(/\n+/g, ' | '));
await p.evaluate(() => { window.confirm = () => true; [...document.querySelectorAll('.ae-panel button')].find(b => /Сохранить в облако/.test(b.textContent))?.click(); }); await p.waitForTimeout(1500);
console.log('AFTER', (await p.evaluate(() => document.querySelector('.ae-panel')?.innerText || 'none')).replace(/\n+/g, ' | '));
await p.screenshot({path: 'cloud-panel.png'}); console.log('ERR', s.errors?.join?.(' ; ') || ''); await s.close(); process.exit(0);
