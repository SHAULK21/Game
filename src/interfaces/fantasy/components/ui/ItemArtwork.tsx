import { t as localize, useLocale } from '../../../../i18n/locale';
import React, { useEffect, useState } from 'react';
import { GameItem } from '../../../../types/game';
import { ItemArtwork as LegacyItemArtwork } from '../../../../components/ui/ItemArtwork';
import { getItemArtworkPath } from '../../utils/itemArtwork';

interface ItemArtworkProps {
  item: Pick<GameItem, 'name' | 'type' | 'rarity' | 'icon' | 'image'>;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

export const ItemArtwork: React.FC<ItemArtworkProps> = (props) => {
  useLocale();
  const { item, size = 40, className = '' } = props;
  const src = getItemArtworkPath(item);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) return <LegacyItemArtwork {...props} />;
  return <img src={src} alt={localize(item.name)} width={size} height={size} loading="lazy"
    className={`object-contain rounded-md ${className}`} onError={() => setFailed(true)} />;
};
