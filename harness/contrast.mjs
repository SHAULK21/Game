import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 18, gold: 2000, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = '["reg_plains","reg_whisper_woods","reg_forgotten_crypt","reg_forest"]';
const s = await launch({localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(3000); await p.setViewportSize({width: 390, height: 844});
await p.waitForTimeout(5000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.waitForTimeout(250); }
const scan = () => p.evaluate(() => {
  const rgb = s => { const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const L = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(); if (t.length < 2) continue;
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const fg = rgb(cs.color); if (!fg) continue; let bg = null, by = null;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const st = getComputedStyle(a);
      const g = st.backgroundImage.includes('gradient') && rgb(st.backgroundImage); if (g && g[3] > .5) { bg = g; by = a; break; }
      if (st.backgroundImage.includes('url(')) break;
      const c = rgb(st.backgroundColor); if (c && c[3] > .5) { bg = c; by = a; break; } }
    if (!bg) continue;
    const l1 = L(fg), l2 = L(bg), cr = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    if (cr < 2.2) out.push(`${cr.toFixed(2)} "${t.slice(0, 40)}" <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 70)}"> on <${by.tagName.toLowerCase()} class="${String(by.className).slice(0, 70)}">`);
  }
  return out;
});
const seen = new Set(); const report = async label => { for (const x of await scan()) { const k = x.replace(/^[\d.]+ /, ''); if (!seen.has(k)) { seen.add(k); console.log(label, '|', x); } } };
const clickNav = async n => { await p.keyboard.press('Escape').catch(() => {}); const b = p.locator('nav button', {hasText: n}).first(); if (await b.count()) { await b.click({timeout: 2000}).catch(e => console.log('navfail', n, e.message.split('\n')[0])); await p.waitForTimeout(900); return true; } return false; };
const navs = (await p.locator('nav button').allInnerTexts()).map(x => x.trim()).filter(Boolean);
console.log('navs', navs.join(','));
const visited = new Set(); const T0 = Date.now();
async function sweep(label, depth) {
  await report(label);
  if (depth > 1) return;
  const btns = await p.locator('main button:visible, [role=dialog] button:visible').evaluateAll(bs => bs.map((b, i) => [i, (b.innerText || b.getAttribute('aria-label') || '').trim().split('\n')[0].slice(0, 30)]));
  for (const [i, t] of btns.slice(0, 40)) {
    if (!t || visited.has(t) || /Продать|Разобрать|Удалить|Купить|Сбросить|Выйти|Покинуть|Отправиться|Войти|Выпить|Атак|В бой|Создать|Отправить|Принять|Отклон|Надеть|Снять|Заточ|Выбросить|Использ|Вознес|Применить|Начать|Сразиться|Бой|Охот|Добыть|Ловить|Сварить/i.test(t)) continue;
    visited.add(t);
    const b = p.locator('main button:visible, [role=dialog] button:visible').nth(i);
    await b.click({timeout: 1500}).catch(() => {}); await p.waitForTimeout(600);
    await report(label + '>' + t);
    if (depth < 1 && Date.now() - T0 < 420000) await sweep(label + '>' + t, depth + 1);
    for (let k = 0; k < 2; k++) { await p.mouse.wheel(0, 700); await p.waitForTimeout(250); await report(label + '>' + t + '/scroll'); }
    await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(200);
  }
}
for (const n of [...navs].reverse()) { await clickNav(n); await sweep(n, 0); await clickNav(n); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, 700); await p.waitForTimeout(250); await report(n + '/scroll'); } }
console.log('navs', navs.length, 'seen', seen.size);
await s.close();
