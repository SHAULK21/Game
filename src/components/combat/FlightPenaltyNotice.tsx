import { useGame } from '../../context/GameContext';
import { useLocale } from '../../i18n/locale';
import { flightBattlesLeft } from '../../utils/flightPenalty';
export function FlightPenaltyNotice() {
  const { player, isInCombat, isCombatEnded } = useGame();
  const { locale } = useLocale();
  const count = flightBattlesLeft(player);
  if (!count) return null;
  return <div role="status" className="mx-auto w-full max-w-lg rounded-lg border border-[#995344] bg-[#291b16] px-3 py-2 text-xs leading-relaxed text-[#f0d4b3]">
    <strong>{locale === 'uk' ? 'Ганьба втікача' : 'Позор беглеца'}</strong>
    {' · '}{locale === 'uk' ? '−10% атаки й захисту' : '−10% атаки и защиты'}
    <span className="block">{locale === 'uk' ? 'Залишилось боїв: ' : 'Осталось боёв: '}{count}
      {isInCombat && !isCombatEnded ? (locale === 'uk' ? ' (включно з поточним)' : ' (включая текущий)') : ''}</span>
  </div>;
}
