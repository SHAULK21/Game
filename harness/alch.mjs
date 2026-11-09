import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.alchemyExp = 195; save.player.alchemyLevel = 1; save.player.alchemyEnergy = 100; for (const k of ['Лечебная трава','Чистая вода']) save.player.inventory.push({id: 'mat-'+k, templateId: 'm-'+k, name: k, type: 'material', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🌿', stats: {}, sellPrice: 1, disassembleYield: {}, stackCount: 30}); save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
await p.waitForTimeout(5000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.evaluate(() => document.querySelector('[data-settlement-place="alchemy"]').click()); await p.waitForTimeout(1500);
const txt = async () => (await p.locator('main').innerText()).replace(/\n/g, ' | ');
console.log('screen:', (await txt()).slice(0, 700));
await p.screenshot({path: `alch-${style}.png`, fullPage: true});
const brew = p.locator('main button').filter({hasText: /Сварить|Варить/}); console.log('btn texts:', JSON.stringify((await p.locator('main button').allInnerTexts()).filter(t => /вар/i.test(t)).slice(0, 3)));
console.log('brew buttons:', await brew.count(), (await brew.allInnerTexts()).slice(0, 4));
for (let i = 0; i < 2; i++) { await brew.first().click({force: true}).catch(e => console.log('click', e.message.slice(0, 60))); await p.waitForTimeout(3000);
  console.log('exp/lvl:', await p.evaluate(() => { const x = window.__aethBridge.player; return `${x.alchemyExp} / L${x.alchemyLevel} / energy ${x.alchemyEnergy} / inv ${x.inventory.length}/${x.maxInventorySlots}`; }), '| msg:', ((await txt()).match(/(Зелье успешно[^|]*|Не удалось[^|]*)/) || [''])[0].slice(0, 140)); }
await p.waitForTimeout(2500); console.log('notes:', JSON.stringify((await p.locator('.ae-alch-note').allInnerTexts()).slice(0, 4))); console.log('chips:', JSON.stringify((await p.locator('[data-ae-ing]').allInnerTexts()).slice(0, 6))); await p.locator('.ae-alch-note').first().scrollIntoViewIfNeeded().catch(() => {}); await p.screenshot({path: `alch2-${style}.png`});
console.log('first card:', await p.evaluate(() => { const b = [...document.querySelectorAll('main button')].find(x => /Сварить/.test(x.textContent)); let c = b, path = []; for (let i = 0; i < 7 && c; i++, c = c.parentElement) path.push(c.tagName + ':' + c.querySelectorAll('[data-ae-ing]').length); return path.join(' > ') + ' | note: ' + !!b.parentElement.querySelector('.ae-alch-note'); }));
console.log('dbg:', await p.evaluate(() => { const b = [...document.querySelectorAll('main button')].find(x => /Сварить/.test(x.textContent)); const sec = b.closest('section'); return JSON.stringify({btn: b.textContent, chips: [...sec.querySelectorAll('[data-ae-ing]')].map(e => e.className + '=' + e.textContent), parentKids: [...b.parentElement.children].map(e => e.className.slice(0, 40))}); }));
console.log('after:', (await txt()).match(/До уровня[^|]*\|[^|]*/)?.[0]);
console.log(s.log.filter(l => /pageerror|error/i.test(l)).slice(0, 5).join('\n'));
await s.close();
