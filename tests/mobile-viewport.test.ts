import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { observeMobileViewport } from '../src/utils/mobileViewport';

async function fixture(run: (w: any, viewport: any) => Promise<void>) {
  const dom = new JSDOM('<input id="name"><input id="range" type="range"><textarea></textarea>', { pretendToBeVisual:true });
  const w: any = dom.window;
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  Object.assign(globalThis, {window:w, document:w.document});
  Object.defineProperty(w, 'innerHeight', { value:844, writable:true });
  const viewport: any = new w.EventTarget();
  Object.assign(viewport, {height:844, offsetTop:0, scale:1});
  Object.defineProperty(w, 'visualViewport', {value:viewport, configurable:true});
  try { await run(w, viewport); }
  finally { Object.assign(globalThis, {window:previousWindow, document:previousDocument}); dom.window.close(); }
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

// Each observer is explicitly disposed, including pending animation-frame callbacks.
test('mobile viewport follows the software keyboard, focus and restoration without treating zoom as typing', async () => {
  await fixture(async (w, viewport) => {
    const cleanup = observeMobileViewport();
    try {
      const root=w.document.documentElement;
      assert.equal(root.style.getPropertyValue('--app-visible-height'),'844px');
      w.document.querySelector('#name').focus(); viewport.height=480; viewport.offsetTop=40;
      viewport.dispatchEvent(new w.Event('resize')); await settle();
      assert.equal(root.dataset.keyboardOpen,'true');
      assert.equal(root.style.getPropertyValue('--app-visible-height'),'480px');
      assert.equal(root.style.getPropertyValue('--app-visible-top'),'40px');
      viewport.scale=2; viewport.height=422; viewport.dispatchEvent(new w.Event('resize')); await settle();
      assert.equal(root.dataset.keyboardOpen,'false');
      assert.equal(root.style.getPropertyValue('--app-visible-height'),'844px');
      viewport.scale=1; viewport.height=844; viewport.offsetTop=0;
      viewport.dispatchEvent(new w.Event('resize')); await settle();
      assert.equal(root.dataset.keyboardOpen,'false');
      w.document.querySelector('#range').focus(); viewport.height=480;
      viewport.dispatchEvent(new w.Event('resize')); await settle();
      assert.equal(root.dataset.keyboardOpen,'false', 'range controls do not open a keyboard');
    } finally { cleanup(); }
  });
});

test('Telegram safe-area events update insets and cleanup removes handlers and pending changes', async () => {
  await fixture(async (w) => {
    const handlers=new Map<string,()=>void>();
    const tg={initData:'test',viewportHeight:800,safeAreaInset:{top:47,bottom:34,left:0,right:0},contentSafeAreaInset:{top:45,bottom:0,left:0,right:0},onEvent:(event:string,cb:()=>void)=>handlers.set(event,cb),offEvent:(event:string)=>handlers.delete(event)};
    w.Telegram={WebApp:tg};
    const root=w.document.documentElement;
    root.style.setProperty('--app-visible-height','600px');
    const cleanup=observeMobileViewport();
    assert.equal(root.style.getPropertyValue('--app-visible-height'),'800px');
    assert.equal(root.style.getPropertyValue('--app-tg-safe-top'),'47px');
    assert.equal(root.style.getPropertyValue('--app-tg-content-top'),'45px');
    tg.safeAreaInset.bottom=21; handlers.get('safeAreaChanged')!(); await settle();
    assert.equal(root.style.getPropertyValue('--app-tg-safe-bottom'),'21px');
    tg.safeAreaInset.bottom=50; handlers.get('safeAreaChanged')!(); cleanup(); await settle();
    assert.equal(handlers.size,0);
    assert.equal(root.style.getPropertyValue('--app-visible-height'),'600px');
    assert.equal(root.style.getPropertyValue('--app-tg-safe-bottom'),'');
    assert.equal(root.dataset.keyboardOpen,undefined);
  });
});

test('browser fallback tolerates absent VisualViewport and Telegram SDK', async () => {
  await fixture(async (w) => {
    Object.defineProperty(w,'visualViewport',{value:undefined});
    const cleanup=observeMobileViewport();
    try { assert.equal(w.document.documentElement.style.getPropertyValue('--app-visible-height'),'844px'); }
    finally { cleanup(); }
  });
});
