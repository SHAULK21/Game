import { t as localize, useLocale } from '../../../../i18n/locale';
import React from 'react';
import type { BattleLogEntry, Monster, PlayerCharacter, StatusEffect } from '../../../../types/game';
import type { BattleScene } from '../../../../components/combat/BattleBackdrop';
import { BattleBackdrop } from '../../../../components/combat/BattleBackdrop';
import { BestiaryPanel, ProgressBar } from '../ui/BestiaryUI';
import { Portrait } from '../ui/Portrait';
import { RpgIcon } from '../ui/RpgIcon';
import { getFantasyCombatArtwork } from '../../utils/heroArtwork';
import { getMonsterArtworkPath } from '../../utils/monsterArtwork';
import { CombatCompanion } from '../../../../components/combat/CombatCompanion';

interface CombatArenaProps {
  player: PlayerCharacter;
  monster: Monster;
  heroImage: string;
  heroClassName: string;
  locationName: string;
  modifierName: string;
  scene: BattleScene;
  dungeonId?: string;
  round: number;
  turnPhase: string;
  playerHp: number;
  playerMp: number;
  maxHp: number;
  maxMp: number;
  playerEffects: StatusEffect[];
  monsterEffects: StatusEffect[];
  latestEvent?: BattleLogEntry;
  monsterStriking?: boolean;
  playerAttackId?: string;
}

