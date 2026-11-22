import {launch} from './browser.mjs';
const style = process.argv[2] || 'modern';
const s = await launch({localState: {aethelgard_interface_style: style}}); const p = s.page;
p.on('dialog', d => d.accept());
const click = async re => p.evaluate(src => { const re = new RegExp(src, 'i'); const b = [...document.querySelectorAll('button, [role=button]')].find(x => x.offsetParent && re.test((x.textContent || '').trim())); if (b) { b.click(); return true; } return false; }, re.source);
const who = () => p.evaluate(() => { const b = window.__aethBridge?.player; return b ? `${b.userId} ${b.name} ур.${b.level} ${b.classId}` : 'нет героя'; });
async function register(cls, name) {
  await p.waitForTimeout(5000); await click(/^Пропустить$/); await p.waitForTimeout(1500);
  await click(new RegExp('^' + cls)); await p.waitForTimeout(500); await p.fill('input', name); await click(/Начать путешествие/); await p.waitForTimeout(5000);
  for (let i = 0; i < 6; i++) { await click(/^(Пропустить|Позже|Понятно|Далее|Закрыть)$/); await p.waitForTimeout(400); }
}
const charsText = async () => { await p.evaluate(() => window.__aethOpen.chars()); await p.waitForTimeout(1500); return p.evaluate(() => [...document.querySelectorAll('.ae-char')].map(e => e.innerText.replace(/\s+/g, ' ')).join(' | ')); };
await register('Воин', 'Главный'); console.log('1) main:', await who());
console.log('   chars:', await charsText()); await p.screenshot({path: `chars-${style}-1.png`});
await p.evaluate(() => [...document.querySelectorAll('.ae-char.is-empty button')][0]?.click()); await p.waitForTimeout(6000);
await click(/^Пропустить$/); await p.waitForTimeout(2000);
console.log('2) new hero screen: back button', await p.evaluate(() => !!document.querySelector('[data-ae-char-back]')), '| hero:', await who());
await p.evaluate(() => document.querySelector('[data-ae-char-back]')?.scrollIntoView({block: 'center'})); await p.screenshot({path: `chars-${style}-2.png`});
await register('Некромант', 'Второй'); console.log('3) alt:', await who());
console.log('   chars:', await charsText()); await p.screenshot({path: `chars-${style}-3.png`});
const players = () => (s.world.tables.players || []).map(x => `${x.telegram_id}:${x.character_name}:${x.premium_until || '-'}`).join(' ; ');
console.log('   world players:', players());
// Premium on the main hero unlocks the third slot and is shared
s.world.tables.players.find(x => String(x.telegram_id) === '437290420').premium_until = new Date(Date.now() + 5 * 864e5).toISOString();
await p.evaluate(() => document.querySelector('.ae-x')?.click());
console.log('4) with premium chars:', await charsText());
console.log('   world players:', players());
await p.evaluate(() => [...document.querySelectorAll('.ae-char')].find(e => /Главный/.test(e.innerText))?.querySelector('button')?.click()); await p.waitForTimeout(7000);
for (let i = 0; i < 4; i++) { await click(/^(Пропустить|Позже|Понятно|Далее|Закрыть)$/); await p.waitForTimeout(400); }
console.log('5) back to main:', await who());
console.log('errors:', s.log.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 5).join(' || ') || 'none');
await s.close(); process.exit(0);
