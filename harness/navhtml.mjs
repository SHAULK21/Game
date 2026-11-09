import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_interface_style = 'fantasy';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
console.log(await p.evaluate(() => { const b = document.querySelector('.fantasy-shell-nav .game-nav-item'); return b.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg…/>').slice(0, 1500); }));
console.log(await p.evaluate(() => { const g = document.querySelector('.fantasy-shell-nav'); const cs = getComputedStyle(g); return [cs.height, cs.background.slice(0, 120), getComputedStyle(document.querySelector('.shell-nav-grid')).cssText?.slice(0, 50)]; }));
await p.locator('.fantasy-shell-nav').screenshot({path: 'nav-fantasy-combat-now.png'});
await p.evaluate(() => document.documentElement.removeAttribute('data-in-combat'));
await s.close();
