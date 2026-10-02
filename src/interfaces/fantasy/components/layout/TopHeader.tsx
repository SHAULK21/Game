import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import { InterfaceSwitcher } from '../../../../components/ui/InterfaceSwitcher';
import React, { useState, useEffect } from 'react';
import { useGame } from '../../../../context/GameContext';
import { CLASSES } from '../../data/gameData';
import { RpgIcon } from '../ui/RpgIcon';
import { getEnergyElixirPrice } from '../../../../utils/dungeonRewards';
import { ClassPortraitIcon } from '../ui/ClassPortraitIcon';
import { ResourceBadge, RpgButton, DialogFrame } from '../ui/BestiaryUI';

interface TopHeaderProps {
  onOpenCharacterSheet: () => void;
}

const compactCount = (value: number) => value >= 10000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString(intlLocale());

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
  const expPct = Math.min(100, Math.round((player.exp / Math.max(1, player.nextExp)) * 100));
  const heroClass = CLASSES[player.classId] || CLASSES.warrior;
  const currentEnergy = player.energy ?? 100;
  const maxEnergy = player.maxEnergy ?? 100;
  const energyPct = Math.min(100, Math.round((currentEnergy / Math.max(1, maxEnergy)) * 100));

  return <>
    <header className="game-header sticky top-0 z-30 px-2.5 py-2">
      <div className="header-content mx-auto flex items-center gap-2">
        <button onClick={onOpenCharacterSheet} aria-label={localize("Открыть лист персонажа")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#62543b] bg-[#101315]">
            <ClassPortraitIcon classId={player.classId} className="header-class-portrait" />
            <span className="absolute bottom-0 inset-x-0 bg-black/80 text-center font-mono text-[11px] font-bold leading-4 text-[#e3c983]">{localize(player.level)}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-[#e2ded5]">{player.name}</span>
              {premium.active && <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold uppercase tracking-wide text-[#d1ad67]" title="Premium"><RpgIcon kind="crown" size={12} className="text-[#c7a365]" /> VIP</span>}
              {player.statPoints > 0 && <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#c7a365] text-[11px] font-bold text-black">+</span>}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-[#918c82]">{localize(heroClass.name)}{localize(" · Ур. ")}{localize(player.level)}</span>
            <span className="mt-1 flex items-center gap-1.5">
              <span className="progress-track h-1.5 flex-1"><span className="progress-fill is-energy block" style={{ width: `${expPct}%` }} /></span>
              <span className="w-8 text-right font-mono text-[11px] text-[#c7a365]">{localize(expPct)}%</span>
            </span>
          </span>
        </button>

        <div className="header-resources flex shrink-0 items-center gap-1.5">
          <ResourceBadge kind="gold" value={compactCount(player.gold)} title={localize("Золото")} />
          <ResourceBadge kind="energy" value={`${currentEnergy}/${maxEnergy}`} onClick={() => setShowEnergyModal(true)} title={localize("Энергия. Открыть способы восстановления")} />
        </div>
      </div>
    <InterfaceSwitcher compact />
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
