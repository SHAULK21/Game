import {launch} from './browser.mjs'; import {text} from './helpers.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json'));
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')))});
const p = s.page; await p.waitForTimeout(4000);
await p.getByRole('button', {name: 'Меню'}).last().click(); await p.waitForTimeout(1000);
if (await p.getByText('Позже').count()) await p.getByText('Позже').click();
await p.getByText('Premium', {exact: true}).first().click(); await p.waitForTimeout(1500);
const t = await text(p); console.log('--- PREMIUM\n', t.slice(t.indexOf('Premium'), t.indexOf('Premium') + 1200));
const adm = p.getByRole('button', {name: /админ|Админ|Admin/});
console.log('admin buttons', await adm.count());
if (await adm.count()) { await adm.last().click(); await p.waitForTimeout(3000); const a = await text(p); console.log('--- ADMIN\n', a.slice(0, 3000)); await p.screenshot({path: 'shot-admin.png'}); }
console.log(s.log.filter(l=>!/AudioContext/.test(l)).join('\n'));
console.log(s.calls.filter(c=>/admin|community/.test(c.path)).map(c=>c.method+' '+c.path+' '+c.status+' '+c.body.slice(0,150)).join('\n'));
await s.close();
