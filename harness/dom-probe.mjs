import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_interface_style = 'modern';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
console.log(await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Атака/.test(x.innerText)); const chain = []; let e = b; while (e && chain.length < 10) { chain.push(e.tagName + '.' + String(e.className).slice(0, 90)); e = e.parentElement; } return chain.join('\n'); }));
console.log(await p.evaluate(() => [...document.querySelectorAll('[class]')].map(e => String(e.className)).filter(c => /combat|battle/i.test(c)).slice(0, 10).join('\n')));
await s.close();
