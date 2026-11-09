import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 12, energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(5000);
const dismiss = async () => { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); };
await dismiss();
await p.getByRole('button', {name: /Отправиться в пещеру/}).first().click(); await p.waitForTimeout(1200);
await p.getByRole('button', {name: 'Войти'}).first().click(); await p.waitForTimeout(3500);
const skip = /^(Покинуть|Охота|Мир|Арена|Сумка|Создание|Ещё|Поселение|Меню|Герой|\d+\/\d+|.*Админ.*|Скрыться|Автобой.*)$/;
let last = '', same = 0;
for (let step = 0; step < 60; step++) {
  await dismiss();
  const t = (await p.innerText('body')).replace(/\n+/g, ' | ');
  const head = (t.match(/Комната \d+ из \d+[^|]*/) || [''])[0] + ' || ' + (t.match(/(ВАШ ХОД|Ваш ход|Победа|Поражение|Подземелье пройдено|Награда)[^|]*/) || [''])[0];
  const btns = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()).filter(x => x && !skip.test(x));
  if (head === last) same++; else same = 0; last = head;
  if (step % 3 === 0 || same > 3) console.log(step, head, '| btns:', btns.slice(0, 6).join(' / '));
  if (same > 6) { console.log('STUCK'); await p.screenshot({path: `cave-stuck-${style}.png`}); break; }
  const pick = btns.find(x => /^Атака|^АТАКА/.test(x)) || btns.find(x => /Далее|Продолжить|Получить|Открыть|Войти|Сразиться|Идти|Забрать|Следующ|Вперёд|Выбрать|благослов|Обыскать|Пройти/i.test(x)) || btns[0];
  if (!pick) { await p.waitForTimeout(1500); continue; }
  await p.getByRole('button', {name: pick}).first().click({timeout: 3000}).catch(e => console.log('click fail', pick, (e.message.match(/<[^>]+>[^\n]*intercepts[^\n]*/) || [''])[0].slice(0, 200)));
  await p.waitForTimeout(900);
}
await p.screenshot({path: `cave-end-${style}.png`});
console.log(s.log.filter(l => /error|warn/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).slice(0, 10).join('\n'));
await s.close();
