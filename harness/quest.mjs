import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {royalBriefingStep: 99, worldPlace: 'field', currentRegionId: 'reg_plains'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.quests[0] = {...save.quests[0], currentCount: 1, completed: true};
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 4; k++) { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(500); }
const gold0 = await p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.gold, key);
await p.locator('nav button').last().click(); await p.waitForTimeout(700);
await p.getByRole('button', {name: /Задания|Квесты|Журнал/}).first().click().catch(()=>{}); await p.waitForTimeout(1000);
const claim = p.getByRole('button', {name: /Забрать|Получить награду|Получить/}).first();
console.log('claim buttons', await p.getByRole('button', {name: /Забрать|Получить/}).count());
await claim.click().catch(e => console.log('claim click fail', e.message.split('\n')[0])); await p.waitForTimeout(1200);
const st = await p.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); return {gold: s.player.gold, q: s.quests[0].claimed}; }, key);
console.log(style, 'gold', gold0, '->', st.gold, 'claimed', st.q);
await s.close();
