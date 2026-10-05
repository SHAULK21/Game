import { useGame } from '../../context/GameContext';
import { useLocale } from '../../i18n/locale';
export function FirstJourneyHint() {
  const {player} = useGame();
  const {locale} = useLocale();
  if (player?.firstJourney !== 'done' || player.statPoints <= 0 || player.statsSummary.monstersKilled > 1) return null;
  return <p role="status" className="rounded-lg border border-[#806b44] bg-[#262116] p-3 text-sm leading-relaxed text-[#e3cfaa]">{locale==='uk'?'Перший бій позаду. Розподіли вільні очки: натискай «+» біля потрібних характеристик.':'Первый бой позади. Распредели свободные очки: нажимай «+» рядом с нужными характеристиками.'}</p>;
}
