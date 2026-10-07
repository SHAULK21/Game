import {localProgressPlugin} from './helpers/localProgressPlugin';
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

test('Premium bag expansion shows its price, reports insufficient gold, adds persistent slots and charges the current price', async () => {
  const bundle = await build({
    stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {GameProvider,useGame} from './src/context/GameContext';import {InventoryScreen} from './src/components/inventory/InventoryScreen';function Probe(){window.game=useGame();return window.game.player?<InventoryScreen/>:null;}window.act=act;window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""' },
    plugins: [localProgressPlugin,{ name: 'art', setup(b) { b.onLoad({ filter: /\.(jpg|webp)$/ }, () => ({ contents: 'export default "art";', loader: 'js' })); } }],
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  w.MessageChannel = class { port1 = { onmessage: null as any }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.Headers = Headers;
  let active = true;
  w.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ active, items: [], ok: true, totalGold: 0 }) });
  w.eval(bundle.outputFiles[0].text);
  const expansionButton = () => [...w.document.querySelectorAll('button')].find((button: any) => button.textContent.startsWith('+5 слотов')) as any;
  try {
    await w.act(async () => w.mount());
    await w.act(async () => w.game.createCharacter('Испытатель', 'warrior'));
    assert.match(expansionButton().textContent, /2\s400/);
    const startingGold = w.game.player.gold;
    await w.act(async () => expansionButton().click());
    assert.match(w.document.body.textContent, /Недостаточно золота/);
    assert.equal(w.game.player.maxInventorySlots, 40);
    assert.equal(w.game.player.gold, startingGold);
    const save = JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data_749219401'));
    save.player.gold = 5500;
    await w.act(async () => w.root.unmount());
    w.localStorage.setItem('aethelgard_save_v1_data_749219401', JSON.stringify(save));
    await w.act(async () => w.mount());
    await w.act(async () => expansionButton().click());
    assert.equal(w.game.player.maxInventorySlots, 45);
    assert.equal(w.game.player.gold, 3100);
    assert.match(w.document.body.textContent, /Сумка расширена: \+5 слотов, всего 45/);
    assert.match(expansionButton().textContent, /2\s700/);
    await w.act(async () => expansionButton().click());
    assert.equal(w.game.player.maxInventorySlots, 50);
    assert.equal(w.game.player.gold, 400);
    await w.act(async () => expansionButton().click());
    assert.equal(w.game.player.maxInventorySlots, 50);
    assert.equal(w.game.player.gold, 400);
    assert.match(w.document.body.textContent, /Недостаточно золота/);
    active = false;
    await w.act(async () => w.game.refreshPremiumStatus());
    let denied: any;
    await w.act(async () => { denied = w.game.expandInventory(); });
    assert.equal(denied.success, false);
    assert.match(denied.message, /активный Premium/);
    await w.act(async () => w.root.unmount());
    await w.act(async () => w.mount());
    assert.equal(w.game.player.maxInventorySlots, 50, 'purchased slots survive reload and Premium expiry');
    assert.equal(w.game.player.gold, 400);
  } finally {
    await w.act(async () => w.root.unmount());
    dom.window.close();
  }
});
