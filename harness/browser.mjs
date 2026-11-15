import pw from '/opt/node-tools/node_modules/playwright/index.js'; const {chromium} = pw;
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
export async function launch({engine = './engine-patched.js', userId = 437290420, setupWorld, localState, pageOptions} = {}) {
  const E = await import(engine);
  const {handleSocialRequest} = await import('../tgcloud/lib/social.js');
  const world = {tables: {}};
  if (setupWorld) await setupWorld(world, E);
  const root = path.resolve(process.env.DIST || '../dist');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    let f = path.join(root, p); if (!fs.existsSync(f)) f = path.join(root, 'index.html');
    const type = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    res.writeHead(200, {'content-type': type}); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage(pageOptions || {viewport: {width: 420, height: 860}});
  const log = [];
  page.on('console', m => log.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
  const calls = [];
  await page.exposeFunction('__serverless', async (name, input) => {
    const lat = Number(process.env.AE_LATENCY || 0); if (lat && input.path !== '/api/items/owned') await new Promise(r => setTimeout(r, lat));
    const snapshotFirst = input.path === '/api/items/owned' && lat;
    const user = {id: userId, displayName: 'Admin', username: 'admin'};
    const nowT = Number(process.env.AE_NOW) || Date.now(); const native = sub => E.handleProgressRequest(world, sub, user, {now: () => nowT, isAdmin: id => id === E.ADMIN_TELEGRAM_ID});
    if (String(input.path || '').startsWith('/api/ae-save')) {  // in-memory stand-in for the cloud_saves table (same rules as tgcloud/lib/cloudSave.js)
      const cs = (world.__cloud ||= {}), row = cs[String(userId)], meta = r => r ? {rev: r.rev, savedAt: r.savedAt, device: r.device, level: r.level, heroName: r.heroName} : {rev: 0};
      let res;
      const bak = cs[String(userId) + '#bak'];
      if ((input.method || 'GET') === 'GET' && /bak=1/.test(input.path)) res = bak ? {status: 200, body: {...meta(bak), data: bak.data}} : {status: 404, body: {error: 'нет'}};
      else if ((input.method || 'GET') === 'GET') res = {status: 200, body: {...meta(row), ...(bak ? {backup: meta(bak)} : {}), ...(row && /full=1/.test(input.path) ? {data: row.data} : {})}};
      else { const b = input.body || {}, sv = JSON.parse(b.data || 'null'), cur = row?.rev || 0;
        if (!sv?.player || String(sv.player.userId) !== String(userId)) res = {status: 403, body: {error: 'чужое'}};
        else if (row && !b.force && sv.player.level < row.level) res = {status: 409, body: {conflict: true, lower: true, ...meta(row)}};
        else if (row && !b.force && Number(b.baseRev) !== cur && row.device !== b.device) res = {status: 409, body: {conflict: true, ...meta(row)}};
        else { if (row && (sv.player.level < row.level || row.device !== b.device || b.force)) cs[String(userId) + '#bak'] = {...row};
          cs[String(userId)] = {rev: cur + 1, savedAt: new Date().toISOString(), device: b.device, level: sv.player.level, heroName: sv.player.name, data: b.data}; res = {status: 200, body: {rev: cur + 1}}; } }
      calls.push({path: input.path, method: input.method, status: res.status, body: JSON.stringify(res.body).slice(0, 200)}); return res;
    }
    const res = (await handleSocialRequest(world, input, {...user, isAdmin: user.id === E.ADMIN_TELEGRAM_ID}, nowT, native)) || await E.handleProgressRequest(world, input, user, {now: () => Date.now(), isAdmin: id => id === E.ADMIN_TELEGRAM_ID});
    E.validateNativeWorld(world);
    calls.push({path: input.path, method: input.method, status: res.status, body: JSON.stringify(res.body).slice(0, 300)});
    if (snapshotFirst) await new Promise(r => setTimeout(r, Number(process.env.AE_LATENCY) * 4));
    return res;
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*/, route => route.abort());
  await page.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({contentType: 'text/javascript', body: `
    window.Telegram = {WebApp: {initData: 'query_id=x&user=%7B%22id%22%3A${userId}%7D&hash=x', initDataUnsafe: {user: {id: ${userId}, first_name: 'Admin', username: 'admin'}},
      version: '9.0', platform: 'android', colorScheme: 'dark', themeParams: {}, isExpanded: true, viewportHeight: 860, viewportStableHeight: 860,
      ready(){}, expand(){}, close(){}, onEvent(){}, offEvent(){}, setHeaderColor(){}, setBackgroundColor(){}, setBottomBarColor(){}, enableClosingConfirmation(){}, disableClosingConfirmation(){}, disableVerticalSwipes(){}, requestFullscreen(){}, lockOrientation(){},
      HapticFeedback: {impactOccurred(){}, notificationOccurred(){}, selectionChanged(){}},
      BackButton: {show(){}, hide(){}, onClick(){}, offClick(){}, isVisible: false}, MainButton: {show(){}, hide(){}, setText(){}, onClick(){}, offClick(){}, setParams(){}},
      SettingsButton: {show(){}, hide(){}, onClick(){}, offClick(){}}, CloudStorage: {getItem(k,cb){cb(null,'')}, setItem(k,v,cb){cb&&cb(null,true)}, getKeys(cb){cb(null,[])}, removeItem(k,cb){cb&&cb(null,true)}},
      openTelegramLink(){}, openLink(){}, openInvoice(u,cb){cb&&cb('cancelled')}, showAlert(m,cb){cb&&cb()}, showConfirm(m,cb){cb&&cb(true)}, showPopup(p,cb){cb&&cb('ok')},
      Serverless: {call(name, input, cb){ if (typeof input === 'function') { cb = input; input = {}; } window.__serverless(name, input).then(r => cb(null, r), e => cb({type:'INTERNAL', message: String(e)})); }}
    }};`}));
  const url = `http://127.0.0.1:${server.address().port}/`;
  if (localState) await page.addInitScript(s => { if (!sessionStorage.__init) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.__init = 1; } }, localState);
  await page.goto(url);
  return {page, browser, server, world, E, log, calls, url, async close() { await browser.close(); server.close(); }};
}
