import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); const pl = save.player;
Object.assign(pl, {level: 30, royalBriefingStep: 99, worldPlace: 'settlement', silver: 500000, gold: 500000, energy: 100, ascension: {rank: process.env.RANK || 'E', trialsWon: process.env.WON ? ['D'] : []}}); if (process.env.WON) pl.inventory.push({id: 'frag-1', templateId: 'ascension_fragment', name: 'Осколок вознесения', type: 'material', rarity: 'rare', level: 1, upgradeLevel: 0, icon: '✦', stats: {}, sellPrice: 0, disassembleYield: {}, stackCount: 5}); delete pl.firstJourney; delete pl.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; if (process.env.SCALE) ls.aeth_ui_scale = process.env.SCALE; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains', 'reg_whisper_woods', 'reg_forgotten_crypt', 'reg_forest', 'reg_swamp']);
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')))});
const p = s.page; const ERR = []; p.on('pageerror', e => ERR.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') ERR.push(m.text().slice(0, 200)); }); p.setDefaultTimeout(5000); await p.setViewportSize({width: Number(process.env.VW || 390), height: 780});
await p.waitForTimeout(6000);
for (let k = 0; k < 3; k++) { for (const t of ['Позже', 'В бой, герой!']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.locator('.ae-story button').first().click({timeout: 500}).catch(() => {}); await p.waitForTimeout(300); }
const clickText = re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button, a, [role=button]')].find(x => re.test((x.textContent || '').trim())); b?.click(); return b ? b.textContent.trim().slice(0, 40) : null; }, re.source);
console.log('nav arena:', await clickText(/^Арена$/)); await p.waitForTimeout(1500);
if (!(await p.evaluate(() => /Вознесени/.test(document.body.innerText)))) { await clickText(/^(Меню|Ещё)$/); await p.waitForTimeout(800); await clickText(/^Позже$/); console.log('menu arena:', await clickText(/^\s*Арена/)); await p.waitForTimeout(1500); }
console.log('asc tab:', await clickText(/Вознесени/)); await p.waitForTimeout(3000);
console.log('DBGP', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main *')].filter(e => /Подготовка: герой примерно|Реальная сила стража/.test(e.textContent || '') && e.childElementCount === 0).map(e => e.tagName + ' kids=' + e.childElementCount + ' ds=' + JSON.stringify(e.dataset) + ' ' + e.textContent.slice(0, 60))))); console.log('HERO', JSON.stringify(await p.evaluate(() => window.__aeHero)));
const t1 = await p.evaluate(() => document.querySelector('main')?.innerText || ''); const i = t1.indexOf('ознесен'); console.log('ASC TEXT:', t1.slice(Math.max(0, i - 50), i + 900).replace(/\n+/g, ' | '));
await p.screenshot({path: `asc-${style}-1.png`, fullPage: true});
console.log('BTNS:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()).filter(x => x && x.length < 60).join(' / ').slice(0, 900));
if (process.env.WON) {
  console.log('BTNSTATE', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => /Вознестись|хранителя/.test(b.textContent)).map(b => ({t: b.textContent.trim().slice(0, 40), dis: b.disabled, title: b.title})))));
  const tA = await p.evaluate(() => document.querySelector('main')?.innerText || ''); const iA = tA.indexOf('Испытание'); console.log('NEAR', tA.slice(iA, iA + 1200).replace(/\n+/g, ' | '));
  console.log('STATUS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main [role=status]')].map(e => e.textContent.trim()).filter(Boolean)))); console.log('RADIOS', await p.evaluate(() => [...document.querySelectorAll('input[name=ascension-path]')].map(r => r.parentElement.textContent.trim().slice(0, 40) + (r.checked ? ' [x]' : '')).join(' / ')));
  await p.waitForTimeout(900); console.log('HIGHLIGHT', await p.locator('.ae-asc-pick').count(), await p.locator('.ae-asc-need').count());
  console.log('ascend:', await clickText(/^Вознестись до/)); await p.waitForTimeout(1200);
  const tB = await p.evaluate(() => document.querySelector('main')?.innerText || ''); console.log('DIFF', tB === tA ? 'no change' : tB.slice(tB.indexOf('Испытание'), tB.indexOf('Испытание') + 600).replace(/\n+/g, ' | '));
  console.log('dialog:', (await p.evaluate(() => document.querySelector('[role=dialog]')?.innerText || 'none')).replace(/\n+/g, ' | ').slice(0, 500));
  console.log('confirm:', await clickText(/Подтвердить вознесение|^Вознестись$/)); await p.waitForTimeout(2500);
  const tt = await p.evaluate(() => document.body.innerText); console.log('AFTER', (tt.match(/(Вознесение завершено|Не хватает|Не удалось|Ранг вознесения [A-Z]+|ошибк)[^\n]{0,100}/gi) || []).slice(0, 4).join(' | '));
  console.log('SAVE rank', await p.evaluate(k => JSON.stringify(JSON.parse(localStorage.getItem(k)).player.ascension), 'aethelgard_save_v1_data_437290420'));
  console.log('server calls', JSON.stringify(s.calls.filter(c => /ascen|dispose|consume|profile\/asc/.test(c.path)).map(c => c.path + ' ' + c.status + ' ' + String(c.body || '').slice(0, 120))));
} else {
console.log('call:', await clickText(/^Вызвать хранителя/)); await p.waitForTimeout(2500);
for (const t of ['Начать', 'В бой', 'Сразиться', 'Подтвердить']) { const r = await clickText(new RegExp('^' + t)); if (r) { console.log('start btn', r); await p.waitForTimeout(1500); } }
const C = () => p.evaluate(() => { const c = window.__aethBridge?.combat; return c ? {in: c.inCombat, turn: c.turn, phase: c.phase, hp: c.hp, mp: c.mp, m: c.monster?.name, mhp: c.monster?.hp, region: c.monster?.regionId, ended: c.ended} : null; });
console.log('NATIMGS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main img')].map(i => i.getAttribute('src')).filter(x => !/icons|ui\//.test(x)).slice(0, 12)))); console.log('C0', JSON.stringify(await C()), 'scene', await p.locator('[data-ae-scene]').count());
await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); await p.waitForTimeout(400); await p.screenshot({path: `asc-${style}-2-${process.env.RANK || 'E'}.png`});
for (let k = 0; k < 25; k++) { const c = await C(); if (!c?.in || c.ended) break; const r = await clickText(/^Атака$/); if (!r) { console.log('no attack btn; btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()).filter(x => x.length < 40).slice(0, 14).join(' / ')); break; } await p.waitForTimeout(1600); if (k % 4 === 0) console.log('turn', k, JSON.stringify(await C())); }
console.log('END', JSON.stringify(await C())); const tt = await p.evaluate(() => document.body.innerText); console.log('RESULT', (tt.match(/(ПОБЕДА|Победа|ПОРАЖЕНИЕ|Поражение|Испытание пройдено|не пройдено)[^\n]{0,80}/) || ['none'])[0]);
await p.screenshot({path: `asc-${style}-3.png`});
}
console.log('ERR', ERR.join(' ## ').slice(0, 1500));
await s.close();
