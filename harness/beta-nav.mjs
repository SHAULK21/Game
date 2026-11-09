import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 25, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy-beta';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{});
for (const name of ['Дом клана', 'Доска поручений', 'Шахтёрский двор', 'Таверна', 'Торговые ряды']) {
  const before = await p.evaluate(() => document.body.innerText.slice(0, 200));
  const b = p.getByRole('button', {name: new RegExp(name)}).first();
  const box = await b.boundingBox().catch(() => null);
  await b.scrollIntoViewIfNeeded().catch(()=>{}); await b.click().catch(e => console.log('click fail', name, (e.message.match(/<[^>]*>[^\n]*intercepts[^\n]*/)||[''])[0].slice(0,300)));
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' / '));
  console.log(name, 'box', JSON.stringify(box), '\n   ->', after.slice(0, 200));
  await p.screenshot({path: `beta-${name}.png`});
  const back = p.getByRole('button', {name: /Назад|Поселение/}).first(); await back.click().catch(()=>{}); await p.waitForTimeout(800);
}
await s.close();
