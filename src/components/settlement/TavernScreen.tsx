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
  const [chatOpen, setChatOpen] = useState(false);
  if (!player) return null;
  const uk = locale === 'uk';
  const busy = !inSettlement(player) || isInCombat && !isCombatEnded;
  const shame = flightBattlesLeft(player);
  const percent = intoxicationPercent(player);
  return <section className="game-tavern" data-tavern-screen>
    <div className="tavern-art"><img src="/assets/story/tavern-beer.webp" alt="" decoding="async" /></div>
    <header><p className="tavern-eyebrow">{uk ? 'Вогні поселення' : 'Огни поселения'}</p><h2>Таверна</h2><p>{uk ? 'Перепочиньте біля вогнища та зустріньте інших шукачів.' : 'Переведите дух у очага и встретьте других искателей.'}</p></header>
    <div className="tavern-beer-card">
      <h3>{uk ? 'Кухоль пива' : 'Кружка пива'}</h3>
      <div className="tavern-beer-benefits"><strong>+{BEER_ENERGY} {uk ? 'енергії' : 'энергии'}</strong><span>{uk ? 'Безкоштовно' : 'Бесплатно'}</span></div>
      <p>{uk ? 'Знімає «Ганьбу втікача», але додає сп’яніння.' : 'Снимает «Позор беглеца», но добавляет опьянение.'}</p>
      <p>{uk ? `Кожен кухоль: −${INTOXICATION_PER_MUG}% фізичної й магічної атаки та обох захистів, до −${INTOXICATION_PER_MUG * MAX_INTOXICATION_MUGS}%. Ефект минає після ${INTOXICATION_BATTLES} завершених боїв. Новий кухоль оновлює строк; втеча його не скорочує.` : `Каждая кружка: −${INTOXICATION_PER_MUG}% физической и магической атаки и обеих защит, до −${INTOXICATION_PER_MUG * MAX_INTOXICATION_MUGS}%. Эффект проходит после ${INTOXICATION_BATTLES} завершённых боёв. Новая кружка обновляет срок; побег его не сокращает.`}</p>
      <div className="tavern-current-effects" role="status">
        <span>{uk ? 'Енергія' : 'Энергия'}: {player.energy}/{player.maxEnergy}</span>
        {shame > 0 && <span>{uk ? 'Ганьба втікача' : 'Позор беглеца'} · {shame} {uk ? 'боїв' : 'боёв'}</span>}
        {percent > 0 && <span>{uk ? 'Сп’яніння' : 'Опьянение'} · −{percent}% · {player.intoxication?.battlesLeft} {uk ? 'боїв' : 'боёв'}</span>}
      </div>
      <button type="button" data-drink-beer disabled={busy || !canDrinkBeer(player)} onClick={() => {
        const result = drinkBeer();
        setMessage(result.success ? (uk ? 'Пиво відновило енергію. Ганьбу знято, сп’яніння посилилося.' : 'Пиво восстановило энергию. Позор снят, опьянение усилилось.') : (uk ? 'Зараз випити не можна: дістаньтеся таверни та завершіть бій. За повної енергії без ганьби пиво не потрібне.' : result.message));
      }}>{uk ? `Випити · +${BEER_ENERGY} енергії` : `Выпить · +${BEER_ENERGY} энергии`}</button>
      {!canDrinkBeer(player) && <p className="tavern-hint">{uk ? 'Енергія повна, ганьби немає. Збережіть ясну голову.' : 'Энергия полна, позора нет. Сохраните ясную голову.'}</p>}
      {message && <p role="status" aria-live="polite">{message}</p>}
    </div>
    <button className="tavern-chat-toggle" type="button" aria-expanded={chatOpen} aria-controls="tavern-chat" onClick={() => setChatOpen(open => !open)}>{uk ? 'Розмови біля вогнища' : 'Разговоры у очага'} <span aria-hidden="true">{chatOpen ? '−' : '+'}</span></button>
    {chatOpen && <div id="tavern-chat">{children}</div>}
  </section>;
}
