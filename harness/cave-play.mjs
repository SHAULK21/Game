import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: +(process.env.LVL || 12), energy: 60, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; if (process.env.UK) ls.aethelgard_language = 'uk'; if (process.env.SCALE) ls.aeth_ui_scale = process.env.SCALE;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')))});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(6000);
for (let k = 0; k < 6; k++) { await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Понятно|Позже|Закрыть|В бой, герой!?|Продолжить путь)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(300); }
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => b.textContent.includes('Поселение'))?.click()); await p.waitForTimeout(1200);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Отправиться в пещеру/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
console.log('CAVES', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 1500));
await p.screenshot({path: `cave-${style}-list.png`});
if (style === 'fantasy') { await p.evaluate(() => [...document.querySelectorAll('main button')].find(b => /^Войти$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(1200); }
else { await p.evaluate(() => [...document.querySelectorAll('main button, main [role=button]')].find(b => /Пещера летучих мышей/.test(b.textContent))?.click()); await p.waitForTimeout(1200); }
console.log('SHEET', await p.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /Войти|Отправ|Начать|пещер/i.test(t)).join(' | ')));
await p.screenshot({path: `cave-${style}-sheet.png`});
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Войти · /.test(b.textContent.trim()) && !b.disabled)?.click()); await p.waitForTimeout(900);
console.log('ANC', await p.evaluate(() => { const o = document.querySelector('.world-travel-overlay, .fantasy-travel-overlay'); const out = []; let n = o?.parentElement; while (n && n !== document.documentElement) { const cs = getComputedStyle(n); if (cs.transform !== 'none' || cs.filter !== 'none' || cs.willChange !== 'auto' || cs.contain !== 'none' || cs.backdropFilter !== 'none' || cs.perspective !== 'none') out.push(n.tagName + '.' + String(n.className).slice(0, 50) + ` tf=${cs.transform} f=${cs.filter} wc=${cs.willChange} c=${cs.contain} bf=${cs.backdropFilter}`); n = n.parentElement; } return out.join(' || ') || 'clean'; }));
console.log('OVERLAY', await p.evaluate(() => { const o = document.querySelector('.world-travel-overlay, .fantasy-travel-overlay'); if (!o) return 'none'; const r = o.getBoundingClientRect(), cs = getComputedStyle(o); return JSON.stringify({cls: o.className, top: r.top, h: r.height, pos: cs.position, bg: cs.backgroundColor, inner: innerHeight, zoom: document.documentElement.style.zoom, txt: o.innerText.replace(/\n+/g, ' | ').slice(0, 300)}); }));
await p.screenshot({path: `cave-${style}-travel.png`});
await p.waitForTimeout(6000);
const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
let lastSig = '', same = 0;
for (let step = 0; step < 120; step++) {
  const st = await p.evaluate(() => {
    const modal = [...document.querySelectorAll('.fixed.inset-0, [role=dialog], .ae-backdrop, .ae-story')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map(e => (e.innerText || '').replace(/\n+/g, ' / ').slice(0, 160));
    const main = (document.querySelector('main')?.innerText || '').replace(/\n+/g, ' | ');
    const room = (main.match(/Комната \d+ из \d+/) || [''])[0];
    const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.disabled && !b.closest('nav')).map(b => b.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean);
    return {room, combat: document.documentElement.hasAttribute('data-in-combat'), modal, btns: btns.slice(0, 25), head: main.slice(0, 260)};
  });
  if (process.env.SHOT && st.combat) { await p.waitForTimeout(1200); console.log('COMBATTXT', (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\n+/g, ' | ').slice(0, 1500)); await p.screenshot({path: `fight-${style}.png`}); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Атака')?.click()); await p.waitForTimeout(2500); await p.screenshot({path: `fight-${style}-2.png`}); console.log('LOG', (await p.evaluate(() => document.body.innerText)).split('\n').filter(l => /удар|шкоди|урона|накладає|накладывает/i.test(l)).slice(-6).join(' || ')); console.log('H', await p.evaluate(() => document.documentElement.scrollHeight + ' / ' + innerHeight));
  console.log('CLS', await p.evaluate(() => ['Сокрушительный', 'Пробитие'].map(t => { const el = [...document.querySelectorAll('body *')].filter(e => (e.innerText || '').includes(t)).sort((x, y) => x.innerText.length - y.innerText.length)[0]; let n = el; const out = []; for (let i = 0; i < 4 && n; i++) { out.push(n.tagName + '.' + String(n.className).slice(0, 80)); n = n.parentElement; } return t + ' => ' + out.join(' < ') + ' :: ' + (el?.parentElement?.parentElement?.outerHTML || '').slice(0, 700); }).join('\n'))); break; }
  const sig = JSON.stringify([st.room, st.combat, st.btns.slice(0, 8), (st.head.match(/Раунд \d+/) || [''])[0], (st.head.match(/\d+ \/ \d+/g) || []).join()]);
  if (st.room) console.log('ROOMHP', st.room, (st.head.match(/Побед[^|]*/) || [''])[0]);
  if (/Вернуться в подземелье/.test(st.btns.join())) { console.log('RETURNSCREEN', (st.head.match(/Раунд \d+.{0,120}/) || [''])[0]); await p.waitForTimeout(1800); console.log('TIP', await p.evaluate(() => document.querySelector('[data-ae-boss-tip]')?.innerText.replace(/\n/g, ' | ') || 'none')); await p.screenshot({path: `cave-${style}-defeat.png`}); break; }
  if (sig === lastSig) same++; else { same = 0; console.log(step, st.room, st.combat ? 'COMBAT' : '', '| modal:', st.modal.join(' ## ').slice(0, 200), '| btns:', st.btns.slice(0, 12).join(' / ')); }
  lastSig = sig;
  if (same > 6) { console.log('STUCK', JSON.stringify(st).slice(0, 900)); await p.screenshot({path: `cave-${style}-stuck.png`}); break; }
  if (step % 15 === 0) await p.screenshot({path: `cave-${style}-s${step}.png`});
  const pick = [/^Итоги подземелья/, /^Забрать награду/, /^В поселение/, /^Пропустить$/, /^Далее$/, /^Получить благословение/, /^Обыскать/, /^Отдохнуть/, /^Исследовать/, /^Пройти/, /^Взять/, /^Открыть/, /^Продолжить$/, /^Продолжить подземелье/, /^Продолжить поход/, /^Сразиться с врагом/, /^Сразиться с боссом/, /^Понятно/, /^Забрать/, /^Дальше/, /^Следующая комната/, /^Идти дальше/, /^В следующую/, /^Открыть сундук/, /^Атаковать$/, /^Удар/, /^Атака/, /^В бой/, /^Сразиться/, /^Вернуться/, /^Выйти/, /^Закрыть/];
  const clicked = await p.evaluate(pick => { const bs = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.disabled && !b.closest('nav')); for (const src of pick) { const re = new RegExp(src); const b = bs.find(x => re.test(x.textContent.trim())); if (b) { b.click(); return b.textContent.trim().slice(0, 40); } } return null; }, pick.map(r => r.source));
  if (!clicked) { console.log('NOACTION', st.btns.join(' / ')); }
  await p.waitForTimeout(clicked && /Атак|Удар/.test(clicked) ? 900 : 1300);
  if (/Итоги похода|Подземелье пройдено!|Поход завершён/.test(st.head + st.modal.join(' '))) { console.log('END', st.head.slice(0, 300), st.modal.join(' ## ').slice(0, 300)); await p.screenshot({path: `cave-${style}-end.png`}); break; }
}
console.log('ERRORS', errs.join(' || ') || 'none');
await s.close(); process.exit(0);
