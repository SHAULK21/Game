import pw from '/opt/node-tools/node_modules/playwright/index.js'; const {chromium} = pw;
const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 360, height: 760}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}); const p = await ctx.newPage();
await p.setContent('<meta name=viewport content="width=device-width"><div style="height:3000px;background:linear-gradient(red,blue)">x</div>');
const cdp = await ctx.newCDPSession(p);
const swipe = async () => { await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 180, y: 600}]}); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 180, y: 600 - i * 30}]}); await new Promise(r => setTimeout(r, 16)); } await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await p.waitForTimeout(600); };
await swipe();
console.log('plain scrollY', await p.evaluate(() => scrollY));
await b.close();
