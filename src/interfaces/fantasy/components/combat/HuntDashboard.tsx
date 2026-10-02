import React from 'react';
import type { AutoBattleSettings, Monster, PlayerCharacter, RegionModifier } from '../../../../types/game';
import type { RegionDefinition } from '../../data/gameData';
import type { RegionProgress } from '../../../../utils/regionalProgress';
import { BattleBackdrop, getBattleScene } from '../../../../components/combat/BattleBackdrop';
import { BestiaryEntry, BestiaryPanel, FolioPage, OrnamentDivider, RpgButton, RpgIconButton, SectionTitle, StatRow } from '../ui/BestiaryUI';
import { RpgIcon } from '../ui/RpgIcon';
import { getMonsterArtworkPath } from '../../utils/monsterArtwork';

interface HuntDashboardProps {
  player: PlayerCharacter;
  currentRegion: RegionDefinition;
  regionMonsters: Monster[];
  selectedMonster?: Monster;
  activeMod: RegionModifier;
  selectedLock: string | null;
  progress: RegionProgress;
  energyError: string | null;
  combatEnergyCost: number;
  autoBattle: AutoBattleSettings;
  isSettingsOpen: boolean;
  premiumActive: boolean;
  elixirPrice: number;
  getMonsterLock: (monster: Monster) => string | null;
  onSelectMonster: (monsterId: string) => void;
  onStartHunt: () => void;
  onToggleSettings: () => void;
  onUpdateAutoBattle: (settings: Partial<AutoBattleSettings>) => void;
  onMeditate: () => void;
  onBuyElixir: () => void;
  onLeaveMine: () => void;
}

const damageTypeLabel = (type?: Monster['damageType']) => type === 'magic' ? 'Магический урон' : type === 'physical' ? 'Физический урон' : type ? `Урон: ${type}` : 'Тип урона неизвестен';

