import React, { useEffect, useState } from 'react';
import { GameItem } from '../../types/game';
import { RpgIcon, getRpgIconKind } from './RpgIcon';
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
  const [failed, setFailed] = useState(false);
  const src = getItemArtworkPath(item);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!failed) {
    return (
      <img
        src={src}
        alt={item.name}
        width={size}
        height={size}
        loading="lazy"
        className={`object-contain rounded-md ${className}`}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`relative rounded-lg bg-slate-950/80 border border-slate-700 flex items-center justify-center ${fallbackClassName}`}
      style={{ width: size, height: size }}
      title={item.name}
    >
      <RpgIcon kind={getRpgIconKind(item)} size={Math.round(size * 0.7)} className="text-[#b99558]" />
    </div>
  );
};
