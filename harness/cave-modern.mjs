import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 12, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'modern';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{});
await p.getByRole('button', {name: /Отправиться в пещеру/}).first().click(); await p.waitForTimeout(1200);
await p.getByRole('button', {name: /Пещера летучих мышей/}).first().click().catch(e => console.log('card click fail', (e.message.match(/<[^>]+>[^\n]*intercepts[^\n]*/) || [e.message.split('\n')[0]])[0].slice(0, 250)));
await p.waitForTimeout(1500); let t = (await p.innerText('body')).replace(/\n+/g, ' | '); console.log('after card:', t.slice(0, 600));
await p.screenshot({path: 'cave-modern1.png'});
const btns = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')); console.log(btns.slice(0, 30));
const go = p.getByRole('button', {name: /Войти|Начать|Спуститься|Отправиться в подземелье|Вход/}).first();
if (await go.count()) { await go.click().catch(e => console.log('go fail', e.message.slice(0, 200))); await p.waitForTimeout(4500); t = (await p.innerText('body')).replace(/\n+/g, ' | '); console.log('after go:', t.slice(0, 500)); await p.screenshot({path: 'cave-modern2.png'}); }
console.log(s.log.filter(l => /error|warn/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).slice(0, 10).join('\n'));
await s.close();
