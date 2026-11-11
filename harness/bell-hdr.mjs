import {launch} from './browser.mjs'; import fs from 'node:fs';
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 44, gold: 89882, energy: 88, worldPlace: 'settlement', royalBriefingStep: 99, name: process.argv[3] || 'Sanvile'}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = 'fantasy'; ls['aeth_story_seen_v2_437290420'] = JSON.stringify(['reg_plains']); ls.aeth_ui_scale = process.argv[2] || 'x1';
const s = await launch({pageOptions: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}, localState: ls, setupWorld: (w) => { Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json')));
  const {pushEvent} = {pushEvent: (to, t) => (w.tables.ae_events ||= []).push({id: crypto.randomUUID(), to, icon: '💰', text: t, kind: 'market', at: new Date().toISOString(), acked: false})}; pushEvent('437290420', 'Тест'); }});
const p = s.page; await p.waitForTimeout(9000);
for (const t of ['Позже']) if (await p.getByRole('button', {name: t}).count()) await p.getByRole('button', {name: t}).first().click().catch(() => {});
await p.locator('.ae-x').first().click().catch(() => {}); await p.evaluate(() => document.querySelectorAll('.ae-pop').forEach(e => e.remove()));
const shot = async n => { await p.waitForTimeout(1200); console.log(n, 'compact:', await p.evaluate(() => !!document.querySelector('header.is-compact')), 'bell:', await p.evaluate(() => { const b = document.querySelector('[data-ae-bell]'); if (!b) return 'none'; const r = b.getBoundingClientRect(); const els = [...document.querySelectorAll('header *')].filter(e => e !== b && !b.contains(e) && !e.contains(b) && e.childElementCount === 0 && (e.textContent || '').trim()).filter(e => { const q = e.getBoundingClientRect(); return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); }).map(e => e.textContent.trim().slice(0, 12)); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} overlaps:[${els.join('|')}]`; }));
  await p.screenshot({path: `bellh-${n}.png`, clip: {x: 0, y: 0, width: 390, height: 170}}); };
await shot('settle');
for (const tab of ['Сумка', 'Мир', 'Арена']) { await p.evaluate(t => [...document.querySelectorAll('nav.game-nav button, nav.game-nav a')].find(n => n.textContent.includes(t))?.click(), tab); await shot(tab); }
await s.close();
