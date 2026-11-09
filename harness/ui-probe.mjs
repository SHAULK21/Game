import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2];
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 25, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4500);
for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click().catch(()=>{}); await p.waitForTimeout(300); }
const anc = sel => p.evaluate(sel => { const el = typeof sel === 'string' ? document.querySelector(sel) : null; if (!el) return 'none'; const out = []; let e = el; while (e && out.length < 7) { const cs = getComputedStyle(e); out.push(`${e.tagName}.${String(e.className).slice(0, 80)} pos=${cs.position} bottom=${cs.bottom} pb=${cs.paddingBottom}`); e = e.parentElement; } return out.join('\n  '); }, sel);
const go = async label => { await p.locator('nav button').last().click().catch(()=>{}); await p.waitForTimeout(600); const b = p.getByRole('button', {name: label}).first(); await b.scrollIntoViewIfNeeded().catch(()=>{}); await b.click().catch(()=>{}); await p.waitForTimeout(1200); };
if (style === 'modern') {
  await go('Чат'); console.log('CHAT input:\n  ' + await anc('textarea, input[placeholder*="Сообщение"]'));
  console.log('tiny buttons:', JSON.stringify(await p.evaluate(() => 1)));
  for (const scr of ['Настройки', 'Оповещения']) { await go(scr); console.log(scr, JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.height < 28 || r.width < 28) && !b.closest('nav'); }).map(b => ({t: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 30), cls: b.className.slice(0, 100), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height)}))))); }
  await p.locator('nav button', {hasText: 'Сумка'}).click(); await p.waitForTimeout(1000);
  console.log('Сумка', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.height < 28 || r.width < 28) && !b.closest('nav'); }).map(b => ({t: (b.innerText || b.getAttribute('aria-label') || '').slice(0, 30), cls: b.className.slice(0, 100), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height)})))));
} else {
  await go('Герой'); console.log('HERO stat row:', await p.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^Здоровье$/.test(e.textContent.trim())); if (!el) return 'none'; const row = el.parentElement.parentElement; return row.outerHTML.slice(0, 900); }));
}
await s.close();
