import {launch} from './browser.mjs'; import fs from 'node:fs'; import crypto from 'node:crypto';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 25, exp: 10, gold: 300000, silver: 80000, energy: 60, stamina: 100, worldPlace: 'settlement', royalBriefingStep: 99, miningLevel: 20, alchemyLevel: 12, alchemyEnergy: 40, arenaTickets: 5});
delete pl.firstJourney; delete pl.firstJourneyDeparture;
const mat = (name, n) => ({id: 'm-' + name, templateId: 'mat_' + name, name, type: 'material', rarity: 'common', level: 1, upgradeLevel: 0, icon: '🌿', stats: {}, sellPrice: 5, disassembleYield: {}, stackCount: n});
pl.inventory.push(mat('Лечебная трава', 20), mat('Чистая вода', 20), mat('Уголь', 30), mat('Медная руда', 30), mat('Волчья шкура', 10),
  {id: 'g1', templateId: 'x_blade', name: 'Клинок', type: 'weapon', rarity: 'rare', level: 20, upgradeLevel: 1, stats: {attack: 60}, icon: '🗡️', sellPrice: 100, disassembleYield: {silver: 10}, stackCount: 1},
  {id: 'g2', templateId: 'x_blade', name: 'Клинок', type: 'weapon', rarity: 'rare', level: 20, upgradeLevel: 0, stats: {attack: 60}, icon: '🗡️', sellPrice: 100, disassembleYield: {silver: 10}, stackCount: 1});
