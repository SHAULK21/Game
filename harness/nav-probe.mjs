import {launch} from './browser.mjs'; import fs from 'node:fs';
for (const style of ['modern', 'fantasy']) {
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
console.log(style, await p.evaluate(() => { const n = [...document.querySelectorAll('nav')].pop(); const b = n.querySelector('button'); return {nav: n.className, navH: n.getBoundingClientRect().height, inner: n.firstElementChild?.className, btn: b.className.slice(0, 150), btnHTML: b.innerHTML.slice(0, 300), defend: [...document.querySelectorAll('button')].map(x => x.textContent).filter(t => /Защита|Скрыться/i.test(t))}; }));
await s.close(); }
