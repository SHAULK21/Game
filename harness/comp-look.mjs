import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 40, gold: 50000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
const G = [['weapon','Меч стража',{attack:22}],['helmet','Шлем дозорного',{defense:9}],['armor','Кольчуга заставы',{defense:18,maxHp:40}],['ring','Кольцо ловкости',{critChance:3}],['boots','Сапоги гонца',{defense:4}],['gloves','Перчатки кузнеца',{attack:5}]];
G.forEach(([type, name, stats], i) => save.player.inventory.push({id: 'cg' + i, templateId: 'drop_' + type + i, name, type, rarity: 'rare', level: 10 + i * 3, upgradeLevel: 0, icon: '⚔️', stats, sellPrice: 20, disassembleYield: {silver: 5}}));
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); const me = w.tables.players.find(p => p.telegram_id == 437290420); me.level = 40;
  if (!process.env.EMPTY) (w.tables.ae_companions ||= []).push({id: 'k1', u: '437290420', name: 'Бран Железный', role: 'tank', lvl: 18, xp: 120, gear: {}}, {id: 'k2', u: '437290420', name: 'Лиара Светлая', role: 'heal', lvl: 9, xp: 30, gear: {}}); }});
const p = s.page; p.on('dialog', d => d.accept()); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(300); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => b.textContent.includes('Поселение'))?.click()); await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('[data-settlement-place="barracks"]')?.click()); await p.waitForTimeout(2500);
await p.evaluate(() => [...document.querySelectorAll('.ae-story button')].forEach(b => b.click())); await p.waitForTimeout(800);
const txt = await p.evaluate(() => (document.querySelector('.ae-panel')?.innerText || 'NO PANEL').replace(/\n+/g, ' | '));
console.log('PANEL', txt.slice(0, 3000));
for (let i = 0; i < 4; i++) { await p.screenshot({path: `comp-${style}-${i}.png`}); await p.evaluate(() => { const b = document.querySelector('.ae-panel .ae-body'); if (b) b.scrollTop += 600; }); await p.waitForTimeout(400); }
console.log('BEST', await p.evaluate(() => [...document.querySelectorAll('.ae-comp-best')].map(b => b.textContent).join(' | ')));
await p.evaluate(() => document.querySelector('.ae-comp-best')?.click()); await p.waitForTimeout(3500);
console.log('AFTER', await p.evaluate(() => [...document.querySelectorAll('.ae-comp')].map(c => c.querySelector('b').textContent + ': ' + c.querySelectorAll('.ae-comp-slot.is-on').length + ' надето; ' + (c.querySelector('.ae-comp-best')?.textContent || 'нет кнопки')).join(' || ')), await p.evaluate(() => document.querySelector('.ae-toast')?.textContent));
await p.evaluate(() => document.querySelector('.ae-panel .ae-body').scrollTop = 0); await p.waitForTimeout(300); await p.screenshot({path: `comp-${style}-after.png`});
await s.close(); process.exit(0);
