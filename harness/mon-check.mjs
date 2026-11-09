import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 2; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
// tavern
const seen = {};
for (const reg of ['reg_swamp']) {
  for (let k = 0; k < 2; k++) {
    await p.evaluate(r => window.__aethBridge.setPlayer(x => ({...x, level: 40, energy: 60, currentRegionId: r, worldPlace: 'settlement', worldJourney: null, unlockedRegionIds: ['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp']})), reg);
    await p.waitForTimeout(500); for (const b of await p.locator('.ae-story button').all()) await b.click().catch(() => {});
    await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(700);
    const go = p.getByRole('button', {name: /Отправиться (в путь|на поля)/}).first(); await go.click({timeout: 3000}).catch(() => {}); await p.waitForTimeout(1200);
    const go2 = p.getByRole('button', {name: /Отправиться в путь/}).first(); if (await go2.count()) await go2.click({timeout: 2000}).catch(() => {});
    await p.waitForTimeout(4500); await p.screenshot({path: 'mon-swamp-' + k + '.png'}); console.log('imgs', await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => /monsters\//.test(i.src)).map(i => i.src.split('/').pop() + (i.naturalWidth ? '' : '(broken)')).join(',')));
    const info = await p.evaluate(() => { const img = [...document.querySelectorAll('img')].find(i => /generated\/monsters\//.test(i.src)); const name = document.querySelector('.combat-enemy-name, [class*=enemy] h2, [class*=enemy] h3')?.textContent; return (img ? img.src.split('/').pop() : 'noimg') + ' ' + (name || ''); });
    (seen[reg] ||= new Set()).add(info);
    const flee = p.getByRole('button', {name: /Сбежать|Отступить|Бежать/}).first(); if (await flee.count()) { await flee.click().catch(() => {}); await p.waitForTimeout(600); for (const t of ['Да', 'Сбежать', 'Подтвердить']) { const c = p.getByRole('button', {name: t}).last(); if (await c.count()) await c.click().catch(() => {}); } }
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  }
  console.log(reg, [...seen[reg]].join(' | '));
}
await p.screenshot({path: 'mon-check.png'});
await s.close();
