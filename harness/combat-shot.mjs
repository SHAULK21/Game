import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2], tag = process.argv[3] || 'before';
const ls = JSON.parse(fs.readFileSync('ls.json')); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click().catch(()=>{}); await p.waitForTimeout(300); }
const has = await p.locator('.combat-command-center').count();
const nav = await p.locator('nav').last().boundingBox().catch(() => null);
console.log(style, 'combat-center', has, 'nav box', JSON.stringify(nav));
await p.screenshot({path: `combat-${style}-${tag}.png`});
await s.close();
