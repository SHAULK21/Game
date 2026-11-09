import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', what = process.argv[3] || 'hunt';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 6, energy: 60, arenaTickets: 5, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
const dismiss = async () => { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); };
await dismiss();
const P = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return {lvl: x.level, exp: x.exp, gold: x.gold, energy: x.energy, place: x.worldPlace, rating: x.arenaRating, tickets: x.arenaTickets}; }, key);
const p0 = await P();
if (what === 'hunt') {
  await p.getByRole('button', {name: /Отправиться на поля/}).first().click(); await p.waitForTimeout(1200);
  const go = p.getByRole('button', {name: /Отправиться в путь|Выбрать|Отправиться/}).last(); await go.click().catch(e => console.log('go fail', e.message.split('\n')[0])); await p.waitForTimeout(5000);
} else {
  await p.locator('nav button').last().click(); await p.waitForTimeout(600); await p.getByRole('button', {name: /^Арена/}).first().click(); await p.waitForTimeout(1200);
  await p.getByRole('button', {name: /В бой/}).first().click().catch(e => console.log('arena go fail', e.message.split('\n')[0])); await p.waitForTimeout(2000);
}
await dismiss();
let result = '';
for (let i = 0; i < 70; i++) {
  const b = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim());
  const t = (await p.innerText('body')).replace(/\n+/g, ' | ');
  const m = t.match(/(ПОБЕДА[^|]*|Победа[^|]*|ПОРАЖЕНИЕ[^|]*|Поражение[^|]*)/); if (m && !/Возможн/.test(m[0])) { result = m[0]; break; }
  const atk = b.find(x => /^атака$/i.test(x)) || b.find(x => /^Сразиться|^В бой|Атаковать|Начать бой|НАЧАТЬ ОХОТУ|Начать охоту|Отправиться в путь/i.test(x));
  if (!atk) { if (i % 10 === 0) console.log('waiting; btns:', b.filter(x => x.length < 40).slice(0, 10).join(' / ')); await p.waitForTimeout(1000); continue; }
  await p.getByRole('button', {name: new RegExp('^\\s*' + atk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i')}).first().click().catch(()=>{}); await p.waitForTimeout(800);
}
await p.waitForTimeout(1200);
console.log(style, what, 'result:', result || 'NONE', '| before', JSON.stringify(p0), '| after', JSON.stringify(await P()));
console.log('end btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).filter(x => x.length < 50).slice(0, 10).join(' / '));
await p.screenshot({path: `battle-${what}-${style}.png`});
console.log(s.log.filter(l => /pageerror|error/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).slice(0, 5).join('\n'));
await s.close();
