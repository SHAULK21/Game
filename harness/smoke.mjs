import {launch} from './browser.mjs';
const s = await launch();
await s.page.waitForTimeout(6000);
console.log(s.log.filter(l=>!/AudioContext/.test(l)).slice(0, 20).join('\n')); console.log(s.calls.map(c=>c.method+' '+c.path+' '+c.status+' '+c.body.slice(0,120)).join('\n'));
console.log((await s.page.innerText('body')).slice(0, 500));
await s.close();
