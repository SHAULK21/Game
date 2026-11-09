import {launch} from './browser.mjs';
const s = await launch();
const p = s.page;
await p.getByText('Пропустить').click(); await p.waitForTimeout(800);
console.log((await p.innerText('body')).slice(0, 1200));
await p.screenshot({path: 'shot-reg.png'});
await s.close();
