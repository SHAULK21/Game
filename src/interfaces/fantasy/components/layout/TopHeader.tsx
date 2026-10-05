import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import { InterfaceSwitcher } from '../../../../components/ui/InterfaceSwitcher';
import React, { useState, useEffect } from 'react';
import { useGame } from '../../../../context/GameContext';
import { RpgIcon } from '../ui/RpgIcon';
import { getEnergyElixirPrice } from '../../../../utils/dungeonRewards';
import { getFantasyHeroArtwork } from '../../utils/heroArtwork';
import { RpgButton, DialogFrame } from '../ui/BestiaryUI';

interface TopHeaderProps {
  onOpenCharacterSheet: () => void;
}

const compactCount = (value: number) => {
  const unit = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e4, 'k']].find(([threshold]) => value >= Number(threshold));
  if (!unit) return value.toLocaleString(intlLocale());
  const divisor = unit[1] === 'k' ? 1000 : Number(unit[0]);
  const count = value / divisor;
  return `${count.toFixed(count >= 100 ? 0 : 1)}${unit[1]}`;
};

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenCharacterSheet }) => {
  useLocale();
  const { player, meditateOrRefillEnergy, premium } = useGame();
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!showEnergyModal) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showEnergyModal]);

  if (!player) return null;
  const meditationWait = Math.max(0, (player.lastMeditationTimestamp || 0) + 30 * 60_000 - now);
  const meditationDisabled = meditationWait > 0 || player.energy >= player.maxEnergy;
  const elixirPrice = getEnergyElixirPrice(premium.active);
  const currentEnergy = player.energy ?? 100;
  const maxEnergy = player.maxEnergy ?? 100;
  const energyPct = Math.min(100, Math.round((currentEnergy / Math.max(1, maxEnergy)) * 100));

  return <>
    <header className="game-header fantasy-shell-header z-30 sticky top-0">
      <div className="header-content shell-hud-content">
        <button onClick={onOpenCharacterSheet} aria-label={localize("Открыть лист персонажа")} className="shell-hero-button">
          <span className="shell-hero-portrait">
            <img src={getFantasyHeroArtwork(player.classId)} alt="" draggable={false} />
          </span>
          <span className="shell-hero-identity">
            <span className="shell-hero-name truncate">{player.name}</span>
            <span className="shell-hero-level">{localize("Ур. ")}{localize(player.level)}</span>
          </span>
        </button>

        <div className="shell-hud-right">
          <div className="shell-resource-strip">
            <button type="button" onClick={() => setShowEnergyModal(true)} title={localize("Энергия. Открыть способы восстановления")} aria-label={localize("Энергия. Открыть способы восстановления")} className="shell-energy-resource">
              <span className="shell-energy-value"><RpgIcon kind="energy" size={14} /><span>{localize(currentEnergy)}/{localize(maxEnergy)}</span><span className="shell-energy-refill" aria-hidden="true">+</span></span>
            </button>
            <span className="shell-currency-group">
              <span className="shell-currency" title={`${localize("Золото")}: ${player.gold.toLocaleString(intlLocale())}`}><RpgIcon kind="gold" size={16} /><span>{compactCount(player.gold)}</span></span>
              <span className="shell-currency" title={`${localize("Серебро")}: ${(player.silver ?? 0).toLocaleString(intlLocale())}`}><RpgIcon kind="silver" size={16} /><span>{compactCount(player.silver ?? 0)}</span></span>
            </span>
          </div>
          <details className="shell-settings">
            <summary aria-label={localize("Стиль интерфейса")} title={localize("Стиль интерфейса")}><RpgIcon kind="settings" size={18} /></summary>
            <div className="shell-settings-content"><InterfaceSwitcher compact /></div>
          </details>
        </div>
        <span className="shell-energy-meter" role="progressbar" aria-label={localize("Энергия")} aria-valuemin={0} aria-valuemax={maxEnergy} aria-valuenow={currentEnergy}><span style={{ width: `${energyPct}%` }} /></span>
      </div>
    </header>

    <DialogFrame open={showEnergyModal} title={localize("Энергия охотника")} onClose={() => setShowEnergyModal(false)}>
        <p className="mb-4 text-xs leading-relaxed text-[#aaa49a]">{localize("Энергия тратится на охоту и переходы. Обычный бой стоит 2 единицы. Восстановление: 1 единица каждые 120 секунд.")}</p>
        <div className="mb-4 rounded-lg border border-[#35383a] bg-[#0c0f11] p-3">
          <div className="mb-2 flex justify-between text-xs"><span className="text-[#918c82]">{localize("Запас")}</span><strong className="font-mono text-[#d1ad67]">{localize(currentEnergy)} / {localize(maxEnergy)}</strong></div>
          <div className="progress-track h-2"><div className="progress-fill is-energy" style={{ width: `${energyPct}%` }} /></div>
        </div>
        <div className="space-y-2">
          <RpgButton variant="secondary" icon="skill" className="w-full justify-between" disabled={meditationDisabled} onClick={() => { meditateOrRefillEnergy('meditate'); setShowEnergyModal(false); }}>
            <span>{localize("Медитация · бесплатно")}</span><span className="font-mono text-[11px] text-[#d1ad67]">{localize(meditationWait > 0 ? `Через ${Math.ceil(meditationWait / 60000)} мин` : currentEnergy >= maxEnergy ? 'Запас полон' : '+10 · раз в 30 мин')}</span>
          </RpgButton>
          <RpgButton variant="secondary" icon="potion" className="w-full justify-between" disabled={premium.loading || (player.silver ?? 0) < elixirPrice || currentEnergy >= maxEnergy} onClick={() => { meditateOrRefillEnergy('silver'); setShowEnergyModal(false); }}>
            <span>{localize("Эликсир бодрости")}</span><span className="font-mono text-[11px] text-[#d8d1c4]">+30 · {localize(elixirPrice)}{localize(" серебра")}</span>
          </RpgButton>
        </div>
        {premium.active && <p className="mt-3 text-center text-[11px] text-[#918c82]">{localize("Скидка Premium учтена в цене эликсира.")}</p>}
        <button className="rpg-button rpg-button-secondary mt-3 w-full" onClick={() => setShowEnergyModal(false)}>{localize("Закрыть")}</button>
    </DialogFrame>
  </>;
};
