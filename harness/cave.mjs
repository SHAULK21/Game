import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 12, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
const b = p.getByRole('button', {name: /Отправиться в пещеру/}).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(1500);
await p.screenshot({path: `cave1-${style}.png`}); let t = await p.innerText('body'); console.log('--- after click\n', t.slice(0, 900).replace(/\n+/g, ' | '));
const btns = await p.getByRole('button').allInnerTexts(); console.log('buttons:', btns.map(x => x.replace(/\n/g, ' ')).filter(x => /Войти|пещер|Пещер|Спуст|Начать|Вход/i.test(x)).slice(0, 12));
const enter = p.getByRole('button', {name: /Войти|Спуститься|Начать|Вход/}).first();
if (await enter.count()) { await enter.click().catch(e => console.log('enter fail', e.message.split('\n').slice(0, 6).join(' / '))); await p.waitForTimeout(2500); await p.screenshot({path: `cave2-${style}.png`}); t = await p.innerText('body'); console.log('--- after enter\n', t.slice(0, 700).replace(/\n+/g, ' | ')); }
for (let i = 0; i < 4; i++) { await p.waitForTimeout(2500); t = await p.innerText('body'); console.log('--- t+' + (i + 1) * 2.5 + 's\n', t.slice(0, 500).replace(/\n+/g, ' | ')); }
await p.screenshot({path: `cave3-${style}.png`});
const btn2 = await p.getByRole('button').allInnerTexts(); console.log('btns now', btn2.map(x => x.replace(/\n/g, ' ')).slice(0, 25));
console.log(s.log.filter(l => /error|warn/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).join('\n'));
await s.close();
