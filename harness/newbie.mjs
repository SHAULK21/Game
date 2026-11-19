import {launch} from './browser.mjs';
const style = process.argv[2] || 'modern';
const s = await launch({localState: {aethelgard_interface_style: style}});
const p = s.page; await p.setViewportSize({width: 390, height: 844}); p.on('dialog', d => d.accept());
const t0 = Date.now(); let n = 0;
const snap = async tag => { n++; const txt = (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').slice(0, 420);
  const btns = await p.evaluate(() => [...document.querySelectorAll('button, [role=button]')].filter(b => b.offsetParent && !b.disabled).map(b => b.innerText.trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean).slice(0, 14));
  console.log(`\n#${n} [${((Date.now() - t0) / 1000).toFixed(0)}s] ${tag}\nTXT: ${txt}\nBTN: ${btns.join(' / ')}`); await p.screenshot({path: `nb-${style}-${String(n).padStart(2, '0')}.png`}); };
const click = async re => { const ok = await p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button, [role=button], a')].find(x => x.offsetParent && !x.disabled && re.test(x.innerText.trim())); if (b) { b.click(); return b.innerText.trim().slice(0, 40); } return null; }, re.source); await p.waitForTimeout(1500); return ok; };
await p.waitForTimeout(6000); await snap('start');
const NEWBIE = !!process.env.FULL;
for (const step of (process.argv[3] || '').split(',').map(x => x).filter(Boolean)) {
  if (step.startsWith('FIGHT')) { let k = 0; for (; k < 40; k++) { const st = await p.evaluate(() => ({fight: document.documentElement.hasAttribute('data-in-combat'), hp: (document.body.innerText.match(/(\d+) \/ (\d+)\n/) || [])[0]})); if (!st.fight) break;
      await click(/^Позже$/); await click(/^(Атака)$/); } await snap('fight done after ' + k + ' attacks'); continue; }
  if (step === 'PLUS') { for (let k = 0; k < 6; k++) { await p.evaluate(() => { const b = [...document.querySelectorAll('main button')].find(x => /^\+$/.test(x.innerText.trim()) && !x.disabled); b?.scrollIntoView({block: 'center'}); b?.click(); }); await p.waitForTimeout(300); } await snap('plus'); continue; }
  if (step.startsWith('NAV:')) { await p.evaluate(t => [...document.querySelectorAll('nav button, nav a')].find(b => b.textContent.includes(t))?.click(), step.slice(4)); await p.waitForTimeout(1800); await snap('nav ' + step.slice(4)); continue; }
  if (step.startsWith('HUNT')) { const N = Number(step.slice(4)) || 5;
    for (let r = 0; r < N; r++) {
      const modal = await p.evaluate(() => [...document.querySelectorAll('[role=dialog], .ae-story, .ae-backdrop, .fixed.inset-0')].filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed').map(e => (e.innerText || '').replace(/\n+/g, ' / ').slice(0, 120)).filter(Boolean));
      if (modal.length) console.log('  MODAL before hunt', r, ':', modal.join(' ## '));
      for (const re of [/^Позже$/, /^Понятно$/, /^Далее$/, /^Продолжить$/, /^Закрыть$/]) await click(re);
      const go = (await click(/^Следующий противник$/)) || (await click(/^Забрать|^Получить награду|^Продолжить охоту/)) || (await click(/^Начать охоту/)); let k = 0;
      if (process.env.SHOTCOACH && r === 0) { await p.waitForTimeout(1500); console.log('COACH', await p.evaluate(() => document.querySelector('[data-ae-coach]')?.innerText || 'none')); await p.screenshot({path: 'nb-coach.png'}); }
      for (; k < 40; k++) { const f = await p.evaluate(() => document.documentElement.hasAttribute('data-in-combat')); if (!f) break;
        if (process.env.SKILLS) { const used = await click(/^Навыки$/); const sk = used && await click(/Касание смерти|Огненный шар|Ядовитые споры/); if (!sk) await click(/^Атака$/); } else await click(/^Атака$/); }
      const st = await p.evaluate(() => { const b = window.__aethBridge?.player; return b ? `lvl ${b.level} exp ${b.exp}/${b.nextExp} hp ${b.hp ?? ''} gold ${b.gold} energy ${b.energy} pts ${b.statPoints ?? b.attributePoints ?? ''}` : ''; });
      await p.waitForTimeout(900); const pos = await p.evaluate(() => { const b = [...document.querySelectorAll('main button')].find(x => x.offsetParent && /^(Следующий противник|Новая серия|В локацию)/.test(x.innerText.trim())); const nav = document.querySelector('nav'); return b ? Math.round(b.getBoundingClientRect().bottom) + '/' + Math.round(nav?.getBoundingClientRect().top || innerHeight) : 'none'; });
      const after = 'btn@' + pos + ' ' + (await p.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ').match(/(Победа[^|]*|Поражение[^|]*|Вы пали[^|]*|ПОБЕДА[^|]*)/)?.[0] || '';
      console.log(`  hunt ${r}: start=${go} attacks=${k} ${st} ${after}`);
    }
    console.log('BTNS AFTER', await p.evaluate(() => [...document.querySelectorAll('main button')].filter(b => b.offsetParent && !b.disabled).map(b => b.innerText.trim().replace(/\s+/g, ' ') + '@' + Math.round(b.getBoundingClientRect().top)).join(' / ')), 'innerH', await p.evaluate(() => innerHeight));
    await snap('after hunts'); continue; }
  if (step === 'WAIT') { await p.waitForTimeout(4000); await snap('wait'); continue; }
  if (step.startsWith('TYPE:')) { await p.fill('input', step.slice(5)); await snap('typed'); continue; } const r = await click(new RegExp(step)); await snap('click ' + step + ' → ' + r); }
await s.close(); process.exit(0);
