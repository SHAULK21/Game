import { t, useLocale } from '../../../../i18n/locale';
import type { PlayerCharacter } from '../../../../types/game';
import { talentManaCost } from '../../../../data/talents';
import { skillTier } from '../../../../data/classEvolution';

/** Battle summary only. The extended codex remains exclusive to registration. */
export function CombatSkillList({ player, mana, comboReady, playerTurn, onUse }: {
  player: PlayerCharacter; mana: number; comboReady: string[]; playerTurn: boolean; onUse: (id: string) => void;
}) {
  useLocale();
  return <div className="combat-skill-ledger">
    {player.skills.map(skill => {
      const cost = talentManaCost(skill.manaCost, player.talents);
      const hasMana = mana >= cost;
      const locked = player.level < skill.levelReq;
      const cooling = (skill.currentCooldown || 0) > 0;
      const canUse = hasMana && !locked && !cooling;
      const combo = comboReady.includes(skill.id);
      return <button key={skill.id} type="button" data-combat-skill={skill.id}
        disabled={!canUse || !playerTurn} onClick={() => onUse(skill.id)}
        className={`combat-skill-entry ${combo ? 'is-combo' : ''}`}>
        <span className="combat-skill-copy">
          <span className="combat-skill-heading"><strong>{t(skill.name)}</strong>
            <span className="combat-ink-tag">{t(skill.id.startsWith('asc_') ? `Ранг ${skill.id.endsWith('_C') ? 'C' : player.ascension?.rank === 'SSS' ? 'SSS' : 'S'}` : ['I', 'II', 'III', 'IV'][skillTier(player) - 1])}</span>
            {combo && <span className="combat-ink-tag">{t('Связка')}</span>}
            {skill.isUltimate && <span className="combat-ink-tag">{t('УЛЬТ')}</span>}
          </span>
          <span className="combat-skill-description">{t(skill.description)}</span>
          {locked && <span className="combat-unavailable">{t('Доступно с уровня ')}{skill.levelReq}</span>}
          {cooling && <span className="combat-unavailable">{t('Перезарядка: ')}{skill.currentCooldown}</span>}
        </span>
        <span className={`combat-mana-cost ${hasMana ? '' : 'combat-unavailable'}`}>{cost} MP</span>
      </button>;
    })}
    {player.skills.every(s => !s.hidden) && <p className="combat-ledger-note">{t('Неизвестный классовый навык откроется при развитии героя.')}</p>}
  </div>;
}
