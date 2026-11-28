// Preview of the battle animation: fast screenshots of the scene (the browser's video recorder drops frames).
import {launch} from './browser.mjs'; import fs from 'node:fs';
const style = process.argv[2] || 'fantasy', DIR = 'video/anim-' + style; fs.rmSync(DIR, {recursive: true, force: true}); fs.mkdirSync(DIR, {recursive: true});
const s = await launch({localState: {aethelgard_interface_style: style}, pageOptions: {viewport: {width: 390, height: 844}, deviceScaleFactor: 2}}); const p = s.page;
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500); await p.fill('input', 'Арина'); await click(/^Некромант|^Воин/); await click(/^Воин/); await click(/Начать путешествие/); await p.waitForTimeout(6000);
const box = await p.evaluate(() => { const r = document.querySelector('[data-ae-scene]').getBoundingClientRect(); return {x: 0, y: Math.max(0, r.top), width: 390, height: Math.round(r.height)}; });
const frames = []; let shooting = true;
const shoot = (async () => { const t0 = Date.now(); while (shooting) { const f = `${DIR}/f${String(frames.length).padStart(4, '0')}.jpg`; await p.screenshot({path: f, clip: box, type: 'jpeg', quality: 82}); frames.push([f, Date.now() - t0]); } })();
const act = async (re, ms) => { await click(re); await p.waitForTimeout(ms); };
await p.waitForTimeout(400); await act(/^Атака$/, 2600); await act(/^Защита/, 2600); await act(/^Атака$/, 2600);
shooting = false; await shoot;
let list = ''; for (let i = 0; i < frames.length; i++) { const d = ((frames[i + 1]?.[1] ?? frames[i][1] + 80) - frames[i][1]) / 1000; list += `file '${frames[i][0].split('/').pop()}'\nduration ${d.toFixed(3)}\n`; }
fs.writeFileSync(`${DIR}/list.txt`, list + `file '${frames.at(-1)[0].split('/').pop()}'\n`);
console.log('frames', frames.length, 'in', (frames.at(-1)[1] / 1000).toFixed(1), 's →', (frames.length / (frames.at(-1)[1] / 1000)).toFixed(1), 'fps');
await s.close(); process.exit(0);
