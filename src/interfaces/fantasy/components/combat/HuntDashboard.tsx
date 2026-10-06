import { RegionCompletionReward } from '../../../../components/combat/RegionCompletionReward';
import { localizeBestiary as localize } from '../../i18n/bestiary';
import { useLocale, intlLocale } from '../../../../i18n/locale';
import React from 'react';
import { Portrait } from '../ui/Portrait';
import { ItemArtwork } from '../ui/ItemArtwork';
import type { AutoBattleSettings, Monster, PlayerCharacter, RegionModifier } from '../../../../types/game';
import type { RegionDefinition } from '../../data/gameData';
import type { RegionProgress } from '../../../../utils/regionalProgress';
import { getBattleBackground, getBattleScene } from '../../../../components/combat/BattleBackdrop';
import { DialogFrame, RpgButton, RpgIconButton } from '../ui/BestiaryUI';
import { RpgIcon, type RpgIconKind } from '../ui/RpgIcon';
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

const BOOK_SURFACE = '/assets/sprites/generated/ui/bestiary-reference/book-page-with-spine.png';
const WOLF_SEAL = '/assets/sprites/generated/ui/bestiary-reference/wolf-seal.png';
const LOCATION_TILE_FRAME = '/assets/sprites/generated/ui/bestiary-reference/location-tile-frame.png';
const MONSTER_PAGE_TILE = '/assets/sprites/generated/ui/bestiary-reference/monster-page-tile.png?v=2';
const UNKNOWN_MONSTER_ART = '/assets/sprites/generated/ui/monster-dossier/unknown_monster_silhouette_landscape.png';
const AUTO_BATTLE_FRAME = '/assets/sprites/generated/ui/monster-dossier/monster_art_frame_large.png';
const AUTO_BATTLE_DIVIDER = '/assets/sprites/generated/ui/monster-dossier/header_divider_ornament.png';
const AUTO_BATTLE_SKILL_ICON = '/assets/sprites/generated/ui/icons/skill.webp';
const AUTO_BATTLE_POTION_ICON = '/assets/sprites/generated/ui/icons/potion.webp';
const PLAINS_MONSTER_PANELS: Record<string, string> = {
  m_wolf: '/assets/sprites/generated/ui/bestiary-reference/monster-panels/wolf-plains.webp',
  m_goblin: '/assets/sprites/generated/ui/bestiary-reference/monster-panels/goblin-plains.webp',
  m_boar: '/assets/sprites/generated/ui/bestiary-reference/monster-panels/boar-plains.webp',
  m_bandit: '/assets/sprites/generated/ui/bestiary-reference/monster-panels/bandit-plains.webp'
};
const damageTypeLabel = (type?: Monster['damageType']) => ({
  physical: 'Физический урон', magic: 'Магический урон', fire: 'Огонь', ice: 'Лёд',
  lightning: 'Молния', poison: 'Яд', dark: 'Тьма', holy: 'Свет', true: 'Чистый урон'
})[type || 'physical'];

const DossierStat: React.FC<{ icon: RpgIconKind; label: string; value: React.ReactNode; hidden?: boolean }> = ({ icon, label, value, hidden = false }) =>
  <div className="dossier-stat-row">
    <RpgIcon kind={icon} size={18} />
    <span>{localize(label)}</span>
    <strong>{hidden ? '—' : localize(value)}</strong>
  </div>;

