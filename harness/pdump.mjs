import {launch} from './browser.mjs';
const s = await launch({localState: {aethelgard_interface_style: 'modern'}}); const p = s.page; await p.setViewportSize({width: 390, height: 844});
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500); await p.fill('input', 'Тест'); await click(/Начать путешествие/); await p.waitForTimeout(5000);
const dump = () => p.evaluate(() => { const b = window.__aethBridge, pl = b?.player; const o = {}; for (const [k, v] of Object.entries(pl || {})) o[k] = Array.isArray(v) ? `[${v.length}]` : v && typeof v === 'object' ? '{' + Object.keys(v).slice(0, 12).join(',') + '}' : v; return {bridge: Object.keys(b || {}), player: o}; });
console.log(JSON.stringify(await dump()).slice(0, 3500));
console.log('equipment:', JSON.stringify(await p.evaluate(() => window.__aethBridge.player.equipment)).slice(0, 600));
console.log('stats/attr:', JSON.stringify(await p.evaluate(() => ({a: window.__aethBridge.player.attributes, sp: window.__aethBridge.player.statPoints ?? window.__aethBridge.player.freeStatPoints}))));
await s.close(); process.exit(0);
