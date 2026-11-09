import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const base = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(base[key]); Object.assign(save.player, {level: 25, gold: 300000, silver: 80000, miningLevel: 20, alchemyLevel: 10, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
save.player.inventory.push({id: 'g1', templateId: 'x', name: 'Клинок', type: 'weapon', rarity: 'rare', level: 20, upgradeLevel: 1, stats: {attack: 60}, icon: '🗡️', sellPrice: 100, disassembleYield: {silver: 10}, stackCount: 1});
base[key] = JSON.stringify(save); base.aethelgard_interface_style = style; base['aeth_story_seen_437290420'] = JSON.stringify(['reg_plains']);
async function boot() { const s = await launch({localState: base, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.players.find(x => x.telegram_id == 437290420).level = 25; }, engine: '../tgcloud/lib/gameEngine.js'}); const p = s.page; p.setDefaultTimeout(2500); await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.dismiss().catch(() => {})); await p.waitForTimeout(5000); for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); } return {s, p}; }
let {s, p} = await boot();
const nav = (await p.locator('nav button').allInnerTexts()).map(t => t.trim()).filter(Boolean);
await p.locator('nav button').last().click(); await p.waitForTimeout(800);
const menu = [...new Set((await p.locator('main button, .bottom-sheet-backdrop button').allInnerTexts()).map(t => t.split('\n')[0].trim()).filter(t => t && t.length < 30 && !/^[☆★›⌄×]$|^\d|Админ|^60\//.test(t)))].filter(t => !nav.includes(t) && !/^[⚒👥🤝📖]/.test(t));
const PLACES = ['Торговые ряды', 'Доска поручений', 'Мастерская', 'Кузница', 'Лавка алхимика', 'Арена', 'Дом клана', 'Приют спутников', 'Таверна', 'Рыбацкий причал', 'Шахтёрский двор', 'Отправиться на поля', 'Отправиться в пещеру'];
const placeScreens = PLACES.map(m => ({n: 'place:' + m, open: async () => { await p.locator('nav button').first().click(); await p.waitForTimeout(600); const b = p.locator('main button', {hasText: m}).first(); await b.scrollIntoViewIfNeeded({timeout: 1500}); await b.click({timeout: 2000}); }}));
const screens = process.env.PLACES_ONLY ? placeScreens : [...nav.map(n => ({n, open: async () => p.locator('nav button', {hasText: n}).first().click()})), ...menu.map(m => ({n: m, open: async () => { await p.locator('nav button').last().click(); await p.waitForTimeout(500); await p.getByRole('button', {name: m}).first().click(); }}))];
const findings = []; let checkedPickers = 0, checkedModals = 0;
const topInfo = () => p.evaluate(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const overlays = [...document.querySelectorAll('.fixed.inset-0, .selection-backdrop, .game-dialog-backdrop, .bottom-sheet-backdrop, .ae-backdrop')].filter(vis);
  const top = overlays.map(o => { const c = o.querySelector('[role=dialog], section, div') || o; const r = c.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + Math.min(40, r.height / 2); const hit = document.elementFromPoint(x, y); return {cls: String(o.className).slice(0, 50), z: getComputedStyle(o).zIndex, ownsCenter: o.contains(hit)}; });
  return top;
});
for (const sc of screens) {
  await s.close(); ({s, p} = await boot());
  try { await sc.open(); await p.waitForTimeout(900); } catch { continue; }
  const labels = await p.evaluate(() => [...document.querySelectorAll('main button, .game-dialog-backdrop button')].filter(b => b.getBoundingClientRect().height > 0 && !b.disabled).map(b => (b.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 50).slice(0, 40));
  for (const label of [...new Set(labels)]) {
    const before = (await topInfo()).length;
    const b = p.locator('main button').filter({hasText: label}).first();
    if (!(await b.isVisible().catch(() => false))) continue;
    await b.click({timeout: 1500}).catch(() => {}); await p.waitForTimeout(500);
    let info = await topInfo();
    if (info.length > before) {
      checkedModals++;
      // nested pickers inside the newly opened modal
      const trig = p.locator('.fixed.inset-0 button:has(.selection-chevron), .game-dialog-backdrop button:has(.selection-chevron), .bottom-sheet-backdrop button:has(.selection-chevron)');
      const nT = await trig.count();
      for (let i = 0; i < nT; i++) {
        await trig.nth(i).click({timeout: 1500}).catch(e => findings.push(`[${sc.n} › ${label}] picker #${i} trigger not clickable: ${(e.message.match(/<[^>]+>[^\n]*intercepts/) || [''])[0].slice(0, 120)}`));
        await p.waitForTimeout(350); const inf = await topInfo(); checkedPickers++;
        const pk = inf.find(x => /selection-backdrop/.test(x.cls));
        if (!pk) findings.push(`[${sc.n} › ${label}] picker #${i} did not open`);
        else if (!pk.ownsCenter) findings.push(`[${sc.n} › ${label}] picker #${i} COVERED (z=${pk.z}); layers=${JSON.stringify(inf)}`);
        await p.keyboard.press('Escape'); await p.mouse.click(4, 4); await p.waitForTimeout(250);
      }
      const covered = info.filter(x => !x.ownsCenter && !/selection/.test(x.cls));
      if (covered.length > 1) findings.push(`[${sc.n} › ${label}] stacked overlays, lower ones covered: ${JSON.stringify(info)}`);
      // close what we opened
      for (const sel of ['.selection-dialog header button', '.ae-x', '[aria-label^="Закрыть"]', 'button:text-is("×")', 'button:text-is("✕")']) { const c = p.locator(sel); if (await c.count() && await c.last().isVisible().catch(() => false)) await c.last().click({timeout: 800}).catch(() => {}); }
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      if ((await topInfo()).length > before) { await s.close(); ({s, p} = await boot()); await sc.open().catch(() => {}); await p.waitForTimeout(700); }
    }
  }
  // pickers directly on the screen
  const direct = p.locator('main button:has(.selection-chevron)'); const nD = await direct.count();
  for (let i = 0; i < nD; i++) { await direct.nth(i).click({timeout: 1500}).catch(() => {}); await p.waitForTimeout(300); const pk = (await topInfo()).find(x => /selection-backdrop/.test(x.cls)); checkedPickers++; if (pk && !pk.ownsCenter) findings.push(`[${sc.n}] screen picker #${i} COVERED`); await p.keyboard.press('Escape'); await p.mouse.click(4, 4); await p.waitForTimeout(200); }
}
console.log(`${style}: screens ${screens.length}, modals opened ${checkedModals}, pickers checked ${checkedPickers}`);
console.log(findings.length ? findings.join('\n') : 'NO LAYERING PROBLEMS');
await s.close();
