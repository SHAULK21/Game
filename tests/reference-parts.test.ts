import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferencePart, ReferenceFrameParts } from '../src/interfaces/fantasy/components/ui/ReferencePart';

const root = 'public/assets/sprites/reference/approved-parts/';
const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));

test('approved extraction retains original JPEG bytes and all crop bounds fit their sources', () => {
  for (const [source, expected] of Object.entries(manifest.sha256)) {
    assert.equal(createHash('sha256').update(readFileSync(root + source)).digest('hex'), expected);
  }
  const bounds = (source: string, rect: number[]) => {
    assert(source in manifest.sha256);
    const [x, y, width, height] = rect;
    assert(rect.every(Number.isFinite));
    assert(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert(x + width <= 578 && y + height <= 1280);
  };
  for (const part of Object.values(manifest.regions) as any[]) bounds(part.source, part.rect);
  for (const frame of Object.values(manifest.frames) as any[]) {
    assert.equal(Object.keys(frame.parts).length, 8);
    assert(!('center' in frame.parts), 'baked labels must never become frame centers');
    for (const rect of Object.values(frame.parts) as number[][]) bounds(frame.source, rect);
  }
  const classes = Object.entries(manifest.regions).filter(([id]) => id.startsWith('class-'));
  assert.equal(classes.length, 10);
  assert.equal(new Set(classes.map(([, p]: any) => p.rect.join(','))).size, 10);
});

test('each reference part clips the source explicitly, including SVG letterbox space', () => {
  const html = renderToStaticMarkup(React.createElement(ReferencePart, { id: 'class-paladin', label: 'Паладин' }));
  assert(html.includes('role="img"') && html.includes('aria-label="Паладин"'));
  assert(html.includes('viewBox="345 799 83 99"'));
  assert(html.includes('<clipPath') && html.includes('clip-path="url(#'));
  assert(html.includes('x="345" y="799" width="83" height="99"'));
  const frame = renderToStaticMarkup(React.createElement(ReferenceFrameParts, { id: 'navigation' }));
  assert.equal((frame.match(/data-frame-strip=/g) || []).length, 8);
  assert.equal((frame.match(/<clipPath/g) || []).length, 8);
  assert(!frame.includes('data-frame-strip="center"'));
});
