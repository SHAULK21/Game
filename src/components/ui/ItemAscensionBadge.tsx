import type {GameItem} from '../../types/game';
import {itemAscensionLevel} from '../../utils/itemAscension';

export function ItemAscensionBadge({item, compact = false}: {item: GameItem; compact?: boolean}) {
  const rank = itemAscensionLevel(item);
  if (!rank) return null;
  return <span data-item-ascension-rank={rank} className="text-[10px] font-bold text-amber-600" title={`Піднесення ${rank}/5 · +${rank * 10}% до основних характеристик`} aria-label={`Піднесення ${rank}/5`}>{compact ? `◆${rank}` : `Піднесення ${rank}/5`}</span>;
}
