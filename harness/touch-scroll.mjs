import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy', apk = process.argv[3] === 'apk';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 30, energy: 40, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']); ls['aeth_barracks_story_437290420'] = '1';
const s = await launch({pageOptions: {viewport: {width: 360, height: 760}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}, localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); }});
const p = s.page;
if (apk) { await p.addInitScript(() => { const pref = {}; window.AethApk = {version: () => 6, versionName: () => '1.0.6', linked: () => true, saveLogin() {}, logout() {}, schedule() {}, cancel() {}, vibrate() {}, setPref: (k, v) => { pref[k] = v; }, getPref: (k, d) => k in pref ? pref[k] : d, keepAwake() {}, share() {}, copy() {}, paste: () => '', openExternal() {}, reload() {}}; }); await p.reload(); }
await p.waitForTimeout(9000);
for (let k = 0; k < 4; k++) { for (const t of ['Позже', 'В бой, герой!', 'Понятно']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {}); await p.locator('.ae-x').first().click({timeout: 500}).catch(() => {}); await p.waitForTimeout(300); }
const cdp = await p.context().newCDPSession(p);
const swipe0 = async (y0 = 600) => { await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 180, y: y0}]}); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 180, y: y0 - i * 30}]}); await new Promise(r => setTimeout(r, 16)); } await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); };
const where = () => p.evaluate(() => { const se = document.scrollingElement; const scrollers = [...document.querySelectorAll('*')].filter(e => e.scrollTop > 0).map(e => (e.tagName + '.' + (e.className || '').toString().slice(0, 40)) + ':' + e.scrollTop); return {winY: Math.round(scrollY), doc: se.scrollTop, docH: se.scrollHeight, inner: innerHeight, scrollers: scrollers.slice(0, 4), meta: document.querySelector('meta[name=viewport]')?.content, htmlOv: getComputedStyle(document.documentElement).overflowY, bodyOv: getComputedStyle(document.body).overflowY + '/' + getComputedStyle(document.body).overflowX, ta: getComputedStyle(document.body).touchAction}; });
await p.evaluate(() => { document.body.style.overflow = 'hidden'; }); await swipe0(); await p.waitForTimeout(300); console.log('LOCKED swipe', JSON.stringify(await where()).slice(0, 80)); await p.waitForTimeout(1500); console.log('DIAG', JSON.stringify(s.world.tables.ae_client_diag || []).slice(0, 700)); console.log('BEFORE', JSON.stringify(await where()));
const swipe = async (y0 = 600) => { await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 180, y: y0}]}); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 180, y: y0 - i * 30}]}); await new Promise(r => setTimeout(r, 16)); } await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); };
await swipe();
await p.waitForTimeout(800);
console.log('AFTER ', JSON.stringify(await where()));
const hit = await p.evaluate(() => { const e = document.elementFromPoint(180, 500); const chain = []; let a = e; for (let i = 0; a && i < 6; i++, a = a.parentElement) { const cs = getComputedStyle(a); chain.push(a.tagName + '.' + (a.className || '').toString().slice(0, 30) + '[ta=' + cs.touchAction + ',pe=' + cs.pointerEvents + ',pos=' + cs.position + ']'); } return chain.join(' < '); });
console.log('HIT', hit);
await s.close();
