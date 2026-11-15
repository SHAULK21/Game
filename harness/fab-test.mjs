import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture; ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = process.argv[2] || 'fantasy';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(8000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => { window.confirm = () => true; [...document.querySelectorAll('button')].find(b => /Покинуть бой|Скрыться/.test(b.textContent))?.click(); }); await p.waitForTimeout(2500);
for (let k = 0; k < 4; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Закрыть|Продолжить|В поселение|Вернуться)/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(500); }
const st = () => p.evaluate(() => { const f = document.querySelector('.ae-chat-fab'); return f ? (f.hidden ? 'hidden' : 'visible') : 'none'; });
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Поселение/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
await p.screenshot({path:'fab-set.png'}); console.log('SETTLEMENT', await st(), await p.evaluate(() => { const f=document.querySelector('.ae-chat-fab'); const cs=getComputedStyle(f); const out=[cs.bottom, cs.right, document.activeElement?.tagName, !!document.querySelector('.ae-panel, [role=dialog], .ae-story, .ae-relink, .ae-pot-pick, #startup-splash'), document.documentElement.hasAttribute('data-in-combat')]; const x=innerWidth-37, y=innerHeight-parseFloat(cs.bottom)-25; out.push(document.elementsFromPoint(x,y).slice(0,4).map(e=>e.tagName+'.'+String(e.className).slice(0,40)).join(' > ')); return out.join(' | '); }));
await p.evaluate(() => document.querySelector('.ae-chat-fab')?.click()); await p.waitForTimeout(3000);
console.log('CHAT', await st(), await p.evaluate(() => !!document.querySelector('main textarea, main input[type=text], main input:not([type])')));
await p.screenshot({path: 'fab-chat.png'});
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a, footer button')].find(b => /Сумка/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
console.log('BAG', await st());
await s.close(); process.exit(0);
