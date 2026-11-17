import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_language = 'uk';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')))});
const p = s.page; await p.waitForTimeout(6000);
console.log(await p.evaluate(() => JSON.stringify({lang: document.documentElement.lang, dmg: window.__aeDmgRu?.('physical'), fx: window.__aeFxRu?.('fortify')})));
await p.evaluate(() => { document.documentElement.lang = 'ru'; }); console.log(await p.evaluate(() => JSON.stringify({dmg: window.__aeDmgRu?.('physical'), fx: window.__aeFxRu?.('fortify')})));
await s.close(); process.exit(0);
