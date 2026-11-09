import {launch} from './browser.mjs'; import {text} from './helpers.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
pl.level = 30; delete pl.firstJourney; delete pl.firstJourneyDeparture; pl.royalBriefingStep = 99; pl.worldPlace = 'settlement'; pl.gold = 1000;
ls[key] = JSON.stringify(save);
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: process.env.ENGINE || './engine-patched.js'});
const p = s.page; await p.waitForTimeout(4000);
const gold = async () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player.gold, key);
console.log('gold start', await gold());
for (let k = 0; k < 2; k++) { if (await p.getByText('Позже').count()) { await p.getByText('Позже').click(); await p.waitForTimeout(400); } }
await p.getByRole('button', {name: 'Меню'}).last().click(); await p.waitForTimeout(800);
if (await p.getByText('Позже').count()) await p.getByText('Позже').click();
await p.getByText('Premium', {exact: true}).first().click(); await p.waitForTimeout(800);
await p.getByRole('button', {name: /Панель Администратора/}).click(); await p.waitForTimeout(2000);
for (let i = 0; i < 12; i++) { await p.getByRole('button', {name: /\+10,000/}).click(); await p.waitForTimeout(150); }
await p.getByRole('button', {name: /\+1 Уровень/}).click(); await p.waitForTimeout(500);
await p.waitForTimeout(1500); console.log('gold after admin grants', await gold());
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.reload(); await p.waitForTimeout(4000);
for (let k = 0; k < 2; k++) { if (await p.getByText('Позже').count()) { await p.getByText('Позже').click(); await p.waitForTimeout(400); } }
await p.getByRole('button', {name: 'Меню'}).last().click(); await p.waitForTimeout(800);
if (await p.getByText('Позже').count()) await p.getByText('Позже').click();
await p.getByText('Клан', {exact: true}).first().click(); await p.waitForTimeout(1500);
let t = await text(p); console.log('--- CLAN\n', t.slice(t.indexOf('Клан'), t.indexOf('Клан') + 700));
const inputs = p.locator('input'); console.log('inputs', await inputs.count());
const create = p.getByRole('button', {name: /Создать/}); console.log('create buttons', await create.allInnerTexts());
if (await create.count()) { await create.first().click(); await p.waitForTimeout(800); }
const ins = p.locator('input, textarea'); const n = await ins.count(); console.log('form fields', n);
for (let i = 0; i < n; i++) console.log('field', i, await ins.nth(i).getAttribute('placeholder'), await ins.nth(i).getAttribute('maxlength'), await ins.nth(i).isVisible());
const vis = []; for (let i = 0; i < n; i++) if (await ins.nth(i).isVisible()) vis.push(ins.nth(i));
const fill = {0: 'Стражи Рассвета', 1: 'SRD', 2: 'Тестовый клан'};
let j = 0; for (let i = 0; i < n; i++) { const ph = (await ins.nth(i).getAttribute('placeholder')) || ''; if (/поиск|найти|Название или тег/i.test(ph)) continue; if (j < 3) await ins.nth(i).fill(fill[j++]).catch(()=>{}); }
const submit = p.getByRole('button', {name: /Создать|Основать/}); console.log('submit', await submit.allInnerTexts());
await submit.last().scrollIntoViewIfNeeded(); await p.mouse.wheel(0, 3000); await p.waitForTimeout(500); await p.screenshot({path: 'shot-clan-form.png'}); const bb = await submit.last().boundingBox(); const nb = await p.locator('nav.game-nav').boundingBox(); console.log('btn box', JSON.stringify(bb), 'nav box', JSON.stringify(nb), 'scrollH', await p.evaluate(() => [document.scrollingElement.scrollHeight, innerHeight, scrollY]));console.log('disabled?', await submit.last().isDisabled(), 'values', await ins.evaluateAll(es => es.map(e => e.value))); await submit.last().click({timeout: 5000}).catch(e => console.log('submit err', e.message.split('\n').slice(-4).join(' / ')));
await p.waitForTimeout(3000);
t = await text(p); console.log('--- AFTER\n', t.slice(t.indexOf('Клан'), t.indexOf('Клан') + 600));
console.log('gold after clan', await gold(), 'clans in world', s.world.tables.clans?.length);
console.log(s.calls.filter(c => /clan/.test(c.path) && c.method === 'POST').map(c => c.path + ' ' + c.status + ' ' + c.body.slice(0, 160)).join('\n'));
await p.screenshot({path: 'shot-clan.png'});
await s.close();
