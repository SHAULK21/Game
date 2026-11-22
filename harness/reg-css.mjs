import {launch} from './browser.mjs';
for (const style of ['fantasy', 'modern']) {
  const s = await launch({localState: {aethelgard_interface_style: style}}); const p = s.page; await p.setViewportSize({width: 390, height: 844});
  await p.waitForTimeout(6000); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^Пропустить$/.test(b.textContent.trim()))?.click()); await p.waitForTimeout(2000);
  console.log('==', style, await p.evaluate(() => { const art = document.querySelector('.registration-hero-art'), img = art.querySelector('img'), cs = getComputedStyle(img), ca = getComputedStyle(art);
    const pick = (c, ks) => ks.map(k => k + ':' + c[k]).join('; ');
    const port = document.querySelector('.registration-class-portrait'), pc = port && getComputedStyle(port), pi = port && getComputedStyle(port.querySelector('img'));
    return `art: ${art.className}\n ${pick(ca, ['width', 'height', 'maxWidth', 'margin', 'background', 'borderRadius', 'aspectRatio'])}\nimg: ${img.className} src=${img.getAttribute('src')}\n ${pick(cs, ['width', 'height', 'objectFit', 'objectPosition', 'opacity', 'position'])}\nportrait: ${port ? pick(pc, ['width', 'height', 'borderRadius', 'border', 'overflow', 'display', 'marginBottom']) + ' | img ' + pick(pi, ['objectFit', 'objectPosition']) : 'none'}`; }));
  await s.close(); }
process.exit(0);
