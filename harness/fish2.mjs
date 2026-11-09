import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 8, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
await p.locator('nav button').last().click(); await p.waitForTimeout(700);
await p.getByRole('button', {name: /^Рыбалка/}).first().click(); await p.waitForTimeout(1200);
const fstate = () => p.evaluate(k => JSON.stringify(JSON.parse(localStorage.getItem(k)).player.fishing).slice(0, 300), key);
await p.getByRole('button', {name: /Забросить удочку/}).first().click(); await p.waitForTimeout(500);
console.log('after cast state:', await fstate());
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(600);
  const f = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.fishing, key);
  const fight = f.cast?.fight;
  const btns = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim());
  if (i % 3 === 0) console.log(i, 'catches', f.catches, 'fight', fight ? `t${fight.tension} p${fight.progress} e${fight.energy} lost:${!!fight.lost} landed:${!!fight.landed}` : 'none', '| btns:', btns.filter(x => /Заброс|Подтян|Отпуст|Удерж|Смотать|Вытащ|Забрать|Подсеч/.test(x)).map(x => x.split(' ')[0]).join('/'));
  const click = async re => { const b = p.getByRole('button', {name: re}).first(); if (await b.count() && !(await b.isDisabled())) { await b.click().catch(() => {}); return true; } return false; };
  if (await click(/Вытащить|Забрать улов|Достать/)) continue;
  if (!fight && await click(/^Подсечь/)) continue;
  if (fight && !fight.lost && !fight.landed) { const t = fight.tension; if (t >= 78) await click(/^Отпустить/); else await click(/^Подтянуть/); continue; }
  if (f.catches > 0) { console.log('CAUGHT! catches', f.catches, 'exp', f.exp); break; }
  if (fight?.lost) { console.log('lost -> reel in'); await click(/Смотать/); continue; }
  if (!f.cast) await click(/Забросить/);
}
console.log('final state:', await fstate());
await p.screenshot({path: `fish2-${style}.png`});
await s.close();
