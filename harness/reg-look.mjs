import {launch} from './browser.mjs';
import pw from '/opt/node-tools/node_modules/playwright/index.js';
const dev = pw.devices['Pixel 7'];
for (const style of ['modern', 'fantasy']) {
  const s = await launch({localState: {aethelgard_interface_style: style}, pageOptions: {...dev}}); const p = s.page;
  await p.waitForTimeout(6000); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Пропустить$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(2500);
  await p.screenshot({path: `reg-${style}-1.png`});
  const box = await p.locator('input').first().boundingBox();
  await p.touchscreen.tap(box.x + 30, box.y + box.height / 2); await p.waitForTimeout(400);
  const vs = p.viewportSize(); await p.setViewportSize({width: vs.width, height: Math.round(vs.height * 0.55)}); await p.waitForTimeout(1500);
  await p.keyboard.type('Вейн', {delay: 80}); await p.waitForTimeout(1200);
  const st = await p.evaluate(() => { const i = document.querySelector('input'), r = i.getBoundingClientRect(); return {value: i.value, inputTop: Math.round(r.top), inputBottom: Math.round(r.bottom), vh: innerHeight, banner: document.querySelector('.ae-reg-name')?.textContent, start: (() => { const b = [...document.querySelectorAll('.registration-screen button')].find(x => /Начать путешествие/.test(x.textContent)); const r = b.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })()}; });
  console.log(style, JSON.stringify(st));
  await p.screenshot({path: `reg-${style}-2.png`});
  await p.setViewportSize(vs); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('.registration-screen').scrollTo(0, 1e5)); await p.waitForTimeout(600); await p.screenshot({path: `reg-${style}-3.png`});
  // create the hero with the typed name
  await p.evaluate(() => [...document.querySelectorAll('.registration-screen button')].find(x => /Некромант/.test(x.textContent))?.click()); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('.registration-screen button')].find(x => /Начать путешествие/.test(x.textContent))?.click()); await p.waitForTimeout(4000);
  console.log('  created:', await p.evaluate(() => { const b = window.__aethBridge?.player; return b ? `${b.name} ${b.classId}` : 'нет'; }), '| errors:', s.log.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 3).join(' || ') || 'none');
  await s.close(); }
process.exit(0);
