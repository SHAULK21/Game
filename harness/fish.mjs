import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', place = process.argv[3] || 'field';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 8, worldPlace: place, royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
await p.locator('nav button').last().click(); await p.waitForTimeout(700);
await p.getByRole('button', {name: /^Рыбалка/}).first().click(); await p.waitForTimeout(1200);
const st = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return JSON.stringify({stam: x.stamina, fish: x.fishing && {lvl: x.fishing.level, exp: x.fishing.exp, state: x.fishing.state || x.fishing.phase}, inv: x.inventory.length}); }, key);
console.log(style, place, 'before', await st());
for (let i = 0; i < 14; i++) {
  const btns = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()).filter(x => /Заброс|Подсеч|Тянуть|Вытащ|Тащ|Ждать|Забрать|Ещё|Снова|Улов|Подтян|Ловить|Крюч/i.test(x));
  if (i % 3 === 0) console.log(i, 'btns:', btns.slice(0, 4).join(' / '));
  if (!btns.length) { await p.waitForTimeout(1500); continue; }
  await p.getByRole('button', {name: btns[0]}).first().click().catch(()=>{}); await p.waitForTimeout(1300);
}
const t = (await p.innerText('body')).replace(/\n+/g, ' | ');
console.log('after', await st(), '| msgs:', (t.match(/(Сначала[^|]*|Поймано[^|]*|Улов[^|]*|сорвал[^|]*|Недостаточно[^|]*)/gi) || []).slice(0, 4).join(' ## '));
await p.screenshot({path: `fish-${style}-${place}.png`});
await s.close();
