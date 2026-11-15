import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'modern', what = process.argv[3] || 'hunt';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 12, energy: 60, arenaTickets: 5, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; const P_=(id,name,stats,icon)=>({id,templateId:id,name,type:'potion',rarity:'uncommon',level:1,upgradeLevel:0,icon,stats,sellPrice:10,disassembleYield:{},stackCount:3}); save.player.inventory.push(P_('alc_hp_small','Малое зелье исцеления',{heal:120},'🧪'),P_('alc_mp_small','Малое зелье маны',{manaRestore:80},'💧'),P_('alc_throw_venom','Ядовитая склянка',{poisonDamage:220},'☠️'),P_('alc_fish_hunter','Масло хищника',{attackPercent:15,critChance:5,buffDuration:3},'🔥')); delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style; ls['aeth_story_seen_437290420'] = '["reg_plains"]';
const s = await launch({pageOptions: {viewport: {width: 360, height: 760}, deviceScaleFactor: 1, isMobile: true, hasTouch: true}, localState: ls, setupWorld: w => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))); (w.tables.ae_companions ||= []).push({id: 'c1', u: '437290420', name: 'Лиара', role: process.env.ROLE || 'dps', lvl: Number(process.env.CL || 33), xp: 0, gear: {}, at: new Date().toISOString()}); }, engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000);
if (process.argv[4] === 'apk') { await p.addInitScript(() => { const pref = {}; window.AethApk = {version: () => 3, versionName: () => '1.0.5', linked: () => true, saveLogin() {}, logout() {}, schedule() {}, cancel() {}, vibrate() {}, setPref: (k, v) => { pref[k] = v; }, getPref: (k, d) => k in pref ? pref[k] : d, keepAwake() {}, share() {}, copy() {}, paste: () => '', openExternal() {}, reload() {}}; }); await p.reload(); }
await p.waitForTimeout(5000);
const geo = async tag => console.log('GEO', tag, JSON.stringify(await p.evaluate(() => { const hd = document.querySelector('header'); const r = hd?.getBoundingClientRect(); return {scrollY: scrollY, docScroll: document.scrollingElement.scrollTop, inner: innerHeight, clientW: document.documentElement.clientWidth, zoom: document.documentElement.style.zoom, meta: document.querySelector('meta[name=viewport]')?.content, hdTop: r && Math.round(r.top), hdH: r && Math.round(r.height), vv: visualViewport && [Math.round(visualViewport.offsetTop), Math.round(visualViewport.height), visualViewport.scale]}; })));
await geo('start');
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
for (let i = 0; i < 30; i++) { const b = (await p.getByRole('button').allInnerTexts()).map(x => x.replace(/\n/g, ' ').trim()); if (b.some(x => /^атака$/i.test(x))) break; const go = b.find(x => /^Отправиться ·|^Сразиться|^В бой|Атаковать|Начать бой|Начать охоту/i.test(x)); if (go) await p.getByRole('button', {name: go}).first().click().catch(() => {}); await p.waitForTimeout(1200); }
const C = () => p.evaluate(() => { const c = window.__aethBridge?.combat; return {turn: c?.turn, phase: c?.phase, hp: c?.hp, mp: c?.mp, mon: c?.monster?.hp, eff: (c?.effects || []).map(e => e.type)}; });
await p.waitForTimeout(800);
await p.waitForTimeout(800);
console.log('BTN', await p.evaluate(() => { const b = document.querySelector('.ae-ai-attack'); return b ? b.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 500) : 'none'; }));
console.log('MOD', await p.evaluate(() => { let e = document.querySelector('main [data-battle-scene]'); const chain = []; while (e && e.tagName !== 'MAIN') { chain.push(e.tagName + '.' + String(e.className).slice(0, 50) + ' vs=' + /VS/.test(e.textContent) + ' h=' + Math.round(e.getBoundingClientRect().height)); e = e.parentElement; } return chain.join(' <- '); }));
console.log('SERIES0', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main span, main div')].filter(e => !e.childElementCount && /Боевая серия/.test(e.textContent)).map(e => (e.offsetParent ? 'VISIBLE' : 'hidden') + ' hidden-anc=' + !!e.closest('.ae-nat-hide'))))); console.log('SCENE', await p.locator('[data-ae-scene]').count(), (await p.locator('[data-ae-scene]').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
await p.evaluate(() => document.querySelector('[data-ae-scene]')?.scrollIntoView({block: 'start'})); await p.waitForTimeout(300); await p.screenshot({path: `scene-${style}.png`});
await p.getByRole('button', {name: /^атака$/i}).first().click().catch(() => {}); await p.waitForTimeout(300); await p.screenshot({path: `scene2-${style}.png`}); await p.waitForTimeout(2500);
console.log('SCENE2', (await p.locator('[data-ae-scene]').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
await p.screenshot({path: `scene3-${style}.png`});
console.log('SERIES', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main span, main div')].filter(e => !e.childElementCount && /Боевая серия/.test(e.textContent)).map(e => (e.offsetParent ? 'VISIBLE' : 'hidden') + ' hidden-anc=' + !!e.closest('.ae-nat-hide') + ' len=' + (e.closest('.ae-nat-hide')?.textContent.length || 0)))));
console.log('INTENTCHK', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main span, main b, main summary, .ae-bv span, .ae-bv b, .ae-bv summary')].filter(e => /^(Возможный приём|Следом бегут|Тень соперника)/.test(e.textContent.trim())).map(e => e.textContent.trim().slice(0, 30) + (e.offsetParent ? ' VISIBLE' : ' hidden')))));
await s.close();
