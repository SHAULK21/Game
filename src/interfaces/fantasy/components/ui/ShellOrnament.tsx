import React, { useId } from 'react';

const ATLAS = '/assets/sprites/generated/ui/shell-v1/ornaments.webp';
const SIZE = 1254;
const REGIONS = {
  hud: [39, 45, 550, 537],
  inactive: [686, 88, 522, 499],
  active: [34, 655, 560, 522],
  divider: [629, 889, 620, 87],
} as const;
type Rect = readonly [number, number, number, number];

/** Native-size corner crops; only plain edge segments repeat. Ornament never stretches. */
const Tile = ({ rect, repeat, className }: { rect: Rect; repeat?: 'x' | 'y' | 'both'; className: string }) => {
  const id = `shell-${useId().replace(/:/g, '')}`;
  const [x, y, width, height] = rect;
  const art = <image href={ATLAS} width={SIZE} height={SIZE} />;
  if (!repeat) return <svg className={className} viewBox={rect.join(' ')} preserveAspectRatio="xMidYMid meet">{art}</svg>;
  // Map source pixels to a fixed physical scale, independently of the edge length.
  const scale = repeat === 'both' ? .25 : 20 / 110;
  return <svg className={className}>
    <defs><pattern id={id} patternUnits="userSpaceOnUse" width={width * scale} height={height * scale}>
      <svg width={width * scale} height={height * scale} viewBox={`${x} ${y} ${width} ${height}`}>{art}</svg>
    </pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>;
};

export const ShellOrnament = ({ variant = 'hud' }: { variant?: 'hud' | 'inactive' | 'active' | 'divider' }) => {
  const [x, y, w, h] = REGIONS[variant];
  if (variant === 'divider') return <span className="shell-divider" aria-hidden="true"><Tile rect={REGIONS.divider} className="shell-divider-art" /></span>;
  const c = 110;
  return <span className={`shell-ornament shell-ornament-${variant}`} aria-hidden="true" data-shell-frame={variant}>
    {variant !== 'hud' && <Tile rect={[x + 150, y + 150, 160, 160]} repeat="both" className="shell-frame-fill" />}
    <Tile rect={[x, y, c, c]} className="shell-corner shell-top-left" />
    <Tile rect={[x + w - c, y, c, c]} className="shell-corner shell-top-right" />
    <Tile rect={[x, y + h - c, c, c]} className="shell-corner shell-bottom-left" />
    <Tile rect={[x + w - c, y + h - c, c, c]} className="shell-corner shell-bottom-right" />
    <Tile rect={[x + c + 10, y, 50, c]} repeat="x" className="shell-edge shell-top" />
    <Tile rect={[x + c + 10, y + h - c, 50, c]} repeat="x" className="shell-edge shell-bottom" />
    <Tile rect={[x, y + c + 10, c, 50]} repeat="y" className="shell-edge shell-left" />
    <Tile rect={[x + w - c, y + c + 10, c, 50]} repeat="y" className="shell-edge shell-right" />
    <Tile rect={[x + w / 2 - 45, y, 90, c]} className="shell-accent shell-accent-top" />
    <Tile rect={[x + w / 2 - 45, y + h - c, 90, c]} className="shell-accent shell-accent-bottom" />
  </span>;
};
