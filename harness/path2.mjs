import {launch} from './browser.mjs';
const s = await launch({localState: {aethelgard_interface_style: 'modern'}, setupWorld: w => {}}); const p = s.page; await p.setViewportSize({width: 390, height: 844});
p.on('dialog', d => d.accept());
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500); await p.fill('input', 'Тест'); await click(/Начать путешествие/); await p.waitForTimeout(5000);
for (let k = 0; k < 30 && await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')); k++) { await click(/^Позже$/); await click(/^Атака$/); await p.waitForTimeout(1200); }
for (const re of [/^Далее$/, /^Далее$/, /Открыть Кодекс/, /^Позже$/, /^Понятно$/, /^Закрыть$/]) { await click(re); await p.waitForTimeout(900); }
await p.waitForTimeout(6000);
console.log('pill:', await p.evaluate(() => { const e = document.querySelector('.ae-path-pill'); return e ? (e.hidden ? 'hidden ' : 'shown ') + e.textContent : 'none'; }), '| dialogs:', await p.evaluate(() => [...document.querySelectorAll('.ae-panel, .ae-story, [role=dialog]')].map(e => e.className.slice(0, 40)).join(',')));
await p.screenshot({path: 'path-main.png'});
await p.evaluate(() => window.__aethOpen.inbox()); await p.waitForTimeout(2500);
console.log('bot row:', await p.evaluate(() => document.querySelector('.ae-bot-toggle')?.innerText.replace(/\s+/g, ' ')));
await p.evaluate(() => document.querySelector('.ae-bot-toggle')?.scrollIntoView()); await p.screenshot({path: 'path-bell.png'});
await s.close(); process.exit(0);
