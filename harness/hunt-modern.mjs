import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 6, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'modern'; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{});
await p.getByRole('button', {name: /Отправиться на поля/}).first().click(); await p.waitForTimeout(1200);
await p.locator('button', {hasText: '6 видов монстров'}).first().click(); await p.waitForTimeout(1200);
console.log('region btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).filter(x => x.length < 80).join(' / '));
const go = p.getByRole('button', {name: /Отправиться в путь|Начать охоту|Отправиться/}).last(); console.log('go:', await go.innerText().catch(() => '')); await go.click().catch(()=>{}); await p.waitForTimeout(5000);
for (let i = 0; i < 40; i++) { const b = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()); const atk = b.find(x => /^атака$/i.test(x)) || b.find(x => /Начать охоту|^Сразиться/i.test(x)); const t = await p.innerText('body'); if (/Следующий противник|ПОБЕДА|Победа!/.test(t)) { console.log('WON'); break; } if (!atk) { await p.waitForTimeout(900); continue; } await p.getByRole('button', {name: new RegExp('^\\s*' + atk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i')}).first().click().catch(()=>{}); await p.waitForTimeout(700); }
console.log('player', await p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return JSON.stringify({exp: x.exp, gold: x.gold, energy: x.energy, place: x.worldPlace}); }, key));
console.log((await p.innerText('body')).replace(/\n+/g, ' | ').slice(-900));
console.log('btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).filter(x => x.length < 80).join(' / '));
await s.close();
