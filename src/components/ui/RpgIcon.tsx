import React from 'react';
import { ItemType } from '../../types/game';

type RpgIconKind =
  | ItemType
  | 'gold'
  | 'silver'
  | 'energy'
  | 'stamina'
  | 'ore'
  | 'herb'
  | 'water'
  | 'toxin'
  | 'pollen'
  | 'fang'
  | 'gem'
  | 'shard'
  | 'alchemy';

interface RpgIconProps {
  kind: RpgIconKind;
  size?: number;
  className?: string;
  title?: string;
}

export const RpgIcon: React.FC<RpgIconProps> = ({
  kind,
  size = 28,
  className = 'text-cyan-300',
  title
}) => {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  const render = () => {
    switch (kind) {
      case 'gold':
        return <><circle {...common} cx="14" cy="14" r="9"/><path {...common} d="M9 14h10M11 10h6M11 18h6"/><path {...common} d="M14 7v14"/></>;
      case 'silver':
        return <><circle {...common} cx="14" cy="14" r="9"/><path {...common} d="M10 17c1.2 1.2 2.7 1.8 4 1.8 1.9 0 3.2-.9 3.2-2.1 0-1.5-1.5-1.9-3.2-2.3-1.7-.4-3.2-.8-3.2-2.3 0-1.3 1.3-2.2 3.2-2.2 1.2 0 2.4.4 3.3 1.2M14 8v12"/></>;
      case 'energy':
        return <path {...common} d="M16.5 2.5 7 14h6l-1.5 8L21 10h-6z"/>;
      case 'stamina':
        return <><path {...common} d="M5 10h14M6 14h12M8 18h8"/><path {...common} d="M4 8h16"/></>;
      case 'weapon':
        return <><path {...common} d="m5 19 9.5-9.5"/><path {...common} d="m13 6 5 5"/><path {...common} d="m16 3 5 5-3 3-5-5z"/><path {...common} d="m4 20 3 1-1-3z"/></>;
      case 'offhand':
      case 'shield':
        return <><path {...common} d="M14 3 21 6v5c0 5-3.1 8.4-7 10-3.9-1.6-7-5-7-10V6z"/><path {...common} d="m10 13 2 2 4-4"/></>;
      case 'helmet':
        return <><path {...common} d="M6 15v-3a8 8 0 0 1 16 0v3"/><path {...common} d="M5 15h18v4H5z"/><path {...common} d="M14 4v7"/></>;
      case 'armor':
        return <><path {...common} d="M9 4 5 7v8l3 1v4h12v-4l3-1V7l-4-3-3 2-4-2z"/><path {...common} d="M10 7h8M14 6v12"/></>;
      case 'pants':
        return <><path {...common} d="M8 4h12l-1 8 2 8h-5l-2-6-2 6H7l2-8z"/><path {...common} d="M14 4v10"/></>;
      case 'gloves':
        return <><path {...common} d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 4-2.7 6-7 6-5 0-8-2.8-8-7z"/></>;
      case 'boots':
        return <><path {...common} d="M8 3h6v11l5 3v4H4v-4l4-3z"/><path {...common} d="M14 14h5M8 14h6"/></>;
      case 'amulet':
        return <><path {...common} d="M6 4c1 6 3 9 8 9s7-3 8-9"/><path {...common} d="m14 12 4 4-4 5-4-5z"/></>;
      case 'ring':
        return <><circle {...common} cx="14" cy="14" r="7"/><circle {...common} cx="14" cy="14" r="3"/><path {...common} d="m14 3 2 3-2 2-2-2z"/></>;
      case 'belt':
        return <><path {...common} d="M4 10h20v8H4z"/><rect {...common} x="11" y="9" width="6" height="10" rx="1"/><path {...common} d="M4 12h6M18 12h6"/></>;
      case 'cloak':
        return <><path {...common} d="M10 4 14 7l4-3 4 17H6z"/><path {...common} d="M14 7v14M10 10l-3 4M18 10l3 4"/></>;
      case 'artifact':
      case 'gem':
        return <><path {...common} d="m14 2 8 7-8 13L6 9z"/><path {...common} d="m6 9 8 2 8-2M14 11v11"/></>;
      case 'potion':
      case 'alchemy':
        return <><path {...common} d="M11 3h6M12 3v5l-5 8a4 4 0 0 0 3.4 6h7.2A4 4 0 0 0 21 16l-5-8V3"/><path {...common} d="M9 16c2 1 4-2 6 0s3 1 5 0"/></>;
      case 'ore':
        return <><path {...common} d="m4 19 7-7 3 3 6-6"/><path {...common} d="m17 5 3-1-1 3"/><path {...common} d="m6 20-2-1 1-2 2 2z"/></>;
      case 'herb':
        return <><path {...common} d="M14 21c0-7 0-11 6-15-1 7-3 11-6 15z"/><path {...common} d="M14 21C8 18 6 14 7 8c5 3 7 7 7 13z"/></>;
      case 'water':
        return <><path {...common} d="M14 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/><path {...common} d="M11 15c.5 1.4 1.5 2.2 3 2.5"/></>;
      case 'toxin':
        return <><path {...common} d="M10 4h8M12 4v4l-5 9a3 3 0 0 0 2.6 4h8.8A3 3 0 0 0 21 17l-5-9V4"/><path {...common} d="m10 14 2-2 2 2 2-2"/><path {...common} d="M14 18v1"/></>;
      case 'pollen':
        return <><circle {...common} cx="14" cy="14" r="4"/><path {...common} d="M14 4v4M14 20v4M4 14h4M20 14h4M7 7l3 3M18 18l3 3M21 7l-3 3M10 18l-3 3"/></>;
      case 'fang':
        return <><path {...common} d="M7 4c2 1 4 1 7 0 1 5 4 9 6 12-3 2-5 3-6 5-1-2-3-3-6-5 2-3 5-7 6-12"/><path {...common} d="M11 9h6"/></>;
      case 'shard':
        return <><path {...common} d="m5 16 5-10 7 2 2 7-7 5z"/><path {...common} d="m10 6 3 7M17 8l-4 5M19 15l-6-2"/></>;
      case 'pet':
        return <><circle {...common} cx="9" cy="10" r="2"/><circle {...common} cx="19" cy="10" r="2"/><circle {...common} cx="14" cy="15" r="6"/><path {...common} d="M11 16h.1M17 16h.1M12 19c1 .8 3 .8 4 0"/></>;
      case 'material':
      default:
        return <><path {...common} d="m14 3 8 4v10l-8 4-8-4V7z"/><path {...common} d="m6 7 8 4 8-4M14 11v10"/></>;
    }
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      title={title}
      aria-hidden={!title}
    >
      <svg width={size} height={size} viewBox="0 0 28 28" role={title ? 'img' : undefined}>
        {title ? <title>{title}</title> : null}
        {render()}
      </svg>
    </span>
  );
};

export const getRpgIconKind = (item: { type: ItemType; name?: string }): RpgIconKind => {
  const name = (item.name || '').toLowerCase();
  if (item.type === 'ore') return 'ore';
  if (item.type === 'potion') return 'potion';
  if (name.includes('лечеб') || name.includes('трава') || name.includes('цветок') || name.includes('корень')) return 'herb';
  if (name.includes('вода')) return 'water';
  if (name.includes('пыльца')) return 'pollen';
  if (name.includes('клык')) return 'fang';
  if (name.includes('яд')) return 'toxin';
  if (name.includes('самоцвет') || name.includes('алмаз')) return 'gem';
  return item.type;
};
