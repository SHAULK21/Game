import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

for (const theme of ['fantasy', 'fantasy-beta']) {
  test(`${theme} independently loads styled, scrollable selection overlays`, async () => {
    // Follow the actual lazy entry's imports; a picker stylesheet loaded only
    // by the other interface must not satisfy this regression check.
    const bundle = await build({
      entryPoints: [`src/interfaces/${theme}/entry.tsx`], bundle: true,
      write: false, format: 'esm', external: ['/assets/*'], outdir: '/tmp/selection-style-check', metafile: true,
      loader: {'.webp': 'dataurl', '.jpg': 'dataurl', '.png': 'dataurl'},
    });
    assert.ok(bundle.metafile!.inputs['src/interfaces/fantasy/fantasy-selection.css']);
    const css = bundle.outputFiles.find(file => file.path.endsWith('.css'))!.text;
    // Only picker rules are needed for this DOM check (no browser paint claim).
    const rules = css.match(/[^{}]*\.selection-[^{}]*\{[^{}]*\}/g)!.join('\n');
    const dom = new JSDOM(`<html data-interface="${theme}"><head></head><body><div class="selection-backdrop"><div class="selection-dialog"><header><h2>Уровень рецептов</h2><button>×</button></header><input><div class="selection-options"><button class="selection-option">Все уровни</button></div></div></div></body></html>`);
    try {
      const style = dom.window.document.createElement('style');
      style.textContent = rules;
      dom.window.document.head.appendChild(style);
      const computed = (selector: string) => dom.window.getComputedStyle(dom.window.document.querySelector(selector)!);
      assert.equal(computed('.selection-backdrop').position, 'fixed');
      assert.equal(computed('.selection-backdrop').display, 'flex');
      assert.equal(computed('.selection-backdrop').zIndex, '130');
      assert.equal(computed('.selection-dialog').display, 'flex');
      assert.equal(computed('.selection-dialog').flexDirection, 'column');
      assert.equal(computed('.selection-options').overflowY, 'auto');
      assert.equal(computed('.selection-option').width, '100%');
    } finally { dom.window.close(); }
  });
}
