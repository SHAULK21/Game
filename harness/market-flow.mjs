import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy', W = Number(process.argv[3] || 390), H = Number(process.argv[4] || 844);
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 10, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const own = (id, j) => ({id, owner_telegram_id: 437290420, item_json: j, quantity: 1, equipped_slot: null, locked: false, bound_clan_id: null, origin: 'game_command', created_at: new Date().toISOString()});
const s = await launch({localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.owned_items = [
  own('a1b2c3d4-0000-4000-8000-0000000000a1', {templateId: 'arena_token', name: 'Жетон чемпиона Арены', type: 'material', rarity: 'epic', level: 2, upgradeLevel: 0, stats: {}, icon: '💠', sellPrice: 50, disassembleYield: {}}),
  own('a1b2c3d4-0000-4000-8000-0000000000a2', {templateId: 'x_ring', name: 'Кольцо новобранца', type: 'ring', rarity: 'rare', level: 4, upgradeLevel: 0, stats: {critChance: 4}, icon: '💍', sellPrice: 60, disassembleYield: {}}),
  own('a1b2c3d4-0000-4000-8000-0000000000a3', {templateId: 'pot', name: 'Малое зелье исцеления', type: 'potion', rarity: 'common', level: 1, upgradeLevel: 0, stats: {}, icon: '🧪', sellPrice: 10, disassembleYield: {}})]; }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: W, height: H}); await p.waitForTimeout(5500);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); await p.waitForTimeout(300); }
const res = []; const ok = (name, cond, extra = '') => res.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const layers = () => p.evaluate(() => ({pickers: document.querySelectorAll('.selection-backdrop').length, sheets: [...document.querySelectorAll('.fixed.inset-0')].filter(e => /Выставить на рынок/.test(e.innerText)).length,
  pickerOnTop: (() => { const d = document.querySelector('.selection-dialog'); if (!d) return null; const r = d.getBoundingClientRect(); const pts = [[r.left + r.width / 2, r.top + 20], [r.left + r.width / 2, r.top + r.height / 2], [r.left + 20, r.bottom - 20]]; return pts.every(([x, y]) => d.contains(document.elementFromPoint(x, y))); })()}));
const trigger = () => p.locator('.fixed.inset-0 button', {has: p.locator('.selection-chevron')}).first();
const openSheet = async () => { await p.getByRole('button', {name: /Продать вещь/}).first().click(); await p.waitForTimeout(600); };
await p.locator('nav button').last().click(); await p.waitForTimeout(700); await p.getByRole('button', {name: /^Рынок/}).first().click(); await p.waitForTimeout(1500);
await openSheet();
let L = await layers(); ok('1 sell sheet opens once', L.sheets === 1, JSON.stringify(L));
await trigger().click(); await p.waitForTimeout(500); L = await layers();
ok('2 picker opens, single instance', L.pickers === 1, JSON.stringify(L)); ok('2 picker is topmost & clickable', L.pickerOnTop === true);
const optCount = () => p.locator('.selection-dialog [role=option], .selection-dialog li button, .selection-dialog button:not([aria-label])').count();
const nAll = await optCount();
await p.locator('.selection-dialog [aria-label="Закрыть"], .selection-dialog header button').first().click(); await p.waitForTimeout(400);
L = await layers(); ok('5 picker × closes picker only', L.pickers === 0 && L.sheets === 1, JSON.stringify(L));
const counts = {};
for (const cat of ['Экипировка', 'Ресурсы', 'Зелья', 'Все']) { await p.locator('.fixed.inset-0 button', {hasText: new RegExp('^' + cat + '$')}).first().click().catch(()=>{}); await p.waitForTimeout(300); await trigger().click(); await p.waitForTimeout(400); counts[cat] = await optCount(); const top = (await layers()).pickerOnTop; if (!top) ok('7 category ' + cat + ' picker on top', false); await p.mouse.click(5, 5); await p.waitForTimeout(400); }
ok('7 categories change picker contents', counts['Все'] >= counts['Экипировка'] && new Set(Object.values(counts)).size > 1, JSON.stringify(counts));
L = await layers(); ok('6 outside click closes picker only', L.pickers === 0 && L.sheets === 1, JSON.stringify(L));
await trigger().click(); await p.waitForTimeout(400); ok('8 picker reopens', (await layers()).pickers === 1);
const first = p.locator('.selection-dialog [role=option], .selection-dialog li button').first(); const firstTxt = (await first.innerText().catch(() => '')).split('\n')[0];
await first.click(); await p.waitForTimeout(500);
L = await layers(); const trigTxt = await trigger().innerText().catch(() => '');
ok('4 choosing item closes picker and fills field', L.pickers === 0 && trigTxt.includes(firstTxt.slice(0, 10)), `chosen "${firstTxt}" field "${trigTxt.replace(/\n/g, ' ')}"`);
await p.screenshot({path: `mf-${style}-${W}.png`});
// close sheet with × and reopen → cleared
await p.locator('.fixed.inset-0 button[aria-label^="Закрыть"], .fixed.inset-0 button:text-is("×")').first().click().catch(e => ok('9 sheet × present', false)); await p.waitForTimeout(500);
L = await layers(); ok('9 sheet × closes sheet', L.sheets === 0 && L.pickers === 0, JSON.stringify(L));
await openSheet(); const cleared = (await trigger().innerText().catch(() => '')).includes('Выберите'); ok('10 reopen sheet → state cleared', cleared);
// outside click on sheet
await p.mouse.click(W / 2, 30); await p.waitForTimeout(500); L = await layers(); res.push(`INFO sheet outside click → ${L.sheets ? 'stays open (not designed to close)' : 'closes'}`);
if (!L.sheets) await openSheet();
// full listing
await trigger().click(); await p.waitForTimeout(300); await p.locator('.selection-dialog [role=option], .selection-dialog li button').first().click(); await p.waitForTimeout(300);
const price = p.locator('.fixed.inset-0 input[type=number]'); const nIn = await price.count(); if (nIn) await price.last().fill('500');
const before = s.world.tables.market_listings?.length || 0;
await p.locator('.fixed.inset-0 button', {hasText: /^Выставить$/}).first().click().catch(e => ok('11 list button', false, e.message.split('\n')[0])); await p.waitForTimeout(1500);
ok('11 listing created on server', (s.world.tables.market_listings?.length || 0) === before + 1, `listings ${before}→${s.world.tables.market_listings?.length || 0}`);
console.log(`== ${style} ${W}x${H}\n` + res.join('\n'));
const errs = s.log.filter(l => /pageerror|error/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)); if (errs.length) console.log('ERRORS', errs.slice(0, 3));
await s.close();
