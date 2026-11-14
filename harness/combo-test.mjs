import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', what = process.argv[3] || 'hunt';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 7, energy: 60, arenaTickets: 5, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const s = await launch({pageOptions: {viewport: {width: 360, height: 760}, deviceScaleFactor: 3, isMobile: true, hasTouch: true}, localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000);
if (process.argv[4] === 'apk') { await p.addInitScript(() => { const pref = {}; window.AethApk = {version: () => 3, versionName: () => '1.0.5', linked: () => true, saveLogin() {}, logout() {}, schedule() {}, cancel() {}, vibrate() {}, setPref: (k, v) => { pref[k] = v; }, getPref: (k, d) => k in pref ? pref[k] : d, keepAwake() {}, share() {}, copy() {}, paste: () => '', openExternal() {}, reload() {}}; }); await p.reload(); }
await p.waitForTimeout(5000);
const geo = async tag => console.log('GEO', tag, JSON.stringify(await p.evaluate(() => { const hd = document.querySelector('header'); const r = hd?.getBoundingClientRect(); return {scrollY: scrollY, docScroll: document.scrollingElement.scrollTop, inner: innerHeight, clientW: document.documentElement.clientWidth, zoom: document.documentElement.style.zoom, meta: document.querySelector('meta[name=viewport]')?.content, hdTop: r && Math.round(r.top), hdH: r && Math.round(r.height), vv: visualViewport && [Math.round(visualViewport.offsetTop), Math.round(visualViewport.height), visualViewport.scale]}; })));
await geo('start'); console.log('SKILLS', JSON.stringify(await p.evaluate(() => (window.__aethBridge.player.skills || []).map(k => [k.id, k.comboFrom, k.comboAlt, k.comboMultiplier, k.levelReq]))));
const dismiss = async () => { for (const t of ['Позже', 'В бой, герой!', 'Продолжить путь']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(()=>{}); };
await dismiss(); console.log('OVERLAY', (await p.locator('div.fixed.inset-0').first().innerText().catch(() => 'none')).slice(0, 300).replace(/\n/g, ' | '));
const P = () => p.evaluate(k => { const x = JSON.parse(localStorage.getItem(k)).player; return {lvl: x.level, exp: x.exp, gold: x.gold, energy: x.energy, place: x.worldPlace, rating: x.arenaRating, tickets: x.arenaTickets}; }, key);
const p0 = await P();
for (let k = 0; k < 4; k++) { await dismiss(); await p.locator('.ae-x').first().click({timeout: 500}).catch(() => {}); await p.waitForTimeout(500); }
if (what === 'hunt') {
  await p.getByRole('button', {name: /Отправиться на поля/}).first().click(); await p.waitForTimeout(1200);
  const go = p.getByRole('button', {name: /Отправиться в путь|Выбрать|Отправиться/}).last(); await go.click().catch(e => console.log('go fail', e.message.split('\n')[0])); await p.waitForTimeout(5000);
} else {
  await p.locator('nav button').last().click(); await p.waitForTimeout(600); await p.getByRole('button', {name: /^Арена/}).first().click(); await p.waitForTimeout(1200);
  await p.getByRole('button', {name: /В бой/}).first().click().catch(e => console.log('arena go fail', e.message.split('\n')[0])); await p.waitForTimeout(2000);
}
await dismiss(); console.log('OVERLAY', (await p.locator('div.fixed.inset-0').first().innerText().catch(() => 'none')).slice(0, 300).replace(/\n/g, ' | '));
let result = '';
for (let i = 0; i < 70; i++) {
  const b = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim());
  const t = (await p.innerText('body')).replace(/\n+/g, ' | ');
  const m = t.match(/(ПОБЕДА[^|]*|Победа[^|]*|ПОРАЖЕНИЕ[^|]*|Поражение[^|]*)/); if (m && !/Возможн/.test(m[0])) { result = m[0]; break; }
  const atk = b.find(x => /^атака$/i.test(x)) || b.find(x => /^Сразиться|^В бой|Атаковать|Начать бой|НАЧАТЬ ОХОТУ|Начать охоту|Отправиться в путь/i.test(x));
  if (!atk) { if (i % 10 === 0) console.log('waiting; btns:', b.filter(x => x.length < 40).slice(0, 10).join(' / ')); await p.waitForTimeout(1000); continue; }
  if (!globalThis.__sk && await p.evaluate(() => !!window.__aethBridge.combat?.inCombat && window.__aethBridge.combat.phase === 'player')) { globalThis.__sk = 1;
    for (const sid of ['w_shield', 'w_strike']) { for (let w = 0; w < 30 && await p.evaluate(() => window.__aethBridge.combat?.phase !== 'player'); w++) await p.waitForTimeout(200); await p.getByRole('button', {name: /^Навыки/}).first().click().catch(() => {}); await p.waitForTimeout(400);
      if (sid === 'w_strike') console.log('READY TAGS', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-combat-skill]')].map(b => [b.dataset.combatSkill, b.classList.contains('is-combo'), (b.innerText || '').includes('🔗')]))));
      await p.locator(`[data-combat-skill="${sid}"]`).click({force: true}).catch(e => console.log('noskill', sid)); await p.waitForTimeout(2500); }
    await p.getByText('Летопись боя').first().click().catch(() => {}); await p.waitForTimeout(500); console.log('COMBO LOG:', (await p.locator('main').innerText()).split('\n').filter(l => /вязк/i.test(l)).join(' || ')); }
  if (!globalThis.__shot) { globalThis.__shot = 1; await geo('fight'); await p.mouse.move(180, 400); await p.mouse.wheel(0, 600); await p.waitForTimeout(800); console.log('SCROLL in fight:', await p.evaluate(() => scrollY)); await p.waitForTimeout(1500); console.log('SCROLL later:', await p.evaluate(() => scrollY)); await p.screenshot({path: `apkb-${style}-${process.argv[4] || 'tg'}.png`}); }
  await p.getByRole('button', {name: new RegExp('^\\s*' + atk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i')}).first().click().catch(()=>{}); await p.waitForTimeout(800);
}
await geo('end');
await p.waitForTimeout(1200);
console.log(style, what, 'result:', result || 'NONE', '| before', JSON.stringify(p0), '| after', JSON.stringify(await P()));
console.log('end btns:', (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ')).filter(x => x.length < 50).slice(0, 10).join(' / '));
await p.screenshot({path: `battle-${what}-${style}.png`});
console.log(s.log.filter(l => /pageerror|error/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).slice(0, 5).join('\n'));
await s.close();
