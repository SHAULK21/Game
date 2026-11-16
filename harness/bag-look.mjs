import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 30, silver: 20000, gold: 500, worldPlace: 'settlement', royalBriefingStep: 99}); delete pl.firstJourney; delete pl.firstJourneyDeparture;
const R = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const gear = [['weapon','Меч стража','⚔️',{attack:22}],['weapon','Посох искр','🪄',{magicPower:20}],['helmet','Шлем дозорного','🪖',{defense:9}],['armor','Кольчуга заставы','🛡️',{defense:18,maxHp:40}],['ring','Кольцо ловкости','💍',{critChance:3}],['boots','Сапоги гонца','👢',{dodge:2,defense:4}],['gloves','Перчатки кузнеца','🧤',{attack:5}],['amulet','Оберег костра','📿',{maxHp:60}],['belt','Пояс охотника','🎗️',{defense:5}],['cloak','Плащ разведчика','🧥',{dodge:3}],['pants','Поножи болотника','👖',{defense:8}],['offhand','Щит моста','🛡️',{defense:14}]];
let n = 0;
for (let k = 0; k < 2; k++) for (const [type, name, icon, stats] of gear) { n++; pl.inventory.push({id: 'g' + n, templateId: 'drop_' + type + n, name: name + (k ? ' II' : ''), type, rarity: R[(n * 3) % 5], level: 5 + (n * 7) % 30, upgradeLevel: n % 4, icon, stats, sellPrice: 20 + n * 3, disassembleYield: {silver: 5}}); }
const mats = [['mat_iron_ore','Железная руда','ore'],['mat_wolf_fang','Клык волка','material'],['mat_mana_dust','Магическая пыль','material'],['mat_spider_silk','Паучий шёлк','material'],['mat_bone','Кость','material']];
for (const [t, name, type] of mats) pl.inventory.push({id: t + '_x', templateId: t, name, type, rarity: 'common', level: 1, upgradeLevel: 0, icon: '🧩', stats: {}, sellPrice: 2, disassembleYield: {}, stackCount: 3 + name.length});
pl.inventory.push({id: 'pot1', templateId: 'potion_health_small', name: 'Малое зелье здоровья', type: 'potion', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🧪', stats: {}, sellPrice: 5, stackCount: 7});
if (process.env.TWOH) { pl.equipped = {...(pl.equipped || {}), weapon: {id: 'th1', templateId: 'drop_th', name: 'Двуручный молот', type: 'weapon', rarity: 'rare', level: 10, upgradeLevel: 0, icon: '🔨', stats: {attack: 30}, twoHanded: true, isEquipped: true}};
  delete pl.equipped.offhand;
  pl.inventory.push({id: 'th2', templateId: 'drop_th2', name: 'Двуручная секира', type: 'weapon', rarity: 'epic', level: 20, upgradeLevel: 0, icon: '🪓', stats: {attack: 40}, twoHanded: true}); }
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; if (process.env.PREM) ls['aeth_autoequip_' + 437290420] = '1';
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); if (process.env.PREM) for (const r of w.tables.players) r.premium_until = new Date(Date.now() + 30 * 864e5).toISOString(); }});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(7000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(400); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Сумка/.test(b.textContent))?.click()); await p.waitForTimeout(2500);
console.log('TXT', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 2500));
for (let i = 0; i < 4; i++) { await p.screenshot({path: `bag-${style}-${i}.png`}); await p.evaluate(() => window.scrollBy(0, 650)); await p.waitForTimeout(500); }
if (process.env.PREM) await p.waitForTimeout(15000);
console.log('SORT', await p.evaluate(() => document.querySelector('.ae-bag-sort')?.innerText.replace(/\n/g,' ') + ' | better=' + document.querySelectorAll('.ae-b-better').length + ' over=' + document.querySelectorAll('[data-ae-over]').length + ' tools=' + document.querySelectorAll('[data-ae-bag-tools]').length));
await p.evaluate(() => { const b = [...document.querySelectorAll('.ae-bag-sort button')].find(x => x.textContent === 'Уровень'); b?.scrollIntoView({block: 'start'}); b?.click(); }); await p.waitForTimeout(700); await p.screenshot({path: `bag-${style}-sort.png`});
await p.evaluate(() => [...document.querySelectorAll('.ae-bag-sort button')].find(x => x.textContent === 'Сила')?.click()); await p.waitForTimeout(400);
const tile = await p.evaluate(() => { const t = [...document.querySelectorAll('main button')].find(b => /Ур\.?\s?12|^\+1/.test(b.innerText) && b.querySelector('img')); if (!t) return 'none'; t.scrollIntoView({block: 'center'}); t.click(); return t.outerHTML.slice(0, 1500); });
console.log('TILE', tile); await p.waitForTimeout(1200);
await p.screenshot({path: `bag-${style}-detail.png`});
console.log('DETAIL', (await p.evaluate(() => (document.querySelector('[role=dialog], .bottom-sheet-backdrop, .game-dialog-backdrop') || document.querySelector('main')).innerText)).replace(/\n+/g, ' | ').slice(0, 1500));
const before = await p.evaluate(() => [...document.querySelectorAll('.ae-b-better')].map(b => b.closest('[data-inventory-item]').getAttribute('data-inventory-item') + b.dataset.t).join(','));
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Экипировать$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(1500);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Закрыть|×)$/.test(b.textContent.trim()) || b.getAttribute('aria-label') === 'Закрыть')?.click()); await p.waitForTimeout(800);
const after = await p.evaluate(() => [...document.querySelectorAll('.ae-b-better')].map(b => b.closest('[data-inventory-item]').getAttribute('data-inventory-item') + b.dataset.t).join(','));
console.log('EQUIP before', before); console.log('EQUIP after ', after, '| weapon now', await p.evaluate(() => window.__aeDbgWeapon || ''));
for (const t of ['Зелья', 'Ресурсы', 'Экипировка']) { await p.evaluate(t => [...document.querySelectorAll('main button')].find(b => b.textContent.trim().startsWith(t))?.click(), t); await p.waitForTimeout(600); }
await p.evaluate(() => [...document.querySelectorAll('.ae-bag-sort button')].find(x => x.textContent === 'Уровень')?.click()); await p.waitForTimeout(300);
for (const t of ['Зелья', 'Ресурсы']) { await p.evaluate(t => [...document.querySelectorAll('main button')].find(b => b.textContent.trim().startsWith(t))?.click(), t); await p.waitForTimeout(700);
  console.log('TAB', t, await p.evaluate(() => [...document.querySelectorAll('main [data-inventory-item], main .is-empty')].slice(0, 6).map(e => (e.classList.contains('is-empty') ? 'EMPTY' : 'item') + ':' + (e.style.order || '-')).join(' '))); await p.screenshot({path: `bag-${style}-tab-${t}.png`}); }
await p.evaluate(() => [...document.querySelectorAll('main button')].find(b => b.textContent.trim().startsWith('Экипировка'))?.click()); await p.waitForTimeout(500);
await p.evaluate(() => [...document.querySelectorAll('.ae-bag-sort button')].find(x => x.textContent === 'Сила')?.click());
if (process.env.PREM) { await p.evaluate(() => [...document.querySelectorAll('main button')].find(b => /Массовая продажа/.test(b.textContent))?.click()); await p.waitForTimeout(800);
  console.log('BULK', await p.evaluate(() => (document.querySelector('main').innerText.match(/Массовая продажа[^]{0,300}/) || [''])[0].replace(/\n+/g, ' | ')), 'sortbars', await p.evaluate(() => document.querySelectorAll('.ae-bag-sort').length));
  await p.screenshot({path: `bag-${style}-bulk.png`}); }
console.log('TABS tools', await p.evaluate(() => document.querySelectorAll('[data-ae-bag-tools]').length), 'sortbars', await p.evaluate(() => document.querySelectorAll('.ae-bag-sort').length), 'markers', await p.evaluate(() => document.querySelectorAll('.ae-b-better').length));
await s.close(); process.exit(0);
