import {launch} from './browser.mjs';
for (const style of ['modern', 'fantasy']) {
  const s = await launch({localState: {aethelgard_interface_style: style}}); const p = s.page; await p.setViewportSize({width: 390, height: 844});
  await p.waitForTimeout(6000); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Пропустить$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(2000);
  console.log('==', style, await p.evaluate(() => { const r = document.querySelector('.registration-screen'); if (!r) return 'no .registration-screen: ' + document.body.innerText.slice(0, 200);
    const inner = r.firstElementChild; return r.className.slice(0, 120) + '\n inner: ' + inner.className + '\n' + [...inner.children].map((c, i) => `  ${i}: <${c.tagName.toLowerCase()} class="${String(c.className).slice(0, 90)}"> ${c.innerText.replace(/\s+/g, ' ').slice(0, 70)} [h=${Math.round(c.getBoundingClientRect().height)}]`).join('\n'); }));
  console.log(' class btn:', await p.evaluate(() => { const b = [...document.querySelectorAll('.registration-screen button')].find(x => /Некромант/.test(x.textContent)); return b ? b.innerHTML.slice(0, 400) : 'none'; }));
  await s.close(); }
process.exit(0);
