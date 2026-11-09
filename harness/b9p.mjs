import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 14, energy: 30, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.level = 30; save.player.inventory.push({id: 'gear-1', templateId: 'x', name: 'Клинок сумеречного леса', type: 'weapon', rarity: 'uncommon', level: 12, upgradeLevel: 2, stats: {attack: 80}, icon: '⚔️', sellPrice: 40, disassembleYield: {}, stackCount: 1}); ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']);
const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); new E.NativePool(w, () => Date.now()).ensurePlayer({id: 555, displayName: 'Борис'});
  Object.assign(w.tables.players.find(p => p.telegram_id == 555), {character_name: 'Борис', level: 16, class_id: 'druid'}); w.tables.players.find(p => p.telegram_id == 437290420).level = 14; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(5000); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
// tavern
const shot = async n => p.screenshot({path: `b9-${n}-${style}.png`});
const dismissStory = async () => { const b = p.locator('.ae-story button'); if (await b.count()) { const t = await p.locator('.ae-story h2').innerText(); await b.click(); await p.waitForTimeout(400); return t; } return null; };
console.log('story at start (plains seen):', await dismissStory());
// 1. hunt modes spoiler
await p.locator('nav button', {hasText: 'Мир'}).first().click(); await p.waitForTimeout(1200);
const land = p.locator('main [role=button], main button').filter({hasText: /Зеленые равнины|Зелёные равнины/}).first(); await land.click().catch(() => {}); await p.waitForTimeout(1000);
console.log('modes toggle', await p.locator('[data-ae-modes]').count(), 'values visible', await p.locator('.hunting-mode-values:visible').count()); await shot('modes');
if (await p.locator('[data-ae-modes]').count()) { await p.locator('[data-ae-modes]').click(); await p.waitForTimeout(300); console.log('after open values visible', await p.locator('.hunting-mode-values:visible').count()); await p.locator('[data-ae-modes]').click(); }
// monsters per region: read bestiary from engine data via world tiles text
// 8. travel + 6. story on a new region: switch region to whisper woods and travel
await p.evaluate(() => window.__aethBridge.setPlayer(p => ({...p, currentRegionId: 'reg_whisper_woods', unlockedRegionIds: [...(p.unlockedRegionIds || []), 'reg_whisper_woods']})));
await p.waitForTimeout(2500); console.log('story for new region:', await dismissStory());
// 3. pets icons
await p.keyboard.press('Escape'); await p.locator('nav button', {hasText: 'Поселение'}).first().click(); await p.waitForTimeout(900); await p.locator('nav button', {hasText: 'Поселение'}).first().click(); await p.waitForTimeout(900); await p.locator('[data-settlement-place="pets"]').first().click().catch(() => {}); await p.waitForTimeout(1500);
console.log('pet icons', await p.locator('.ae-pet-icon').count(), (await p.locator('main').innerText()).replace(/\n/g,' | ').slice(0,700)); console.log(await p.evaluate(() => { const e = [...document.querySelectorAll('main *')].find(x => !x.childElementCount && (x.textContent||'').trim() === 'Огненный дракончик'); let c = e; for (let i=0;i<4;i++) c = c.parentElement; return c.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g,'<svg/>').slice(0, 1400); })); await shot('pets');
await p.evaluate(() => document.querySelector('.pet-codex-list').lastElementChild.scrollIntoView()); await p.waitForTimeout(500); await p.screenshot({path:'b9-pets2.png'}); console.log(await p.evaluate(() => [...document.querySelectorAll('.pet-artwork')].map(e => e.getAttribute('aria-label') + ': ' + e.innerHTML.slice(0, 300)).join('\n')));
await s.close();
