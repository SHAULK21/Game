import { useState, type ReactNode } from 'react';
import { useGame } from '../../context/GameContext';
import { useLocale } from '../../i18n/locale';
import { inSettlement } from '../../utils/worldPresence';
import { flightBattlesLeft } from '../../utils/flightPenalty';
import { BEER_ENERGY, INTOXICATION_BATTLES, INTOXICATION_PER_MUG, MAX_INTOXICATION_MUGS, canDrinkBeer, intoxicationPercent } from '../../utils/tavernBeer';

export function TavernScreen({ children }: { children: ReactNode }) {
  const { player, drinkBeer, isInCombat, isCombatEnded } = useGame();
  const { locale } = useLocale();
  const [message, setMessage] = useState('');
  if (!player) return null;
  const uk = locale === 'uk';
  const busy = !inSettlement(player) || isInCombat && !isCombatEnded;
  const shame = flightBattlesLeft(player);
  const percent = intoxicationPercent(player);
  return <section className="game-tavern" data-tavern-screen>
    <header className="tavern-intro"><h2>Таверна</h2></header>
    <aside className="tavern-beer-card" aria-label={uk ? 'Пиво в таверні' : 'Пиво в таверне'}>
      <div className="tavern-beer-row">
        <img className="tavern-beer-thumb" src="/assets/story/tavern-beer.webp" alt="" decoding="async" />
        <div className="tavern-beer-copy">
          <h3>{uk ? 'Кухоль пива' : 'Кружка пива'}</h3>
          <p className="tavern-beer-benefits">+{BEER_ENERGY} {uk ? 'енергії · безкоштовно' : 'энергии · бесплатно'}</p>
        </div>
      <button type="button" data-drink-beer disabled={busy || !canDrinkBeer(player)} onClick={() => {
        const result = drinkBeer();
        setMessage(result.success ? (uk ? 'Енергію поповнено, ганьбу знято.' : 'Энергия пополнена, позор снят.') : (uk ? 'Зараз випити не можна: дістаньтеся таверни та завершіть бій. За повної енергії без ганьби пиво не потрібне.' : result.message));
      }}>{uk ? 'Випити' : 'Выпить'}</button>
      </div>
      <p className="tavern-beer-warning">{uk ? `Знімає ганьбу · −${INTOXICATION_PER_MUG}% атаки й захисту за кухоль` : `Снимает позор · −${INTOXICATION_PER_MUG}% атаки и защиты за кружку`}</p>
      <div className="tavern-current-effects" role="status">
        <span>{uk ? 'Енергія' : 'Энергия'}: {player.energy}/{player.maxEnergy}</span>
        {shame > 0 && <span>{uk ? 'Ганьба втікача' : 'Позор беглеца'} · {shame} {uk ? 'боїв' : 'боёв'}</span>}
        {percent > 0 && <span>{uk ? 'Сп’яніння' : 'Опьянение'} · −{percent}% · {player.intoxication?.battlesLeft} {uk ? 'боїв' : 'боёв'}</span>}
      </div>
      {!canDrinkBeer(player) && <p className="tavern-hint">{uk ? 'Енергія повна — відпочиньте в чаті.' : 'Энергия полна — отдохните в чате.'}</p>}
      {message && <p className="tavern-feedback" role="status" aria-live="polite">{message}</p>}
      <details className="tavern-beer-details">
        <summary>{uk ? 'Як діє пиво?' : 'Как действует пиво?'}</summary>
        <p>{uk ? `Знімає «Ганьбу втікача». Кожен кухоль: −${INTOXICATION_PER_MUG}% фізичної й магічної атаки та обох захистів, до −${INTOXICATION_PER_MUG * MAX_INTOXICATION_MUGS}%. Ефект минає після ${INTOXICATION_BATTLES} завершених боїв. Новий кухоль оновлює строк; втеча його не скорочує.` : `Снимает «Позор беглеца». Каждая кружка: −${INTOXICATION_PER_MUG}% физической и магической атаки и обеих защит, до −${INTOXICATION_PER_MUG * MAX_INTOXICATION_MUGS}%. Эффект проходит после ${INTOXICATION_BATTLES} завершённых боёв. Новая кружка обновляет срок; побег его не сокращает.`}</p>
      </details>
    </aside>
    <div id="tavern-chat">{children}</div>
  </section>;
}
