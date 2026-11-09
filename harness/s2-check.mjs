import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2];
const ls = JSON.parse(fs.readFileSync('ls.json')); const key = 'aethelgard_save_v1_data_437290420';
const save = JSON.parse(ls[key]); Object.assign(save.player, {level: 25, miningLevel: 16, worldPlace: 'settlement', royalBriefingStep: 99}); delete save.player.firstJourney; delete save.player.firstJourneyDeparture;
ls[key] = JSON.stringify(save); ls.aethelgard_interface_style = style;
const s = await launch({localState: ls, setupWorld: w => Object.assign(w, JSON.parse(fs.readFileSync('world-after-reg.json'))), engine: '../tgcloud/lib/gameEngine.js'});
const p = s.page; p.setDefaultTimeout(4000); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4500);
for (let k = 0; k < 2; k++) if (await p.getByText('Позже').count()) { await p.getByText('Позже').click().catch(()=>{}); await p.waitForTimeout(300); }
const go = async label => { await p.locator('nav button').last().click().catch(()=>{}); await p.waitForTimeout(600); const b = p.getByRole('button', {name: label}).first(); await b.scrollIntoViewIfNeeded().catch(()=>{}); await b.click().catch(()=>{}); await p.waitForTimeout(1200); };
console.log(style, 'data-in-combat at settlement:', await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')));
if (style === 'fantasy') { await go('Герой'); const el = p.locator('.codex-stat-grid').first(); await el.scrollIntoViewIfNeeded().catch(()=>{}); await el.screenshot({path: 's2-hero-fantasy.png'}).catch(e=>console.log('no grid', e.message.slice(0,60))); }
await go('Спутники'); const t = await p.innerText('body'); console.log('pets reqs:', (t.match(/Требуется горное дело \d+ ур\./g) || []).join(', '));
if (style === 'modern') {
  await go('Чат'); await p.evaluate(() => window.scrollTo(0, 1e6)); await p.waitForTimeout(300);
  const inp = await p.locator('.chat-composer').boundingBox(); const nav = await p.locator('nav').last().boundingBox(); console.log('chat composer', JSON.stringify(inp), 'nav top', nav.y);
  await p.screenshot({path: 's2-chat.png'});
  await go('Настройки'); const txt = await p.innerText('body'); console.log('interface options:', ['Современный', 'Фэнтези — бета', 'Фэнтези'].map(x => x + ':' + txt.includes(x)).join(' '));
  await go('Premium'); await p.getByRole('button', {name: /Панель Администратора/}).click(); await p.waitForTimeout(2000);
  const sc = await p.evaluate(() => { const e = [...document.querySelectorAll('*')].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight && e.innerText.includes('Admin Console')).pop(); return e ? [e.scrollHeight, e.clientHeight] : null; });
  console.log('admin modal height', sc); await p.screenshot({path: 's2-admin.png'});
  console.log('admin/status calls', s.calls.filter(c => c.path === '/api/admin/status').length);
}
console.log(s.log.filter(l => /error/i.test(l) && !/AudioContext|ERR_FAILED/.test(l)).join('\n'));
await s.close();
