import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 12, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{});
const st = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)); return `place=${x.player.worldPlace} run=${!!x.activeDungeonRun}`; }, key);
p.on('dialog', d => d.accept());
const txt = async () => (await p.locator('main').innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 260);
const btns = async () => (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()).filter(x => x && x.length < 50).slice(0, 22).join(' / ');
// --- dungeon fight
for (let k = 0; k < 3; k++) { const b = p.locator('.ae-story button'); if (await b.count()) await b.first().click().catch(() => {}); for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(700); }
await p.locator('.ae-pop-x').first().click().catch(() => {});
await p.getByRole('button', {name: /Отправиться в пещеру/}).first().click({force: true}); await p.waitForTimeout(1200);
if (style === 'fantasy') await p.getByRole('button', {name: 'Войти'}).first().click(); else { await p.getByRole('button', {name: /Пещера летучих мышей/}).first().click(); await p.getByRole('button', {name: /Войти · 15/}).click(); }
await p.waitForTimeout(4500);
for (let i = 0; i < 25 && !(await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat'))); i++) {
  const names = (await p.locator('main button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()).filter(x => x && !/^Покинуть|Назад/.test(x));
  if (!names.length) break; await p.locator('main button', {hasText: names[0].slice(0, 14)}).first().click({force: true}).catch(() => {}); await p.waitForTimeout(1600); }
console.log('dungeon in-combat:', await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')), '|', await txt()); console.log('  btns:', await btns());
await p.screenshot({path: `nat-dungeon-${style}.png`});
fs.writeFileSync(`nat-dungeon-${style}.html`, await p.evaluate(() => document.querySelector('main').innerHTML));
await s.close();
