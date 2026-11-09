import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy', mode = process.argv[3] || 'die';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 3, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory = save.player.inventory.filter(i => i.type !== 'potion');
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
const dismiss = async () => { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); };
await dismiss();
const st = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)); return `place=${x.player.worldPlace} run=${!!x.activeDungeonRun} hp=${x.player.hp ?? '?'} energy=${x.player.energy}`; }, key);
await p.getByRole('button', {name: /Отправиться в пещеру/}).first().click(); await p.waitForTimeout(1200);
if (style === 'fantasy') await p.getByRole('button', {name: 'Войти'}).nth(2).click(); else { await p.getByRole('button', {name: /Паучье логово/}).first().click(); await p.getByRole('button', {name: /Войти · 15/}).click(); }
await p.waitForTimeout(4000); console.log('entered:', await st());
if (mode === 'leave') { await p.getByRole('button', {name: /^Покинуть$/}).first().click().catch(e => console.log('no leave', e.message.split('\n')[0])); await p.waitForTimeout(1500); }
else for (let i = 0; i < 45; i++) {
  await dismiss();
  const b = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim());
  const pick = b.find(x => /^(АТАКА|Атака)$/.test(x)) || b.find(x => /Сразиться|Продолжить подземелье|Открыть сундук|Получить|Вернуться в город|В город|К бою/i.test(x));
  if (!pick) { if (i % 10 === 0) console.log('no action; btns', b.slice(0, 8).join(' / ')); await p.waitForTimeout(800); continue; }
  await p.getByRole('button', {name: new RegExp('^\\s*' + pick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i')}).first().click().catch(()=>{}); await p.waitForTimeout(700);
  const t = (await p.innerText('body')).replace(/\n+/g, ' | ');
  const m = t.match(/(Поражение[^|]*|Вы пали[^|]*|погиб[^|]*|Герой повержен[^|]*|Награда[^|]*зачислена[^|]*)/); if (m) { console.log('event:', m[0]); }
  if (/Поражение|пали|повержен/i.test(t) && !/Возможный/.test(m?.[0] || '')) { await p.waitForTimeout(1500); break; }
}
await p.waitForTimeout(1500);
console.log('after:', await st()); const t = (await p.innerText('body')).replace(/\n+/g, ' | '); console.log('screen:', t.slice(0, 300));
console.log('btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).slice(0, 12).join(' / '));
await p.screenshot({path: `cave-${mode}-${style}.png`});
await p.getByRole('button', {name: /Вернуться в подземелье/}).click().catch(e => console.log('no return btn')); await p.waitForTimeout(1500);
console.log('after return:', await st()); console.log('screen2:', (await p.innerText('body')).replace(/\n+/g, ' | ').slice(0, 400));
console.log('btns2:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).slice(0, 12).join(' / '));
await p.screenshot({path: `cave-${mode}-${style}-2.png`});
for (const t of [/Сразиться/, /Покинуть/]) { const b = p.getByRole('button', {name: t}).first(); if (await b.count()) { console.log('click', t); await b.click().catch(()=>{}); await p.waitForTimeout(1800); console.log('  ->', await st(), (await p.innerText('body')).replace(/\n+/g, ' | ').slice(0, 250)); break; } }
// try fishing now
await p.locator('nav button').last().click().catch(()=>{}); await p.waitForTimeout(700); await p.getByRole('button', {name: /^Рыбалка/}).first().click().catch(()=>{}); await p.waitForTimeout(1000);
await p.getByRole('button', {name: /Забросить/}).first().click().catch(e => console.log('no cast btn')); await p.waitForTimeout(800);
console.log('fishing after dungeon:', (await p.innerText('body')).replace(/\n+/g, ' | ').match(/(Рыбалка доступна[^|]*|Ожидание поклёвки[^|]*|Сначала[^|]*)/)?.[0]);
await s.close();
