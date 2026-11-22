import {launch} from './browser.mjs';
import pw from '/opt/node-tools/node_modules/playwright/index.js';
const style = process.argv[2] || 'modern', slot = process.argv[3] || '';
const dev = pw.devices['Pixel 7'];
const s = await launch({localState: {aethelgard_interface_style: style, ...(slot ? {aeth_char_slot_437290420: slot} : {})}, pageOptions: {...dev}}); const p = s.page;
await p.waitForTimeout(6000);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Пропустить$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(2000);
await p.evaluate(() => { const i = document.querySelector('input'); window.__inp = i; window.__ev = []; for (const t of ['focus', 'blur']) i.addEventListener(t, () => window.__ev.push(t + '@' + Math.round(performance.now()))); });
const box = await p.locator('input').first().boundingBox();
await p.touchscreen.tap(box.x + 20, box.y + box.height / 2); await p.waitForTimeout(400);
const vs = p.viewportSize(); await p.setViewportSize({width: vs.width, height: Math.round(vs.height * 0.55)});   // keyboard opens
await p.waitForTimeout(2500);
const st = await p.evaluate(() => ({same: document.querySelector('input') === window.__inp, focused: document.activeElement === document.querySelector('input'), ev: window.__ev, scrollY, top: Math.round(document.querySelector('input').getBoundingClientRect().top), h: innerHeight}));
console.log('after keyboard:', JSON.stringify(st));
await p.keyboard.type('Герой', {delay: 100}); await p.waitForTimeout(800);
console.log('value:', await p.evaluate(() => document.querySelector('input').value), '| ev:', await p.evaluate(() => window.__ev.join(',')));
await p.screenshot({path: `namem-${style}${slot}.png`});
await s.close(); process.exit(0);