save.quests = save.quests.map((q, i) => i === 1 ? {...q, currentCount: q.targetCount, completed: true} : q);
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = JSON.stringify(['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp']);
async function boot() {
  const s = await launch({localState: ls, setupWorld: (w, E) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); w.tables.players.find(p => p.telegram_id == 437290420).level = 25; }, engine: '../tgcloud/lib/gameEngine.js'});
  const p = s.page; p.setDefaultTimeout(3000); await p.setViewportSize({width: 390, height: 844});
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.waitForTimeout(5000);
  const dismiss = async () => { for (let k = 0; k < 2; k++) for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) { const b = p.getByRole('button', {name: t, exact: true}); if (await b.count() && await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => {}); } };
  await dismiss();
  const snap = async () => { const [txt, sv] = await p.evaluate(k => [document.body.innerText, localStorage.getItem(k)], key); return {txt: crypto.createHash('md5').update(txt).digest('hex'), sv: crypto.createHash('md5').update(sv || '').digest('hex'), calls: s.calls.length, len: txt.length}; };
  const closeAll = async () => { await p.keyboard.press('Escape').catch(() => {}); for (const sel of ['.ae-x', '[aria-label^="Закрыть"]', 'button:text-is("×")', 'button:text-is("✕")']) { const b = p.locator(sel); const n = await b.count(); for (let i = 0; i < n; i++) if (await b.nth(i).isVisible().catch(() => false)) await b.nth(i).click({timeout: 800}).catch(() => {}); } };
  
  return {s, p, dismiss, snap, closeAll};
}
let {s, p, dismiss, snap, closeAll} = await boot();
const navNames = (await p.locator('nav button').allInnerTexts()).map(t => t.trim()).filter(Boolean);
const openers = [];
for (const n of navNames) openers.push({name: 'nav:' + n, open: async () => { await p.locator('nav button', {hasText: n}).first().click({timeout: 2000}); }});
await p.locator('nav button').last().click(); await p.waitForTimeout(900);
const menuItems = [...new Set((await p.locator('main button, .bottom-sheet-backdrop button').allInnerTexts()).map(t => t.split('\n')[0].trim()).filter(t => t && t.length < 32 && !/^[☆★›⌄×]$|^\d|Админ|^60\//.test(t)))].filter(t => !navNames.includes(t));
const PLACES = ['Торговые ряды', 'Доска поручений', 'Мастерская', 'Кузница', 'Лавка алхимика', 'Арена', 'Дом клана', 'Приют спутников', 'Таверна', 'Рыбацкий причал', 'Шахтёрский двор', 'Отправиться на поля', 'Отправиться в пещеру'];
if (process.env.ONLY_PLACES) { openers.length = 0; for (const m of PLACES) openers.push({name: 'place:' + m, open: async () => { await closeAll(); await p.locator('nav button').first().click({timeout: 2000}); await p.waitForTimeout(700); const b = p.locator('main button', {hasText: m}).first(); await b.scrollIntoViewIfNeeded({timeout: 1500}); await b.click({timeout: 2000}); }}); }
else for (const m of menuItems) openers.push({name: 'menu:' + m, open: async () => { await closeAll(); await p.locator('nav button').last().click({timeout: 2000}); await p.waitForTimeout(600); await p.getByRole('button', {name: m}).first().click({timeout: 2000}); }});
console.log(style, 'screens:', openers.map(o => o.name).join(', '));
const report = [];
const SKIP = /^(Охота|Мир|Герой|Сумка|Меню|Поселение|Арена|Создание|Ещё|Стиль интерфейса)$/;
for (const o of openers) {
  await s.close(); ({s, p, dismiss, snap, closeAll} = await boot());
  try { await closeAll(); await o.open(); await p.waitForTimeout(1000); await dismiss(); } catch (e) { report.push(`[${o.name}] OPEN FAILED: ${e.message.split('\n')[0]}`); continue; }
  const labels = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.closest('nav') && !b.closest('header') && !b.disabled && b.getAttribute('aria-pressed') !== 'true' && b.getAttribute('aria-selected') !== 'true' && !/(^|\s)(is-active|is-on|active)(\s|$)/.test(b.className); }).map((b, i) => (b.innerText || b.getAttribute('aria-label') || b.title || '').replace(/\s+/g, ' ').trim()).slice(0, 80));
  const seen = new Set(); let tested = 0;
  for (let idx = 0; idx < labels.length; idx++) {
    const label = labels[idx]; if (!label || SKIP.test(label) || seen.has(label) || /Сбросить прогресс|Удалить аккаунт/.test(label)) continue; seen.add(label);
    try { await closeAll(); await o.open(); await p.waitForTimeout(700); await dismiss(); } catch { continue; }
    const btn = p.locator('button').filter({hasText: label.slice(0, 40)}).first();
    if (!(await btn.count()) || !(await btn.isVisible().catch(() => false))) continue;
    const before = await snap(), errs = s.log.length;
    let clickErr = '';
    await btn.scrollIntoViewIfNeeded({timeout: 1500}).catch(() => {});
    await btn.click({timeout: 2500}).catch(e => { clickErr = (e.message.match(/<[^>]+>[^\n]*intercepts[^\n]*/) || [e.message.split('\n')[0]])[0].slice(0, 160); });
    await p.waitForTimeout(800);
    const after = await snap(); tested++;
    const newErr = s.log.slice(errs).filter(l => /error/i.test(l) && !/AudioContext|ERR_FAILED/.test(l));
    if (clickErr) report.push(`[${o.name}] "${label.slice(0, 50)}" CLICK BLOCKED: ${clickErr}`);
    else if (before.txt === after.txt && before.sv === after.sv && before.calls === after.calls) report.push(`[${o.name}] "${label.slice(0, 50)}" NO EFFECT`);
    if (newErr.length) report.push(`[${o.name}] "${label.slice(0, 50)}" CONSOLE: ${newErr[0].slice(0, 200)}`);
  }
  console.log(`${o.name}: ${tested} buttons tested`);
}
const failed = s.calls.filter(c => c.status >= 400).map(c => `${c.method} ${c.path} ${c.status} ${c.body.slice(0, 90)}`);
fs.writeFileSync(`crawl-${style}${process.env.ONLY_PLACES ? '-places' : ''}.txt`, report.join('\n') + '\n\nFAILED API:\n' + [...new Set(failed)].join('\n') + '\n\nPAGE ERRORS:\n' + [...new Set(s.log.filter(l => /pageerror/.test(l)))].join('\n'));
console.log(style, 'issues:', report.length, 'failed api:', new Set(failed).size);
await s.close();