export const HuntDashboard: React.FC<HuntDashboardProps> = ({
  player, currentRegion, regionMonsters, selectedMonster, selectedLock, progress, energyError, combatEnergyCost,
  autoBattle, isSettingsOpen, premiumActive, elixirPrice, getMonsterLock, onSelectMonster, onStartHunt, onToggleSettings,
  onUpdateAutoBattle, onMeditate, onBuyElixir, onLeaveMine
}) => {
  useLocale();
  const [isDossierOpen, setIsDossierOpen] = React.useState(false);
  const [bestiaryFilter, setBestiaryFilter] = React.useState<'all' | 'known' | 'unknown'>('all');
  const scene = getBattleScene(currentRegion.id, currentRegion.id);
  const loot = selectedMonster?.drops || [];
  const needsLevel = player.level < currentRegion.minLevel;
  const isMiningLocked = Boolean(player.miningExpedition && !premiumActive);
  const insufficientEnergy = (player.energy ?? 0) < combatEnergyCost;
  const canStart = !insufficientEnergy && Boolean(selectedMonster) && !selectedLock && !needsLevel && !isMiningLocked;
  const energyMessage = energyError || (insufficientEnergy ? localize("Недостаточно энергии для охоты.") : null);
  const energyNotice = energyMessage && <div role="status" aria-live="polite" className="hunt-energy-notice">
    <p>{localize(energyMessage)}</p>
    <div>
      <button type="button" onClick={onMeditate}>{localize("Медитация +10")}</button>
      <button type="button" disabled={player.silver < elixirPrice || player.energy >= player.maxEnergy} onClick={onBuyElixir}>{localize("Эликсир +30 · ")}{localize(elixirPrice)}{localize(" серебра")}</button>
    </div>
  </div>;
  const selectedMonsterUnknown = Boolean(selectedMonster && getMonsterLock(selectedMonster));
  const knownCount = regionMonsters.filter(monster => !getMonsterLock(monster)).length;
  const unknownCount = regionMonsters.length - knownCount;
  const filteredMonsters = regionMonsters.filter(monster => {
    const locked = Boolean(getMonsterLock(monster));
    return bestiaryFilter === 'all' || (bestiaryFilter === 'known' ? !locked : locked);
  });

  React.useEffect(() => {
    if (!isDossierOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDossierOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isDossierOpen]);

  if (isDossierOpen && selectedMonster) {
    return <div key={selectedMonster.id} className="bestiary-dossier-screen" role="dialog" aria-modal="true" aria-labelledby="bestiary-dossier-title">
      <header className="dossier-header">
        <button type="button" onClick={() => setIsDossierOpen(false)} className="dossier-back"><span aria-hidden="true">‹</span>{localize("Назад")}</button>
        <h1>{localize("Досье охотника")}</h1>
        <span className="dossier-level">{localize(selectedMonsterUnknown ? 'Ур. ???' : 'Ур. ' + selectedMonster.level)}</span>
      </header>
      <main className="dossier-scroll">
        <article className="dossier-page">
          <img src={BOOK_SURFACE} alt="" aria-hidden="true" className="dossier-page-surface" />
          <figure className={'dossier-hero-art' + (selectedMonsterUnknown ? ' is-unknown' : '')}>
            {selectedMonsterUnknown
              ? <img src={UNKNOWN_MONSTER_ART} alt="" aria-hidden="true" className="dossier-region-art" />
              : <>
                <div aria-hidden="true" className="dossier-art-backdrop">
                  <img src={getBattleBackground(scene)} alt="" className="dossier-region-art" />
                </div>
                <Portrait src={getMonsterArtworkPath(selectedMonster.id, selectedMonster.avatar)} alt={localize(selectedMonster.name)} className="dossier-monster-portrait" />
              </>}
          </figure>
          {!selectedMonsterUnknown && <div className="dossier-damage-type"><RpgIcon kind={selectedMonster.damageType === 'physical' ? 'attack' : 'skill'} size={17} />{localize(damageTypeLabel(selectedMonster.damageType))}</div>}
          <h2 id="bestiary-dossier-title" className="dossier-monster-name">{localize(selectedMonsterUnknown ? 'Неизвестное существо' : selectedMonster.name)}</h2>
          <div className="dossier-meta">
            <div><span>{localize("Среда обитания")}</span><strong>{localize(selectedMonsterUnknown ? '???' : currentRegion.name)}</strong></div>
            <div><span>{localize("Угроза")}</span><strong>{localize(selectedMonsterUnknown ? '???' : selectedMonster.isBoss ? 'Босс' : selectedMonster.isElite ? 'Элита' : 'Обычный противник')}</strong></div>
          </div>
          <section className="dossier-section">
            <h3>{localize("Характеристики")}</h3>
            <div className="dossier-stats-grid">
              <DossierStat icon="hp" label="Здоровье" value={selectedMonster.maxHp.toLocaleString(intlLocale())} hidden={selectedMonsterUnknown} />
              <DossierStat icon="attack" label="Атака" value={selectedMonster.attack.toLocaleString(intlLocale())} hidden={selectedMonsterUnknown} />
              <DossierStat icon="defend" label="Защита" value={selectedMonster.defense.toLocaleString(intlLocale())} hidden={selectedMonsterUnknown} />
              <DossierStat icon="skill" label="Маг. защита" value={selectedMonster.magicDefense.toLocaleString(intlLocale())} hidden={selectedMonsterUnknown} />
            </div>
          </section>
          {selectedMonsterUnknown
            ? <p className="dossier-unknown-copy">{localize("Это существо ещё не открыто. Продолжайте охоту, чтобы узнать больше.")}</p>
            : <>
              <section className="dossier-section">
                <h3>{localize("Черты и поведение")}</h3>
                <div className="dossier-traits-grid">
                  <div><RpgIcon kind="skill" size={17} /><span>{localize("Скорость")}</span><strong>{localize(selectedMonster.speed)}</strong></div>
                  <div><RpgIcon kind="skill" size={17} /><span>{localize("Уклонение")}</span><strong>{localize(selectedMonster.evasion)}%</strong></div>
                  <div><RpgIcon kind="attack" size={17} /><span>{localize("Шанс крит. удара")}</span><strong>{localize(selectedMonster.critChance)}%</strong></div>
                  {Object.entries(selectedMonster.resistances || {}).filter(([, value]) => typeof value === 'number' && value > 0).map(([type, value]) => <div key={type}><RpgIcon kind="defend" size={17} /><span>{localize("Сопротивление")}{type ? ' · ' + localize(damageTypeLabel(type as Monster['damageType'])) : ''}</span><strong>{localize(value)}%</strong></div>)}
                  {selectedMonster.skills?.map(skill => <div className="dossier-trait-note" key={skill.id}><RpgIcon kind="skill" size={17} /><span><strong>{localize(skill.name)}</strong>{skill.description ? ' · ' + localize(skill.description) : ''}</span></div>)}
                </div>
              </section>
              <section className="dossier-section">
                <h3>{localize("Добыча")}</h3>
                <div className="dossier-loot-grid">
                  {loot.length ? loot.map((drop, index) => <div key={selectedMonster.id + '-' + drop.itemName + '-' + index} className="dossier-loot-entry">
                    <ItemArtwork item={{ name: drop.itemName, type: drop.type, rarity: drop.rarity, icon: '' }} size={34} />
                    <span><strong>{localize(drop.itemName)}</strong><small>{localize(drop.minQty === drop.maxQty ? drop.minQty : drop.minQty + '–' + drop.maxQty)}{localize(" шт. · базовый шанс ")}{localize(Math.round(drop.chance * 100))}%</small></span>
                  </div>) : <span className="dossier-empty-loot">{localize("Добычи пока нет")}</span>}
                </div>
              </section>
            </>}
        </article>
      </main>
      <footer className="dossier-footer">
        {energyNotice}
        {selectedMonsterUnknown && <p role="status">{localize(getMonsterLock(selectedMonster) || selectedLock || '')}</p>}
        {!selectedMonsterUnknown && selectedLock && <p role="status">{localize(selectedLock)}</p>}
        {needsLevel && <p role="status">{localize("Для этой области нужен уровень ")}{localize(currentRegion.minLevel)}.</p>}
        {isMiningLocked && <p role="status">{localize("Герой на шахтной экспедиции")}</p>}
        <RpgButton variant="primary" icon="hunt" disabled={!canStart} onClick={onStartHunt} className="dossier-hunt-button">
          {localize("Начать охоту")}<small className="dossier-energy-cost"><RpgIcon kind="energy" size={14} />{localize(combatEnergyCost)}{localize(" энергии")}</small>
        </RpgButton>
      </footer>
    </div>;
  }

  return <div className="hunt-codex">
    <img src={BOOK_SURFACE} alt="" aria-hidden="true" className="hunt-book-surface" />
    <div className="hunt-book-content">
      <header className="bestiary-book-heading">
        <div className="bestiary-heading-title">
          <img src={WOLF_SEAL} alt="" aria-hidden="true" className="bestiary-wolf-seal" />
          <div className="bestiary-title-copy">
            <h1>{localize("Бестиарий")}</h1>
            <span>{localize("Обитатели локации")}</span>
            <i aria-hidden="true" />
          </div>
        </div>
        <div className="bestiary-region-card">
          <span className="bestiary-region-photo-window" aria-hidden="true">
            <img src={getBattleBackground(scene)} alt="" className="bestiary-region-scene" />
          </span>
          <img src={LOCATION_TILE_FRAME} alt="" aria-hidden="true" className="bestiary-region-frame" />
          <div>
            <strong>{localize(currentRegion.name.split(':')[0])}</strong>
            <span>{localize(currentRegion.levelRange)}</span>
          </div>
        </div>
      </header>

      <div className="bestiary-intro">
        <RpgIconButton icon="settings" label="Настройки автобоя" onClick={onToggleSettings} className="bestiary-settings-button" />
      </div>

      {isMiningLocked && <div className="hunt-notice">
        <span>{localize("Герой на шахтной экспедиции")}</span>
        <button type="button" onClick={onLeaveMine}>{localize("Вернуться")}</button>
      </div>}
      {energyNotice}

      <div role="tablist" aria-label={localize("Фильтр бестиария")} className="bestiary-filter-tabs">
        <button type="button" role="tab" aria-selected={bestiaryFilter === 'all'} onClick={() => setBestiaryFilter('all')} className={bestiaryFilter === 'all' ? 'is-active' : ''}>
          <RpgIcon kind="bestiary" size={20} /><span>{localize("Все")} <small>({localize(regionMonsters.length)})</small></span>
        </button>
        <button type="button" role="tab" aria-selected={bestiaryFilter === 'known'} onClick={() => setBestiaryFilter('known')} className={bestiaryFilter === 'known' ? 'is-active' : ''}>
          <RpgIcon kind="monster" size={20} /><span>{localize("Известные")} <small>({localize(knownCount)})</small></span>
        </button>
        <button type="button" role="tab" aria-selected={bestiaryFilter === 'unknown'} onClick={() => setBestiaryFilter('unknown')} className={bestiaryFilter === 'unknown' ? 'is-active' : ''}>
          <span aria-hidden="true" className="bestiary-question-mark">?</span><span>{localize("Неизвестные")} <small>({localize(unknownCount)})</small></span>
        </button>
      </div>

      <div className="bestiary-record-grid">
        {filteredMonsters.map(monster => {
          const locked = Boolean(getMonsterLock(monster));
          const title = locked ? localize('Неизвестное существо') : localize(monster.name);
          const recordTitle = !locked && monster.name === 'Разбойник с большой дороги'
            ? localize('Разбойник')
            : title;
          const plainsPanel = scene === 'plains' ? PLAINS_MONSTER_PANELS[monster.id] : undefined;
          const detailRows: Array<{ icon: RpgIconKind; label: string; value: string }> = locked ? [] : [
            { icon: 'monster', label: 'Ранг', value: monster.isBoss ? 'Босс' : monster.isElite ? 'Элита' : 'Обычный' },
            { icon: 'map', label: 'Среда обитания', value: currentRegion.name.split(':')[0] },
            { icon: 'inventory', label: 'Добыча', value: monster.drops?.[0]?.itemName || '—' },
            { icon: 'attack', label: 'Атака', value: damageTypeLabel(monster.damageType) }
          ];
          return <button type="button" key={monster.id} aria-label={title} aria-pressed={monster.id === selectedMonster?.id} onClick={() => { onSelectMonster(monster.id); setIsDossierOpen(true); }} className={'bestiary-record' + (locked ? ' is-locked' : '') + (monster.id === selectedMonster?.id ? ' is-selected' : '')}>
            <img src={MONSTER_PAGE_TILE} alt="" aria-hidden="true" className="bestiary-record-page" />
            <span className="bestiary-record-art">
              {locked
                ? <img src={UNKNOWN_MONSTER_ART} alt="" aria-hidden="true" className="bestiary-unknown-art" />
                : plainsPanel
                  ? <img src={plainsPanel} alt="" aria-hidden="true" className="bestiary-record-panel" />
                : <>
                  <img src={getBattleBackground(scene)} alt="" aria-hidden="true" className="bestiary-record-landscape" />
                  <Portrait src={getMonsterArtworkPath(monster.id, monster.avatar)} alt="" className="bestiary-record-creature" />
                </>}
              <span className="bestiary-record-stamp" aria-hidden="true">
                {locked ? '?' : <span className="bestiary-record-paw" />}
              </span>
            </span>
            <span className="bestiary-record-title">
              <strong className={recordTitle.length > 21 ? 'is-long' : undefined}>{recordTitle}</strong>
              <small>{localize(locked ? 'Ур. ???' : 'Ур. ' + monster.level)}</small>
              {detailRows.length > 0 && <span className="bestiary-record-details">
                {detailRows.map(row => <span key={row.label} className="bestiary-record-detail">
                  <RpgIcon kind={row.icon} size={14} />
                  <span className="bestiary-record-detail-copy"><strong>{localize(row.label)}:</strong>{' '}<span>{localize(row.value)}</span></span>
                </span>)}
              </span>}
            </span>
          </button>;
        })}
        {!filteredMonsters.length && <p role="status" className="bestiary-empty-state">{localize("В этой категории пока нет записей.")}</p>}
      </div>

      <RegionCompletionReward region={currentRegion} />
      <section className="bestiary-field-progress" aria-label={localize("Исследование местности")}>
        <span>{localize("Полевые заметки")}</span>
        <div><small>{localize("Следы")} {localize(Math.min(6, progress.kills))}/6</small><i><b style={{ width: Math.min(100, progress.kills / 6 * 100) + '%' }} /></i></div>
        <div><small>{localize("Элиты")} {localize(Math.min(2, progress.eliteWins))}/2</small><i><b style={{ width: Math.min(100, progress.eliteWins / 2 * 100) + '%' }} /></i></div>
        <div><small>{localize("Босс")} {localize(progress.bossWins ? 'Готово' : '0/1')}</small><i><b style={{ width: (progress.bossWins ? 100 : 0) + '%' }} /></i></div>
      </section>

      <DialogFrame open={isSettingsOpen} title={localize("Настройки автобоя")} onClose={onToggleSettings} className="auto-battle-settings-dialog">
        <img src={AUTO_BATTLE_FRAME} alt="" aria-hidden="true" className="auto-battle-settings-frame" />
        <img src={AUTO_BATTLE_DIVIDER} alt="" aria-hidden="true" className="auto-battle-settings-divider" />
        <label className="auto-battle-setting-toggle"><span className="auto-battle-setting-copy"><img src={AUTO_BATTLE_SKILL_ICON} alt="" aria-hidden="true" /><span>{localize("Использовать навыки")}</span></span><input type="checkbox" checked={autoBattle.useSkills} onChange={event => onUpdateAutoBattle({ useSkills: event.target.checked })} /></label>
        <label className="auto-battle-setting-threshold"><span className="auto-battle-setting-copy"><img src={AUTO_BATTLE_POTION_ICON} alt="" aria-hidden="true" /><span>{localize("Автозелье при HP ниже")}</span></span><strong>{localize(autoBattle.healAtHpPercent)}%</strong></label>
        <input type="range" min="20" max="70" value={autoBattle.healAtHpPercent} onChange={event => onUpdateAutoBattle({ healAtHpPercent: Number(event.target.value) })} aria-label={localize("Порог автозелья по здоровью")} className="auto-battle-setting-range" />
      </DialogFrame>
    </div>
  </div>;
};
