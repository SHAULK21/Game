import {launch} from './browser.mjs'; import {text} from './helpers.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json'));
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')))});
const p = s.page; await p.waitForTimeout(4000);
const hud = async () => (await text(p)).split('\n').slice(0, 7).join(' | ');
console.log('HUD before', await hud());
await p.getByRole('button', {name: 'Меню'}).last().click(); await p.waitForTimeout(800);
if (await p.getByText('Позже').count()) await p.getByText('Позже').click();
await p.getByText('Premium', {exact: true}).first().click(); await p.waitForTimeout(800);
await p.getByRole('button', {name: /Панель Администратора/}).click(); await p.waitForTimeout(2500);
for (const label of [/\+10,000/, /\+500/, /\+1 Уровень/, /Древний меч/]) {
  const b = p.getByRole('button', {name: label}); console.log(label, 'count', await b.count());
  if (await b.count()) { await b.first().click().catch(e => console.log('click err', e.message.slice(0, 100))); await p.waitForTimeout(800); }
}
await p.getByRole('textbox').filter({hasText: ''}).count();
const days = p.locator('input[type=number]'); console.log('number inputs', await days.count());
const give = p.getByRole('button', {name: /^Выдать$/}); console.log('give', await give.count()); if (await give.count()) { await give.first().click(); await p.waitForTimeout(1500); }
const t = await text(p); const i = t.indexOf('Выдать себе'); console.log('--- after premium\n', t.slice(i, i + 300));
const send = p.getByRole('button', {name: /Отправить|Разослать|Подготовить|Проверить/}); console.log('send buttons', await send.count(), await send.allInnerTexts());
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
const close = p.getByRole('button', {name: /Закрыть|✕|×/}); if (await close.count()) await close.first().click().catch(()=>{});
await p.waitForTimeout(800);
console.log('HUD after', await hud());
console.log(s.log.filter(l=>!/AudioContext/.test(l)).join('\n'));
console.log(s.calls.filter(c=>c.method==='POST').map(c=>c.method+' '+c.path+' '+c.status+' '+c.body.slice(0,150)).join('\n'));
await p.screenshot({path: 'shot-admin2.png', fullPage: true});
await s.close();
