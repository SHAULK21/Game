import { t as localize, useLocale } from '../../../../i18n/locale';
import React from 'react';
import { ItemType } from '../../../../types/game';

export type RpgIconKind =
  | ItemType
  | 'attack'
  | 'defend'
  | 'skill'
  | 'map'
  | 'bestiary'
  | 'monster'
  | 'character'
  | 'inventory'
  | 'forge'
  | 'mine'
  | 'arena'
  | 'clan'
  | 'market'
  | 'quest'
  | 'settings'
  | 'more'
  | 'hunt'
  | 'crown'
  | 'hp'
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
  | 'alchemy'
  | 'refresh'
  | 'leave';

interface RpgIconProps {
  kind: RpgIconKind;
  size?: number;
  className?: string;
  title?: string;
}

export const RpgIcon: React.FC<RpgIconProps> = ({
  kind,
  size = 28,
  className = 'text-[#a48b60]',
  title
}) => {
  useLocale();
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  const render = () => {
    switch (kind) {
      case 'attack':
        return <><path {...common} d="m6 22 10-10"/><path {...common} d="m13 5 2-2 7 7-2 2z"/><path {...common} d="m5 15 8 8M3 20l3 3M18 3l7 7"/></>;
      case 'defend':
      case 'offhand':
        return <><path {...common} d="M14 3 22 6v5c0 5.2-3.4 8.6-8 11-4.6-2.4-8-5.8-8-11V6z"/><path {...common} d="m10 13 2.5 2.5L18 10"/></>;
      case 'skill':
        return <><path {...common} d="m14 2 2.4 7.6L24 12l-7.6 2.4L14 22l-2.4-7.6L4 12l7.6-2.4z"/><path {...common} d="m21 18 .8 2.2L24 21l-2.2.8L21 24l-.8-2.2L18 21l2.2-.8z"/></>;
      case 'map':
        return <><path {...common} d="m3 6 6-3 10 3 6-3v19l-6 3-10-3-6 3z"/><path {...common} d="M9 3v19M19 6v19"/><path {...common} d="M14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></>;
      case 'bestiary':
        return <><path {...common} d="M4 5.5c3.7-1.8 7-1.5 10 1v17c-3-2.5-6.3-2.8-10-1z"/><path {...common} d="M24 5.5c-3.7-1.8-7-1.5-10 1v17c3-2.5 6.3-2.8 10-1z"/><path {...common} d="M8 10c1.5-.5 3-.3 4.5.5M20 10c-1.5-.5-3-.3-4.5.5"/></>;
      case 'monster':
        return <><path {...common} d="m6 4 5 4 3-2 3 2 5-4 1 8-3 7-6 5-6-5-3-7z"/><path {...common} d="M9 13h.1M19 13h.1M11 17l3 2 3-2M12 11l2 1 2-1"/><path {...common} d="m8 18-3 3M20 18l3 3"/></>;
      case 'character':
        return <><circle {...common} cx="14" cy="8" r="4"/><path {...common} d="M5 24c.5-5.2 3.5-8 9-8s8.5 2.8 9 8z"/><path {...common} d="M11 8h.1M17 8h.1"/></>;
      case 'inventory':
        return <><path {...common} d="M5 8h18l-1 15H6z"/><path {...common} d="M9 8V6a5 5 0 0 1 10 0v2M10 13v2M18 13v2"/></>;
      case 'forge':
        return <><path {...common} d="M3 17h22l-3 5H7z"/><path {...common} d="m7 17 4-5h6l4 5M11 12l2-4h6l2 4"/><path {...common} d="M5 9h8l-2 3H4z"/></>;
      case 'mine':
      case 'pickaxe':
        return <><path {...common} d="m7 23 11-16"/><path {...common} d="M3 10C8 3 18 2 25 8l-9-1-3 4z"/></>;
      case 'arena':
        return <><path {...common} d="M5 4h18v4c0 6-4 10-9 10S5 14 5 8z"/><path {...common} d="M5 7H2v2c0 3 2 5 5 5M23 7h3v2c0 3-2 5-5 5M14 18v4M9 23h10"/></>;
      case 'clan':
        return <><circle {...common} cx="14" cy="7" r="3"/><circle {...common} cx="6" cy="19" r="3"/><circle {...common} cx="22" cy="19" r="3"/><path {...common} d="m12.5 9.5-4.8 7M15.5 9.5l4.8 7M9 19h10"/></>;
      case 'market':
        return <><path {...common} d="M4 11h20l-2-7H6z"/><path {...common} d="M6 11v12h16V11M10 23v-7h7v7"/><path {...common} d="M4 11c0 2 3 2 3 0 0 2 4 2 4 0 0 2 4 2 4 0 0 2 4 2 4 0 0 2 5 2 5 0"/></>;
      case 'quest':
        return <><path {...common} d="M6 4h16v20H6z"/><path {...common} d="M6 7H4v15h16"/><path {...common} d="M10 9h8M10 13h8M10 17h5"/><path {...common} d="m17 20 1.5 1.5L22 18"/></>;
      case 'settings':
        return <><circle {...common} cx="14" cy="14" r="3"/><path {...common} d="M14 3v3M14 22v3M3 14h3M22 14h3M6.2 6.2l2.1 2.1m11.4 11.4 2.1 2.1m0-15.6-2.1 2.1M8.3 19.7l-2.1 2.1"/><circle {...common} cx="14" cy="14" r="8"/></>;
      case 'more':
        return <><circle {...common} cx="5" cy="14" r="1.5"/><circle {...common} cx="14" cy="14" r="1.5"/><circle {...common} cx="23" cy="14" r="1.5"/></>;
      case 'refresh':
        return <><path {...common} d="M22 8V3l-2 2a9 9 0 0 0-14 3M6 20a9 9 0 0 0 14-3"/><path {...common} d="M6 3v5H1M22 17v5h5"/></>;
      case 'leave':
        return <><path {...common} d="M16 4h6v20h-6M11 18l5-4-5-4M16 14H4"/><path {...common} d="M11 4H4v20h7"/></>;
      case 'hunt':
        return <><circle {...common} cx="14" cy="14" r="10"/><circle {...common} cx="14" cy="14" r="5"/><path {...common} d="m14 14 9-9M18 5h5v5"/></>;
      case 'crown':
        return <><path {...common} d="m3 8 6 5 5-8 5 8 6-5-2 13H5z"/><path {...common} d="M5 24h18M9 18h10"/></>;
      case 'hp':
        return <path {...common} d="M14 23s-9-5.7-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.3-9 12-9 12z"/>;
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
      case 'alchemyTool':
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
      title={localize(title)}
      aria-hidden={!title}
    >
      <svg width={size} height={size} viewBox="0 0 28 28" role={title ? 'img' : undefined}>
        {title ? <title>{localize(title)}</title> : null}
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
