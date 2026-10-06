import { useGame } from '../../context/GameContext';
import { t as localize, useLocale } from '../../i18n/locale';
import { regionCompleted } from '../../utils/regionalProgress';

export function RegionCompletionReward({region}: {region: {id:string; minLevel:number}}) {
  useLocale();
  const {player, claimRegionCompletion} = useGame();
  if (!player || !regionCompleted(player, region)) return null;
  const claimed = player.regionalRewardsClaimed?.includes(region.id);
  return <div className="mt-3 space-y-2 text-xs text-amber-200" data-region-completion={region.id}>
    <p>{localize(claimed ? 'Награда за освоение получена.' : 'Локация освоена! Заберите награду:')}
      {!claimed && ` ${200 * region.minLevel} 🪙 · ${60 * region.minLevel} 🥈 · 1 🎟️`}</p>
    {!claimed && <button className="ui-primary rpg-button rpg-button-primary min-h-11 w-full rounded-lg px-3" onClick={()=>claimRegionCompletion(region.id)}>{localize('Забрать награду за освоение')}</button>}
    {region.id === 'reg_plains' && (player.ascension?.rank || 'E') === 'E' && <p>{localize('Далее: арена E → D, опасная дорога за осколками и вознесение. Шепчущий лес откроется после вознесения на 5-м уровне.')}</p>}
  </div>;
}
