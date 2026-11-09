import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 16, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy';
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 5551, displayName: 'Борис'}); w.tables.players.find(p => p.telegram_id == 5551).character_name = 'Борис'; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4500);
for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click().catch(()=>{}); await p.waitForTimeout(300); }
await p.locator('nav button').last().click(); await p.waitForTimeout(1000);
console.log('fantasy sheet entry', await p.locator('[data-ae-entry]').count());
await p.locator('[data-ae-entry]').first().scrollIntoViewIfNeeded().catch(()=>{}); await p.screenshot({path: 'ae-menu-fantasy.png'});
await p.getByRole('button', {name: /Журнал|Настройки/}).first().click().catch(()=>{}); await p.waitForTimeout(800);
const adm = p.getByRole('button', {name: /Панель Администратора/}); if (await adm.count()) { await adm.click(); await p.waitForTimeout(1500); }
console.log('admin premium block', await p.locator('[data-ae-admin]').count());
if (await p.locator('[data-ae-admin]').count()) {
  const blk = p.locator('[data-ae-admin]'); await blk.scrollIntoViewIfNeeded();
  await blk.locator('input').first().fill('Борис'); await blk.getByRole('button', {name: 'Найти'}).click(); await p.waitForTimeout(600);
  await blk.locator('.ae-click').first().click(); p.on('dialog', d => d.accept()); await blk.getByRole('button', {name: 'Выдать'}).click(); await p.waitForTimeout(800);
  await blk.screenshot({path: 'ae-admin-premium.png'});
  console.log('boris premium until', s.world.tables.players.find(x => x.telegram_id == 5551).premium_until);
}
console.log(s.log.filter(l => /error/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).join('\n'));
await s.close();
