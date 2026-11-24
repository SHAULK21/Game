import {launch} from './browser.mjs';
const style = process.argv[2] || 'modern';
const s = await launch({localState: {aethelgard_interface_style: style}}); const p = s.page; await p.setViewportSize({width: 390, height: 844});
p.on('dialog', d => d.accept());
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500); await p.fill('input', 'Тест'); await click(/Начать путешествие/); await p.waitForTimeout(5000);
for (let i = 0; i < 6; i++) { await click(/^(Пропустить|Позже|Понятно|Далее|Закрыть)$/); await p.waitForTimeout(400); }
const gold = () => p.evaluate(() => window.__aethBridge?.player?.gold);
const g0 = await gold();
await p.evaluate(() => window.__aethOpen.daily()); await p.waitForTimeout(1500);
await p.screenshot({path: `daily-${style}-1.png`});
await click(/Забрать награду дня 1/); await p.waitForTimeout(2000);
console.log('day1: gold', g0, '→', await gold(), '| panel:', await p.evaluate(() => document.querySelector('.ae-daily-next')?.textContent));
await p.screenshot({path: `daily-${style}-2.png`});
const api = (path, method = 'GET', body) => p.evaluate(([a, b, c]) => window.__aethBridge.api(a, b === 'GET' ? {} : {method: b, body: JSON.stringify(c || {})}).then(r => r, e => ({error: String(e.message || e)})), [path, method, body]);
console.log('again today:', JSON.stringify(await api('/api/ae-daily/claim', 'POST', {operationId: crypto.randomUUID()})));
const rec = () => s.world.tables.ae_daily[0];
const back = days => { const r = rec(); r.day = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); };
for (let d = 2; d <= 7; d++) { back(1); const r = await api('/api/ae-daily/claim', 'POST', {operationId: crypto.randomUUID()}); console.log(`day ${d}:`, JSON.stringify(r.gifts), r.day); }
console.log('premium after day 7:', s.world.tables.players[0].premium_until);
back(1); console.log('after 7 → day', (await api('/api/ae-daily')).day);
back(2); console.log('missed a day → day', (await api('/api/ae-daily')).day, '| done', (await api('/api/ae-daily')).done);
console.log('errors:', s.log.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 3).join(' || ') || 'none');
await s.close(); process.exit(0);
