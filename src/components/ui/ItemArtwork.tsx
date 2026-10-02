import { t as localize, useLocale } from '../../i18n/locale';
import React, { useEffect, useState } from 'react';
import { GameItem } from '../../types/game';
import { RpgIcon, getRpgIconKind } from './RpgIcon';
import { getItemSpritePath } from '../../utils/itemSprites';
import { getResourceVectorArtwork } from '../../utils/resourceArtwork';
import { getItemArtworkPath } from '../../utils/itemArtwork';

interface ItemArtworkProps {
  item: Pick<GameItem, 'name' | 'type' | 'rarity' | 'icon' | 'image'>;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

export const ItemArtwork: React.FC<ItemArtworkProps> = ({
  item,
  size = 40,
  className = '',
  fallbackClassName = ''
}) => {
  useLocale();
  const primary = getItemArtworkPath(item);
  const backup = item.type === 'ore' || item.type === 'material'
    ? getResourceVectorArtwork(item.name, item.type) : getItemSpritePath(item);
  const sources = [...new Set([primary, backup].filter((s): s is string => Boolean(s)))];
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const src = sources.find(source => !failedSources.includes(source));

  useEffect(() => {
    setFailedSources([]);
  }, [primary, backup]);

  if (src) {
    return (
      <img
        src={src}
        alt={localize(item.name)}
        width={size}
        height={size}
        loading="lazy"
        className={`object-contain rounded-md ${className}`}
        onError={() => setFailedSources(failed => [...failed, src])}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`relative rounded-lg bg-slate-950/80 border border-slate-700 flex items-center justify-center ${fallbackClassName}`}
      style={{ width: size, height: size }}
      title={localize(item.name)}
    >
      <span className="text-xl leading-none">{localize(item.icon || '📦')}</span>
      <span className="absolute -bottom-1 -right-1 rounded bg-slate-950 border border-slate-700 p-0.5">
        <RpgIcon kind={getRpgIconKind(item)} size={Math.max(10, Math.round(size * 0.3))} className="text-slate-400" />
      </span>
    </div>
  );
};
