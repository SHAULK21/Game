import {launch} from './browser.mjs';
const style = process.argv[2] || 'modern';
const s = await launch({localState: {aethelgard_interface_style: style}}); const p = s.page; await p.setViewportSize({width: 390, height: 844});
p.on('dialog', d => d.accept());
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
const steps = () => p.evaluate(() => window.__aePathDbg?.());
await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500); await p.fill('input', 'Тест'); await click(/Начать путешествие/); await p.waitForTimeout(5000);
// first fight: one skill, then attacks
await click(/^Навыки$/); await p.waitForTimeout(600); await click(/Мощный удар/); await p.waitForTimeout(1500);
for (let k = 0; k < 30 && await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')); k++) { await click(/^Позже$/); await click(/^Атака$/); await p.waitForTimeout(1200); }
for (let i = 0; i < 6; i++) { await click(/^(Пропустить|Позже|Понятно|Далее|Закрыть)$/); await p.waitForTimeout(400); }
await p.waitForTimeout(12000);
const state = () => p.evaluate(() => window.__aethBridge.api('/api/ae-path', {}).then(r => r.steps.map(x => x.id + (x.claimed ? '✅' : x.done ? '🎁' : '·')).join(' ')));
console.log('after fight:', await state(), '| pill:', await p.evaluate(() => { const e = document.querySelector('.ae-path-pill'); return e ? (e.hidden ? 'hidden ' : '') + e.textContent : 'none'; }));
// settlement
await p.evaluate(() => [...document.querySelectorAll('nav button, nav a')].find(b => /Поселение|Мир/.test(b.textContent))?.click()); await p.waitForTimeout(1500);
console.log('worldPlace:', await p.evaluate(() => window.__aethBridge.player.worldPlace));
await p.screenshot({path: `path-${style}-0.png`});
// daily reward
await p.evaluate(() => window.__aethOpen.daily()); await p.waitForTimeout(1200); await click(/Забрать награду дня/); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('.ae-x')?.click());
await p.waitForTimeout(4000);
console.log('after town+daily:', await state());
await p.evaluate(() => window.__aethOpen.path()); await p.waitForTimeout(1500); await p.screenshot({path: `path-${style}-1.png`});
const g0 = await p.evaluate(() => window.__aethBridge.player.gold);
for (let i = 0; i < 4; i++) { const ok = await p.evaluate(() => { const b = document.querySelector('.ae-path-step.is-ready button'); if (b) { b.click(); return true; } return false; }); if (!ok) break; await p.waitForTimeout(1500); }
console.log('claimed:', await state(), '| gold', g0, '→', await p.evaluate(() => window.__aethBridge.player.gold));
await p.screenshot({path: `path-${style}-2.png`});
console.log('errors:', s.log.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 4).join(' || ') || 'none');
await s.close(); process.exit(0);
