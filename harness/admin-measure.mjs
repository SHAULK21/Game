import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json'));
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4000);
for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click(); await p.waitForTimeout(300); }
await p.getByRole('button', {name: 'Меню'}).last().click(); await p.waitForTimeout(700);
await p.getByText('Premium', {exact: true}).first().click(); await p.waitForTimeout(700);
await p.getByRole('button', {name: /Панель Администратора/}).click(); await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const scroller = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 10 && e.innerText.includes('Admin Console')).pop();
  const top = scroller.getBoundingClientRect().top - scroller.scrollTop;
  const heads = [...scroller.querySelectorAll('h2,h3,h4,strong,summary')].map(h => [h.innerText.trim().slice(0, 50), Math.round(h.getBoundingClientRect().top - top)]).filter(x => x[0]);
  return {total: scroller.scrollHeight, client: scroller.clientHeight, heads};
});
console.log('modal content height', r.total, 'viewport', r.client, 'screens:', (r.total / r.client).toFixed(1));
for (const [t, y] of r.heads) console.log(String(y).padStart(5), t);
await s.close();
