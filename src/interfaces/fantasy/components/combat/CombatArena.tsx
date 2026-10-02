import React from 'react';
import type { BattleLogEntry, Monster, PlayerCharacter, StatusEffect } from '../../../../types/game';
import type { BattleScene } from '../../../../components/combat/BattleBackdrop';
import { BattleBackdrop } from '../../../../components/combat/BattleBackdrop';
import { BestiaryPanel, ProgressBar } from '../ui/BestiaryUI';
import { RpgIcon } from '../ui/RpgIcon';

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
}

const imageAvatar = (avatar: string) => avatar.startsWith('/') || avatar.startsWith('http') || avatar.includes('.');

export const CombatArena: React.FC<CombatArenaProps> = ({
  player, monster, heroImage, heroClassName, locationName, modifierName, scene, dungeonId, round, turnPhase,
  playerHp, playerMp, maxHp, maxMp, playerEffects, monsterEffects, latestEvent
}) => {
  const feedback = latestEvent?.type === 'crit' ? 'CRITICAL'
    : latestEvent?.type === 'heal' ? 'RECOVERY'
    : latestEvent?.type === 'death' ? 'DEFEATED'
    : latestEvent?.type === 'monster-attack' ? 'INCOMING'
    : latestEvent?.type === 'flee' ? 'ESCAPED'
    : latestEvent?.type === 'player-attack' ? 'HIT'
    : undefined;
  const damageValue = latestEvent?.text.match(/[+-]\d[\d.,]*/)?.[0];
  const hpPercent = maxHp ? Math.max(0, Math.min(100, playerHp / maxHp * 100)) : 0;
  const monsterHpPercent = monster.maxHp ? Math.max(0, Math.min(100, monster.hp / monster.maxHp * 100)) : 0;

  return <>
    <section className="relative isolate flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-[#45423a] bg-[#090b0d] p-3 sm:min-h-[300px]">
      <div className="absolute inset-0 -z-20"><BattleBackdrop scene={scene} dungeonId={dungeonId} /></div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#090b0da8] via-[#090b0d12] to-[#090b0de8]" />
      <div className="relative z-10 flex items-center justify-between gap-2 border-b border-white/10 pb-2 text-[11px]">
        <span className="truncate font-semibold text-[#d7cbb4]">{locationName}</span>
        <div className="flex shrink-0 items-center gap-2"><span className="text-[#aaa49a]">{modifierName}</span><span className="text-[#c7a365]">Раунд {round}</span></div>
      </div>

      <div className="pointer-events-none absolute right-0 top-9 z-0 h-[155px] w-[58%] overflow-hidden sm:h-[205px]">
        {imageAvatar(monster.avatar)
          ? <img src={monster.avatar} alt="" className="h-full w-full object-cover object-center [mask-image:linear-gradient(to_right,transparent,black_32%)]" referrerPolicy="no-referrer" />
          : <div className="grid h-full place-items-center [mask-image:linear-gradient(to_right,transparent,black_32%)]"><RpgIcon kind="monster" size={100} className="text-[#95805c]" /></div>}
      </div>

      <div className="relative z-10 mt-auto max-w-[82%] pb-1 sm:max-w-[72%]">
        <div className="mb-1 flex items-center gap-2">
          {monster.isBoss && <span className="rounded border border-[#824b47] bg-[#321b1b]/85 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#e0aaa3]">Босс</span>}
          {monster.isElite && <span className="rounded border border-[#695637] bg-[#2c251a]/85 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#d1ad67]">Элита</span>}
          <span className="text-[11px] uppercase tracking-[.12em] text-[#c2b9a8]">{monster.regionId === 'ascension' ? `Ранг ${monster.id.replace('ascension_', '')}` : `Ур. ${monster.level}`}</span>
        </div>
        <h1 className="folio-title break-words text-xl font-bold leading-tight sm:text-2xl">{monster.name}</h1>
        <ProgressBar value={monster.hp} max={monster.maxHp} tone="hp" label="Здоровье противника" className="mt-3 max-w-sm" />
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[#d0c8b9]">
          <span className="inline-flex items-center gap-1"><RpgIcon kind="attack" size={14} className="text-[#bd8d6e]" />{monster.attack}</span>
          <span className="inline-flex items-center gap-1"><RpgIcon kind="defend" size={14} className="text-[#a8a69d]" />{monster.defense}</span>
          {monsterEffects.length > 0 && <span className="truncate text-[#b9a4cb]">{monsterEffects.map(effect => `${effect.name}${effect.stacks ? ` ×${effect.stacks}` : ''}`).join(' · ')}</span>}
        </div>
      </div>

      <div className={`absolute left-1/2 top-[45%] z-20 -translate-x-1/2 -translate-y-1/2 text-center ${turnPhase === 'monster' ? 'text-[#e1aaa5]' : 'text-[#d9c58e]'}`} aria-live="polite">
        {feedback && <div key={latestEvent?.id} className="combat-feedback-pop rounded-md border border-white/15 bg-black/70 px-2 py-1 text-[11px] font-bold tracking-[.15em] shadow-xl">{damageValue && <span className="mr-1 text-sm">{damageValue}</span>}{feedback}</div>}
      </div>
    </section>

    <BestiaryPanel className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2 p-2">
      <div className={`relative h-[42px] w-[32px] overflow-hidden rounded-md border bg-[#0d1012] ${turnPhase === 'player' ? 'border-[#a98951]' : 'border-[#3b3d3d]'}`}>
        <img src={heroImage} alt="" className="h-full w-full object-cover object-top" referrerPolicy="no-referrer" />
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-[#ddd6c9]">{player.name} · {heroClassName}</span><span className="shrink-0 font-mono text-[11px] text-[#bca16d]">Ур. {player.level}</span></div>
        <ProgressBar value={playerHp} max={maxHp} tone="hp" className="mb-1.5" />
        <ProgressBar value={playerMp} max={maxMp} tone="mana" />
        {playerEffects.length > 0 && <div className="mt-1 truncate text-[11px] text-[#9aafb4]" title={playerEffects.map(effect => effect.name).join(', ')}>{playerEffects.map(effect => `${effect.name}${effect.stacks ? ` ×${effect.stacks}` : ''}`).join(' · ')}</div>}
      </div>
    </BestiaryPanel>
  </>;
};
