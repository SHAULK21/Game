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
const P = () => p.evaluate(k => JSON.parse(localStorage.getItem(k)).player, key);
await p.waitForTimeout(4000);
console.log('GIFT dialog:', (await p.locator('.ae-story').innerText().catch(() => 'NONE')).replace(/\n+/g, ' | ').slice(0, 300));
const g0 = (await P()).gold;
if (apk) { await p.locator('.ae-story button', {hasText: 'Забрать'}).click().catch(e => console.log('no claim')); await p.waitForTimeout(2500);
  const me = s.world.tables.players.find(x => String(x.telegram_id) === '437290420'); console.log('premium_until', me.premium_until, '| gold +', (await P()).gold - g0, '| apkAt', JSON.stringify(s.world.tables.ae_profiles?.find(x => x.u === '437290420')?.apkAt)); }
await p.locator('.ae-story button').first().click({timeout: 3000}).catch(() => {}); await p.waitForTimeout(500); await p.evaluate(() => window.__aethOpen.profile()); await p.waitForTimeout(1500);
console.log('AT', await p.evaluate(() => { const b = [...document.querySelectorAll('.ae-pill-btn')].find(x => /Баннер/.test(x.textContent)); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [Math.round(r.top), e?.className?.toString().slice(0, 80), e?.closest('[class]')?.parentElement?.className?.toString().slice(0, 80), (e?.textContent || '').slice(0, 60)].join(' | '); })); await p.locator('.ae-pill-btn', {hasText: 'Баннер'}).click({timeout: 4000}).catch(e => console.log('no tab', (e.message.match(/<[^>]+> intercepts[^\n]*/) || [''])[0].slice(0, 200))); await p.waitForTimeout(800);
console.log('BANNERS:', (await p.locator('.ae-panel').innerText()).replace(/\n+/g, ' | ').split('Сбросить')[1]?.slice(0, 400));
await p.locator('.ae-banner-pick', {hasText: 'Гиблые болота'}).click().catch(() => {}); await p.waitForTimeout(1200);
console.log('APP ICON in profile:', await p.locator('.ae-prof-head .ae-app-ico').count(), '| apkSeen', JSON.stringify(s.world.tables.ae_profiles?.find(x => x.u === '437290420')?.apkSeen)); console.log('banner set:', JSON.stringify(s.world.tables.ae_profiles?.find(x => x.u === '437290420')?.banner));
await p.screenshot({path: `banner-${apk ? 'apk' : 'tg'}.png`});
await s.close(); process.exit(0);
