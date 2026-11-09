import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 25, exp: 10, gold: 250000, silver: 40000, worldPlace: 'settlement', royalBriefingStep: 99, miningLevel: 10, alchemyLevel: 8, arenaTickets: 5});
delete pl.firstJourney; delete pl.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
fs.mkdirSync(`shots/${style}`, {recursive: true});
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4000);
const dismiss = async () => { for (const t of ['×', '✕', 'Закрыть меню']) { const b = p.getByRole('button', {name: t, exact: true}); if (await b.count() && await b.first().isVisible().catch(() => false) && await p.locator('.bottom-sheet-backdrop').count()) { await b.first().click().catch(() => {}); await p.waitForTimeout(300); } } for (const t of ['Позже', 'Понятно', 'Закрыть']) { const b = p.getByRole('button', {name: t, exact: true}); if (await b.count() && await b.first().isVisible().catch(() => false)) { await b.first().click().catch(() => {}); await p.waitForTimeout(300); } } };
const inspect = async (label) => {
  await p.evaluate(() => { window.scrollTo(0, 1e6); for (const el of document.querySelectorAll('*')) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) el.scrollTop = 1e6; } }); await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const out = {hOverflow: document.scrollingElement.scrollWidth > innerWidth + 2, badText: [], covered: [], tiny: 0, clipped: []};
    const txt = document.body.innerText;
    for (const re of [/undefined/g, /NaN/g, /\[object [A-Za-z]+\]/g, /\{\d\}/g, /Infinity/g, /null(?![a-zа-я])/g]) { const m = txt.match(re); if (m) out.badText.push(m[0] + '×' + m.length); }
    const nav = document.querySelector('nav'); const navTop = nav && getComputedStyle(nav).visibility !== 'hidden' ? nav.getBoundingClientRect().top : Infinity;
    for (const b of document.querySelectorAll('button, a, input, select, textarea')) {
      const rc = b.getBoundingClientRect(); if (!rc.width || !rc.height || rc.bottom < 0 || rc.top > innerHeight) continue;
      if (b.closest('nav')) continue;
      const cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
      if (cy < innerHeight && cx > 0 && cx < innerWidth) { const el = document.elementFromPoint(cx, cy); if (el && !b.contains(el) && !el.contains(b) && el.closest('nav')) out.covered.push((b.innerText || b.placeholder || b.getAttribute('aria-label') || '').trim().slice(0, 40)); }
      if (b.tagName === 'BUTTON' && (rc.height < 28 || rc.width < 28)) out.tiny++;
      if (rc.right > innerWidth + 2) out.clipped.push((b.innerText || '').trim().slice(0, 30));
    }
    out.covered = [...new Set(out.covered)].slice(0, 6); out.clipped = [...new Set(out.clipped)].slice(0, 6);
    return out;
  });
  const issues = [];
  if (r.hOverflow) issues.push('horizontal-overflow'); if (r.badText.length) issues.push('text:' + r.badText.join(',')); if (r.covered.length) issues.push('covered-by-nav:' + r.covered.join('|')); if (r.clipped.length) issues.push('clipped:' + r.clipped.join('|')); if (r.tiny) issues.push('tiny-buttons:' + r.tiny);
  console.log(`[${style}] ${label}: ${issues.join(' ; ') || 'ok'}`);
  await p.screenshot({path: `shots/${style}/${label.replace(/[^a-zа-я0-9]+/gi, '_')}.png`});
};
await dismiss(); await inspect('home');
const navBtns = await p.locator('nav button').allInnerTexts(); console.log('nav:', navBtns.map(t => t.trim()).join(' | '));
for (const n of navBtns.map(t => t.trim()).filter(Boolean)) { await p.locator('nav button', {hasText: n}).first().click().catch(() => {}); await p.waitForTimeout(1200); await dismiss(); await inspect('nav-' + n); }
await p.locator('nav button').last().click().catch(() => {}); await p.waitForTimeout(1000);
const entries = (await p.locator('main button, [role=main] button, button').allInnerTexts()).map(t => t.split('\n')[0].trim()).filter(t => t && t.length < 30 && !/^[☆★›⌄]$/.test(t));
const uniq = [...new Set(entries)].filter(t => !['Назад', 'Меню', ...navBtns.map(x => x.trim())].includes(t)).slice(0, 40);
console.log('menu entries:', uniq.join(' | '));
for (const e of uniq) {
  await dismiss(); await p.locator('nav button').last().click().catch(() => {}); await p.waitForTimeout(700);
  const b = p.getByRole('button', {name: e}).first(); if (!(await b.count())) continue;
  await b.click({timeout: 3000}).catch(() => {}); await p.waitForTimeout(1300); await dismiss(); await inspect('menu-' + e);
}
const errs = s.log.filter(l => /error|warn/i.test(l) && !/AudioContext|ERR_FAILED|net::/.test(l));
console.log(`[${style}] console issues (${errs.length}):\n` + [...new Set(errs)].slice(0, 25).join('\n'));
const fails = s.calls.filter(c => c.status >= 400); console.log(`[${style}] failed API calls:`, [...new Set(fails.map(c => c.method + ' ' + c.path + ' ' + c.status + ' ' + c.body.slice(0, 100)))].join('\n'));
const freq = {}; for (const c of s.calls) freq[c.method + ' ' + c.path.split('?')[0]] = (freq[c.method + ' ' + c.path.split('?')[0]] || 0) + 1; console.log(`[${style}] api calls:`, JSON.stringify(freq));
await s.close();
