import { useGame } from '../../context/GameContext';
import { useLocale } from '../../i18n/locale';
import { monsterEnrageMultiplier, MONSTER_ENRAGE_ROUND, MONSTER_RELENTLESS_ROUND } from '../../utils/pveBalance';

/** Shared by modern, fantasy and beta combat screens. */
export function MonsterEnrageNotice() {
  const { activeMonster, combatRound, isInCombat, isCombatEnded } = useGame();
  const { locale } = useLocale();
  if (!activeMonster || !isInCombat || isCombatEnded || combatRound < 20) return null;
  const uk = locale === 'uk';
  const active = combatRound >= MONSTER_ENRAGE_ROUND;
  const relentless = combatRound >= MONSTER_RELENTLESS_ROUND;
  const multiplier = monsterEnrageMultiplier(activeMonster, combatRound).toFixed(2);
  return <div role="status" className="rounded-xl border border-amber-500/50 bg-amber-950/40 px-3 py-2 text-xs leading-relaxed text-amber-100">
    <strong>{relentless ? (uk ? 'Нестримна лють' : 'Неудержимая ярость') : active ? (uk ? 'Лють монстра' : 'Ярость монстра') : (uk ? 'Бій затягується' : 'Бой затягивается')}</strong>
    <p>{active
      ? (uk ? `Шкода атак ×${multiplier}; вона зростає з кожним раундом.` : `Урон атак ×${multiplier}; он растёт с каждым раундом.`)
      : (uk ? 'З 26-го раунду атаки монстра почнуть швидко посилюватися.' : 'С 26-го раунда атаки монстра начнут быстро усиливаться.')}</p>
    <p>{relentless
      ? (uk ? `Кожен удар забирає щонайменше ${(combatRound - MONSTER_RELENTLESS_ROUND + 1) * 5}% максимального HP, попри захист, ухилення й невразливість. Контроль не зупиняє монстра.` : `Каждый удар снимает не менее ${(combatRound - MONSTER_RELENTLESS_ROUND + 1) * 5}% максимального HP, несмотря на защиту, уклонение и неуязвимость. Контроль не останавливает монстра.`)
      : (uk ? 'З 40-го раунду лють пробиватиме захист і контроль.' : 'С 40-го раунда ярость начнёт пробивать защиту и контроль.')}</p>
  </div>;
}
