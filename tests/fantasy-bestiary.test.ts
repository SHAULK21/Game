import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

async function setup() {
  const bundle = await build({ stdin: { contents: `
    import React,{act} from 'react';
    import {createRoot} from 'react-dom/client';
    import {GameProvider} from './src/context/GameContext';
    import {BetaHuntDashboard as HuntDashboard} from './src/interfaces/fantasy/components/combat/BetaHuntDashboard';
    import {MONSTERS,REGIONS} from './src/data/gameData';
    import {setLanguage} from './src/i18n/locale';
    window.act=act;window.setLanguage=setLanguage;
    window.mount=()=>{
      window.root=createRoot(document.getElementById('root'));
      window.render=(energy,error=null)=>window.root.render(<GameProvider><HuntDashboard
        player={{level:10,energy,maxEnergy:60,silver:1000}}
        currentRegion={REGIONS[0]} regionMonsters={[MONSTERS.m_wolf]}
        selectedMonster={MONSTERS.m_wolf} activeMod={{}}
        selectedLock={null} progress={{kills:0,eliteWins:0,bossWins:0}}
        energyError={error} combatEnergyCost={2}
        autoBattle={{useSkills:true,healAtHpPercent:35}}
        isSettingsOpen={false} premiumActive={false} elixirPrice={10}
        getMonsterLock={()=>null} onSelectMonster={()=>{}}
        onStartHunt={()=>window.hunts++} onToggleSettings={()=>{}}
        onUpdateAutoBattle={()=>{}} onLeaveMine={()=>{}}
        onMeditate={()=>window.render(10)} onBuyElixir={()=>window.render(30)}
      /></GameProvider>);
      window.hunts=0;window.render(0);
    };`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""' },
    plugins: [{ name: 'art', setup(b) { b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' })); } }]
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  w.IS_REACT_ACT_ENVIRONMENT = true; w.Headers = Headers; w.AbortSignal = AbortSignal;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ resetVersion: 0, active: false, items: [], ok: true }) });
  w.eval(bundle.outputFiles[0].text);
  await w.act(async () => w.mount());
  await w.act(async () => w.document.querySelector('.bestiary-record').click());
  return { dom, w };
}

test('fantasy dossier explains insufficient energy, restores it in place, and retains failed-start feedback', async () => {
  const { dom, w } = await setup();
  const button = (text: string) => [...w.document.querySelectorAll('button')].find((el: any) => el.textContent.trim() === text) as any;
  const hunt = () => w.document.querySelector('.dossier-hunt-button');
  try {
    assert.equal(hunt().disabled, true);
    assert.match(w.document.querySelector('[role="status"]').textContent, /Недостаточно энергии/);
    await w.act(async () => hunt().click()); assert.equal(w.hunts, 0);
    await w.act(async () => button('Медитация +10').click());
    assert(w.document.querySelector('.bestiary-dossier-screen'), 'recovery keeps the dossier open');
    assert.equal(hunt().disabled, false);
    assert.equal(w.document.querySelector('.hunt-energy-notice'), null);
    await w.act(async () => hunt().click()); assert.equal(w.hunts, 1);
    await w.act(async () => w.render(0));
    await w.act(async () => button('Эликсир +30 · 10 серебра').click());
    assert.equal(hunt().disabled, false);
    await w.act(async () => w.render(10, 'Недостаточно энергии! Для боя нужно 2.'));
    assert.match(w.document.querySelector('.dossier-footer [role="status"]').textContent, /Для боя нужно 2/);
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});

test('fantasy bestiary and dossier switch their new labels between Russian and Ukrainian', async () => {
  const { dom, w } = await setup();
  try {
    const header = () => w.document.querySelector('.dossier-header');
    assert.match(header().textContent, /Досье охотника/);
    assert.match(w.document.querySelector('.dossier-damage-type').textContent, /Физический урон/);
    await w.act(async () => w.setLanguage('uk'));
    assert.match(header().textContent, /Досьє мисливця/);
    assert.match(w.document.querySelector('.dossier-damage-type').textContent, /Фізична шкода/);
    assert.match(w.document.querySelector('.dossier-footer').textContent, /Недостатньо енергії/);
    await w.act(async () => w.document.querySelector('.dossier-back').click());
    assert.match(w.document.querySelector('.bestiary-title-copy').textContent, /Бестіарій/);
    await w.act(async () => w.setLanguage('ru'));
    assert.match(w.document.querySelector('.bestiary-title-copy').textContent, /Бестиарий/);
    assert.doesNotMatch(w.document.querySelector('.hunt-book-content').textContent, /[іїєґІЇЄҐ]/);
  } finally { await w.act(async () => w.root.unmount()); dom.window.close(); }
});
