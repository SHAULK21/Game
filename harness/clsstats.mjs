import {launch} from './browser.mjs';
const out = [];
for (const cls of ['Воин', 'Маг', 'Некромант', 'Друид', 'Лучник', 'Паладин']) {
  const s = await launch({localState: {aethelgard_interface_style: 'modern'}}); const p = s.page; await p.waitForTimeout(5000);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Пропустить')?.click()); await p.waitForTimeout(800);
  await p.evaluate(c => [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(c))?.click(), cls); await p.waitForTimeout(400);
  await p.fill('input', 'Тест'); await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Начать путешествие/.test(b.textContent))?.click()); await p.waitForTimeout(2500);
  const st = await p.evaluate(() => { const s = window.__aethBridge?.stats || {}; return {hp: s.maxHp, atk: s.attack, matk: s.magicAttack, def: s.defense, crit: s.critChance, skills: (window.__aethBridge?.player?.skills || []).map(k => `${k.name}:${k.manaCost}mp×${k.damageMultiplier}`).join(',')}; });
  out.push(cls + ' ' + JSON.stringify(st)); await s.close();
}
console.log(out.join('\n')); process.exit(0);