export const CombatArena: React.FC<CombatArenaProps> = ({
  player, monster, heroImage, heroClassName, locationName, modifierName, scene, dungeonId, round, turnPhase,
  playerHp, playerMp, maxHp, maxMp, playerEffects, monsterEffects, latestEvent, monsterStriking, playerAttackId
}) => {
  useLocale();
  const feedback = latestEvent?.type === 'crit' ? 'Критический удар'
    : latestEvent?.type === 'heal' ? 'Восстановление'
    : latestEvent?.type === 'death' ? 'Поражение'
    : latestEvent?.type === 'monster-attack' ? 'Удар противника'
    : latestEvent?.type === 'flee' ? 'Побег'
    : latestEvent?.type === 'player-attack' ? 'Ваш удар'
    : undefined;
  const damageValue = latestEvent?.text.match(/[+-]\d[\d.,]*/)?.[0];
  const hpPercent = maxHp ? Math.max(0, Math.min(100, playerHp / maxHp * 100)) : 0;
  const monsterHpPercent = monster.maxHp ? Math.max(0, Math.min(100, monster.hp / monster.maxHp * 100)) : 0;
  const monsterArtwork = getMonsterArtworkPath(monster.id, monster.avatar);

  return <>
    <BestiaryPanel className="combat-hero-plaque grid grid-cols-[52px_minmax(0,1fr)] items-center gap-2.5 p-2">
      <div className={`relative h-[58px] w-[52px] overflow-hidden rounded-md border bg-[#0d1012] ${turnPhase === 'player' ? 'border-[#a98951]' : 'border-[#3b3d3d]'}`}>
        <Portrait src={heroImage} alt="" fallback="character" className="h-full w-full object-cover object-top"/>
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[#e1d5c0]">{player.name} · {localize(heroClassName)}</span><span className="shrink-0 font-mono text-[11px] text-[#d2b676]">{localize("Ур. ")}{localize(player.level)}</span></div>
        <span role="status" className={`combat-turn-label mb-1 block text-[11px] font-semibold ${turnPhase === 'monster' ? 'text-[#e3b9b2]' : 'text-[#d5ba89]'}`}>{localize(turnPhase === 'player' ? (monsterStriking ? 'Враг нанёс удар. Ваш ход' : 'Ваш ход — выберите действие') : turnPhase === 'monster' ? 'Ход противника — ожидайте удар' : 'Бой завершён')}</span>
        <ProgressBar value={playerHp} max={maxHp} tone="hp" className="mb-1.5" />
        <ProgressBar value={playerMp} max={maxMp} tone="mana" />
        {playerEffects.length > 0 && <div className="mt-1 truncate text-[11px] text-[#9aafb4]" title={localize(playerEffects.map(effect => localize(effect.name)).join(', '))}>{localize(playerEffects.map(effect => `${localize(effect.name)}${effect.stacks ? ` ×${effect.stacks}` : ''}`).join(' · '))}</div>}
      </div>
    </BestiaryPanel>

    <section className="combat-scene relative isolate flex min-h-[334px] flex-col overflow-hidden rounded-2xl border border-[#756344] bg-[#090b0d] p-3 sm:min-h-[390px]">
      <div className="absolute inset-0 -z-20"><BattleBackdrop scene={scene} dungeonId={dungeonId} /></div>
      <div className="combat-scene-shade absolute inset-0 -z-10" />
      <div className="combat-scene-header relative z-10 flex items-center justify-between gap-2 pb-2 text-[11px]">
        <span className="truncate font-semibold text-[#e0d2b7]">{localize(locationName)}</span>
        <div className="flex shrink-0 items-center gap-2"><span className="truncate text-[#b4aea2]">{localize(modifierName)}</span><span className="combat-round">{localize("Раунд ")}{localize(round)}</span></div>
      </div>

      <div className={`combat-player-art ${monsterStriking ? 'combat-player-hit' : ''}`}>
        <div key={playerAttackId || 'idle'} className={playerAttackId ? 'combat-player-attack' : ''}>
          <div className="combat-player-breathe">
            <Portrait src={getFantasyCombatArtwork(player.classId)} alt={player.name} fallback="character" className="h-full w-full object-contain object-bottom" />
          </div>
        </div>
        <CombatCompanion pet={player.activePet} />
      </div>

      <div className={`combat-monster-art ${monsterStriking ? 'monster-strike-motion' : ''} pointer-events-none absolute right-0 top-9 z-0 flex h-[240px] w-[55%] items-end justify-end overflow-hidden sm:h-[292px] sm:w-[55%]`}>
        <Portrait src={monsterArtwork} alt="" className="h-full w-full object-contain object-right-bottom"/>
      </div>

      <div className={`combat-enemy-plaque relative z-10 mt-auto pb-1 ${['pet_wolf', 'pet_golem'].includes(player.activePet?.id || '') ? 'ml-[25%] max-w-[75%]' : 'max-w-[88%] sm:max-w-[76%]'}`}>
        <div className="mb-1 flex items-center gap-2">
          {monster.isBoss && <span className="rounded border border-[#824b47] bg-[#321b1b]/85 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#e0aaa3]">{localize("Босс")}</span>}
          {monster.isElite && <span className="rounded border border-[#695637] bg-[#2c251a]/85 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#d1ad67]">{localize("Элита")}</span>}
          <span className="text-[11px] uppercase tracking-[.12em] text-[#c2b9a8]">{localize(monster.regionId === 'ascension' ? `Ранг ${monster.id.replace('ascension_', '')}` : `Ур. ${monster.level}`)}</span>
        </div>
        <h1 className="folio-title break-words text-xl font-bold leading-tight sm:text-2xl">{localize(monster.name)}</h1>
        <ProgressBar value={monster.hp} max={monster.maxHp} tone="hp" label="Здоровье противника" className="mt-3 max-w-sm" />
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[#d0c8b9]">
          <span className="inline-flex items-center gap-1"><RpgIcon kind="attack" size={14} className="text-[#bd8d6e]" />{localize(monster.attack)}</span>
          <span className="inline-flex items-center gap-1"><RpgIcon kind="defend" size={14} className="text-[#a8a69d]" />{localize(monster.defense)}</span>
          {monsterEffects.length > 0 && <span className="truncate text-[#b9a4cb]">{localize(monsterEffects.map(effect => `${localize(effect.name)}${effect.stacks ? ` ×${effect.stacks}` : ''}`).join(' · '))}</span>}
        </div>
      </div>

      <div className={`absolute left-1/2 top-[45%] z-20 -translate-x-1/2 -translate-y-1/2 text-center ${turnPhase === 'monster' ? 'text-[#e1aaa5]' : 'text-[#d9c58e]'}`} aria-live="polite">
        {feedback && <div key={latestEvent?.id} className="combat-feedback-pop rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[11px] font-bold tracking-[.15em] shadow-xl">{damageValue && <span className="mr-1 text-sm">{localize(damageValue)}</span>}{localize(feedback)}</div>}
      </div>
    </section>


  </>;
};