export const HuntDashboard: React.FC<HuntDashboardProps> = ({
  player, currentRegion, regionMonsters, selectedMonster, activeMod, selectedLock, progress, energyError, combatEnergyCost,
  autoBattle, isSettingsOpen, premiumActive, elixirPrice, getMonsterLock, onSelectMonster, onStartHunt, onToggleSettings,
  onUpdateAutoBattle, onMeditate, onBuyElixir, onLeaveMine
}) => {
  const scene = getBattleScene(currentRegion.id, currentRegion.id);
  const loot = selectedMonster?.drops.filter(drop => drop.type === 'material').slice(0, 2) || [];
  const needsLevel = player.level < currentRegion.minLevel;
  const isMiningLocked = Boolean(player.miningExpedition && !premiumActive);
  const canStart = Boolean(selectedMonster) && !selectedLock && !needsLevel && !isMiningLocked;

  return <FolioPage className="space-y-3 pt-3">
    <BestiaryPanel className="relative isolate min-h-[150px] overflow-hidden">
      <div className="absolute inset-0 -z-10"><BattleBackdrop scene={scene} /><div className="absolute inset-0 bg-gradient-to-r from-[#090b0de8] via-[#090b0d91] to-[#090b0d3b]" /></div>
      <div className="relative flex min-h-[150px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#c4b79e]">Охотничьи угодья</div>
          <span className="rounded border border-[#756344] bg-black/45 px-2 py-1 text-[11px] font-mono text-[#d2c5af]">{currentRegion.levelRange}</span>
        </div>
        <div>
          <h1 className="folio-title text-xl font-bold leading-tight">{currentRegion.name.split(':')[0]}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded border border-[#635237] bg-black/55 px-2 py-1 text-[11px] font-semibold text-[#d1ad67]">{activeMod.name}</span>
            <span className="text-[11px] text-[#c2bdb3]">Ур. {player.level} · {regionMonsters.length} следов</span>
          </div>
        </div>
      </div>
    </BestiaryPanel>

    <RpgButton variant="primary" icon="hunt" disabled={!canStart} onClick={onStartHunt} className="w-full text-sm uppercase tracking-[.08em]">
      Начать охоту <span className="font-mono text-[11px] font-semibold">· {combatEnergyCost} энергии</span>
    </RpgButton>
    {selectedLock && <p className="px-1 text-center text-[11px] text-[#d1ad67]">{selectedLock}</p>}
    {needsLevel && <p className="px-1 text-center text-[11px] text-[#d1ad67]">Для этой области нужен уровень {currentRegion.minLevel}.</p>}

    <BestiaryPanel className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <SectionTitle eyebrow="Каталог существ">Бестиарий</SectionTitle>
        <RpgIconButton icon="settings" label="Настройки автобоя" onClick={onToggleSettings} />
      </div>
      <div className="bestiary-list mt-2 max-h-[292px] space-y-1.5 overflow-y-auto pr-1">
        {regionMonsters.map(monster => {
          const locked = Boolean(getMonsterLock(monster));
          const marker = monster.isBoss ? 'Босс' : monster.isElite ? 'Элита' : undefined;
          return <BestiaryEntry key={monster.id} title={monster.name} subtitle={`Ур. ${monster.level}`} image={getMonsterArtworkPath(monster.id, monster.avatar)} selected={monster.id === selectedMonster?.id} locked={locked} marker={marker} onClick={() => onSelectMonster(monster.id)} />;
        })}
      </div>
      <OrnamentDivider />
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div><div className="mb-1 flex justify-between text-[#aaa49a]"><span>Следы</span><span>{Math.min(6, progress.kills)}/6</span></div><div className="progress-track h-1.5"><div className="progress-fill is-energy" style={{ width: `${Math.min(100, progress.kills / 6 * 100)}%` }} /></div></div>
        <div><div className="mb-1 flex justify-between text-[#aaa49a]"><span>Элиты</span><span>{Math.min(2, progress.eliteWins)}/2</span></div><div className="progress-track h-1.5"><div className="progress-fill is-energy" style={{ width: `${Math.min(100, progress.eliteWins / 2 * 100)}%` }} /></div></div>
        <div><div className="mb-1 flex justify-between text-[#aaa49a]"><span>Босс</span><span>{progress.bossWins ? 'Готово' : '0/1'}</span></div><div className="progress-track h-1.5"><div className="progress-fill is-energy" style={{ width: `${progress.bossWins ? 100 : 0}%` }} /></div></div>
      </div>
    </BestiaryPanel>

    {selectedMonster && <BestiaryPanel className="bestiary-dossier overflow-hidden">
      <div className="bestiary-dossier-art relative min-h-[248px] overflow-hidden">
        <div className="absolute inset-0 bg-[#111615]"><BattleBackdrop scene={scene} /></div>
        <img src={getMonsterArtworkPath(selectedMonster.id, selectedMonster.avatar)} alt={selectedMonster.name} className="absolute inset-0 h-full w-full object-contain object-center" referrerPolicy="no-referrer" />
        <div className="bestiary-dossier-art-shade absolute inset-0" />
        <div className="relative flex min-h-[248px] flex-col justify-between p-3.5">
          <div className="flex items-start justify-between gap-2">
            <span className="bestiary-art-stamp"><RpgIcon kind="bestiary" size={16} /> Досье охотника</span>
            <span className="rounded border border-[#c1a775]/50 bg-black/60 px-2 py-1 text-[11px] font-mono text-[#e7d7b8]">Ур. {selectedMonster.level}</span>
          </div>
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {selectedMonster.isBoss && <span className="rounded border border-[#824b47] bg-[#35191a]/90 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#e3aba2]">Босс</span>}
              {selectedMonster.isElite && <span className="rounded border border-[#8a7145] bg-[#302719]/90 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#e3c17b]">Элита</span>}
              <span className="text-[11px] uppercase tracking-[.12em] text-[#ded2bd]">{damageTypeLabel(selectedMonster.damageType)}</span>
            </div>
            <h2 className="folio-title break-words text-2xl font-bold leading-tight text-white">{selectedMonster.name}</h2>
          </div>
        </div>
      </div>
      <div className="bestiary-dossier-paper px-4 py-3.5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-0.5">
          <StatRow label="Здоровье" value={selectedMonster.maxHp.toLocaleString()} tone="hp" />
          <StatRow label="Атака" value={selectedMonster.attack.toLocaleString()} />
        </div>
        <div className="mt-3 border-t border-[#75634a]/35 pt-2.5">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#65553e]">Находки</div>
          <div className="flex min-h-5 flex-wrap gap-x-3 gap-y-1 text-xs text-[#332b23]">
            {loot.length ? loot.map(drop => <span key={`${selectedMonster.id}-${drop.itemName}`}>{drop.itemName}</span>) : <span className="text-[#766958]">Следов добычи пока нет</span>}
          </div>
        </div>
      </div>
    </BestiaryPanel>}

    {isMiningLocked && <BestiaryPanel className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 text-xs text-[#d1ad67]"><RpgIcon kind="mine" size={19} /><span>Герой на шахтной экспедиции</span></div>
      <button onClick={onLeaveMine} className="rpg-button rpg-button-secondary shrink-0 px-3 text-xs">Вернуться</button>
    </BestiaryPanel>}

    {energyError && <div role="status" aria-live="polite" className="bestiary-panel space-y-2 border-[#673b3b] bg-[#211719] p-3">
      <div className="flex items-start gap-2 text-xs text-[#e1b7b3]"><span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#81504d] font-bold">!</span><span>{energyError}</span></div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onMeditate} className="rpg-button rpg-button-secondary min-h-11 px-2 text-[11px]">Медитация +10</button>
        <button onClick={onBuyElixir} disabled={player.silver < elixirPrice || player.energy >= player.maxEnergy} className="rpg-button rpg-button-secondary min-h-11 px-2 text-[11px]">Эликсир +30 · {elixirPrice} серебра</button>
      </div>
    </div>}



    {isSettingsOpen && <BestiaryPanel className="space-y-3 p-3">
      <div className="flex items-center justify-between"><h3 className="section-title text-sm">Настройки автобоя</h3><button onClick={onToggleSettings} className="min-h-11 px-2 text-xs text-[#aaa49a]">Закрыть</button></div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-xs text-[#c5c0b6]"><span>Использовать навыки</span><input type="checkbox" checked={autoBattle.useSkills} onChange={event => onUpdateAutoBattle({ useSkills: event.target.checked })} className="h-5 w-5 accent-[#b99558]" /></label>
      <label className="flex items-center justify-between text-xs text-[#c5c0b6]"><span>Автозелье при HP ниже</span><span className="font-mono text-[#d1ad67]">{autoBattle.healAtHpPercent}%</span></label>
      <input type="range" min="20" max="70" value={autoBattle.healAtHpPercent} onChange={event => onUpdateAutoBattle({ healAtHpPercent: Number(event.target.value) })} aria-label="Порог автозелья по здоровью" className="w-full accent-[#b99558]" />
    </BestiaryPanel>}
  </FolioPage>;
};
