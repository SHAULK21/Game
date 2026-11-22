import {launch} from './browser.mjs';
import pw from '/opt/node-tools/node_modules/playwright/index.js';
for (const [style, lang] of [['modern', 'ru'], ['fantasy', 'ru'], ['modern', 'uk']]) {
  const s = await launch({localState: {aethelgard_interface_style: style, aethelgard_language: lang}, pageOptions: {...pw.devices['Pixel 7']}}); const p = s.page;
  await p.waitForTimeout(6000); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Пропустить|Пропустити)$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(2000);
  await p.evaluate(() => [...document.querySelectorAll('.registration-screen button')].find(x => /Некромант/.test(x.textContent))?.click()); await p.waitForTimeout(300);
  console.log(style, lang, JSON.stringify(await p.evaluate(() => { const a = document.querySelector('.registration-hero-art'); return {art: a.querySelector('.ae-reg-art')?.getAttribute('src'), has: a.classList.contains('ae-has-art'), h: Math.round(a.getBoundingClientRect().height), w: Math.round(a.getBoundingClientRect().width), portraits: document.querySelectorAll('.ae-reg-portrait, .registration-class-portrait').length}; })));
  await p.screenshot({path: `same-${style}-${lang}.png`});
  console.log('  errors:', s.log.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 3).join(' || ') || 'none');
  await s.close(); }
process.exit(0);
