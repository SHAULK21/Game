import {launch} from './browser.mjs';
const s = await launch({localState: {aethelgard_interface_style: 'modern'}}); const p = s.page;
p.on('dialog', d => d.accept());
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
const who = () => p.evaluate(() => { const b = window.__aethBridge?.player; return b ? `${b.userId} ${b.name} ур.${b.level} ${b.classId}` : 'нет героя'; });
async function register(cls, name) { await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500); await click(new RegExp('^' + cls)); await p.fill('input', name); await click(/Начать путешествие/); await p.waitForTimeout(5000); for (let i = 0; i < 6; i++) { await click(/^(Пропустить|Позже|Понятно|Далее|Закрыть)$/); await p.waitForTimeout(400); } }
const chars = async () => { await p.evaluate(() => window.__aethOpen.chars()); await p.waitForTimeout(1500); return p.evaluate(() => [...document.querySelectorAll('.ae-char')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')); };
const ALT = '8000001749161681';
await register('Воин', 'Главный');
await chars(); await p.evaluate(() => document.querySelector('.ae-char.is-empty button')?.click()); await p.waitForTimeout(6000);
await register('Некромант', 'Второй'); console.log('alt:', await who());
// give the alt add-on data that must go away
s.world.tables.ae_companions = [...(s.world.tables.ae_companions || []), {id: 'c1', u: ALT, name: 'Тест'}]; s.world.tables.ae_events = [...(s.world.tables.ae_events || []), {id: 'e1', to: ALT, text: 'x'}];
(s.world.tables.ae_profiles ||= []).push({u: ALT, apkAt: '2026-11-22T00:00:00Z', avatar: 'hero_mage'});
console.log('playing alt, delete button on current?', await chars(), '| del buttons:', await p.evaluate(() => document.querySelectorAll('.ae-char-del').length));
await p.evaluate(() => [...document.querySelectorAll('.ae-char')].find(e => /Главный/.test(e.innerText))?.querySelector('.ae-btn.ae-primary')?.click()); await p.waitForTimeout(7000);
for (let i = 0; i < 4; i++) { await click(/^(Пропустить|Позже|Понятно|Далее|Закрыть)$/); await p.waitForTimeout(400); }
console.log('back to main:', await who());
console.log('chars:', await chars());
await p.screenshot({path: 'chars-del-1.png'});
await p.evaluate(() => document.querySelector('.ae-char-del')?.click()); await p.waitForTimeout(2500);
console.log('after delete:', await chars());
const t = s.world.tables; const pl = t.players.find(x => String(x.telegram_id) === ALT);
console.log('world: alt row name', pl?.character_name ?? null, 'lvl', pl?.level, 'reset', pl?.reset_version, '| comps', (t.ae_companions || []).filter(x => x.u === ALT).length, 'events', (t.ae_events || []).filter(x => x.to === ALT).length, 'profile', JSON.stringify((t.ae_profiles || []).find(x => x.u === ALT)));
await p.evaluate(() => document.querySelector('.ae-char.is-empty button')?.click()); await p.waitForTimeout(6000);
await register('Маг', 'Третий'); console.log('new hero in the slot:', await who());
console.log('errors:', s.log.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 4).join(' || ') || 'none');
console.log('calls:', s.calls.filter(c => /ae-chars\/delete/.test(c.path)).map(c => c.status + ' ' + c.body).join(' || '));
await s.close(); process.exit(0);
