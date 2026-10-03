import React, { useId, useState } from 'react';
import atlas from '../../../../../public/assets/sprites/reference/approved-parts/manifest.json';

export type ReferencePartId = keyof typeof atlas.regions;
export type ReferenceFrameId = keyof typeof atlas.frames;
type Crop = readonly number[];
const ROOT = '/assets/sprites/reference/approved-parts/';

function CropArt({ source, rect, edge = false }: { source: string; rect: Crop; edge?: boolean }) {
  const [failed, setFailed] = useState(false);
  const clip = `crop-${useId().replace(/:/g, '')}`;
  if (failed) return null;
  return <svg viewBox={rect.join(' ')} preserveAspectRatio={edge ? 'none' : 'xMidYMid meet'} width="100%" height="100%" aria-hidden="true">
    <defs><clipPath id={clip}><rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} /></clipPath></defs>
    <image clipPath={`url(#${clip})`} href={`${ROOT}${source}`} width={atlas.sourceDimensions[0]} height={atlas.sourceDimensions[1]} onError={() => setFailed(true)} />
  </svg>;
}

/** Displays one author-approved original graphic, never a whole reference screen. */
export function ReferencePart({ id, label, className = '' }: { id: ReferencePartId; label?: string; className?: string }) {
  const part = atlas.regions[id];
  return <span className={`reference-part ${className}`} data-reference-part={id} role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label}
    style={{ display: 'inline-block', aspectRatio: `${part.rect[2]} / ${part.rect[3]}` }}>
    <CropArt key={part.source} source={part.source} rect={part.rect} />
  </span>;
}

/** Exposes only the outer frame strips, excluding every baked center label. */
export function ReferenceFrameParts({ id }: { id: ReferenceFrameId }) {
  const frame = atlas.frames[id];
  return <span aria-hidden="true" data-reference-frame={id} className="reference-frame-parts">
    {Object.entries(frame.parts).map(([name, rect]) => <span key={name} data-frame-strip={name}>
      <CropArt source={frame.source} rect={rect} edge={['top', 'bottom', 'left', 'right'].includes(name)} />
    </span>)}
  </span>;
}
