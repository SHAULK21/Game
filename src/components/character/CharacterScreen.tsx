import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CLASSES, ASSETS } from '../../data/gameData';
import type { CharacterAttributes, ItemType } from '../../types/game';
import { TalentTree } from './TalentTree';
import { HeroStats } from './HeroStats';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, CodexTabs, FolioPage, ItemSlot, OrnamentDivider, ProgressBar, SectionTitle, StatRow } from '../ui/BestiaryUI';

interface CharacterScreenProps {
  onClose?: () => void;
}

type CharacterTab = 'stats' | 'equipment' | 'talents' | 'pet';

const attributes: Array<{ key: keyof CharacterAttributes; label: string; summary: string; icon: 'attack' | 'hunt' | 'skill' | 'defend' | 'gem' | 'hp' }> = [
  { key: 'strength', label: 'Сила', summary: 'Физический урон', icon: 'attack' },
  { key: 'agility', label: 'Ловкость', summary: 'Скорость и уклонение', icon: 'hunt' },
  { key: 'intelligence', label: 'Интеллект', summary: 'Магия и запас маны', icon: 'skill' },
  { key: 'vitality', label: 'Живучесть', summary: 'Здоровье и броня', icon: 'defend' },
  { key: 'luck', label: 'Удача', summary: 'Редкая добыча и крит', icon: 'gem' },
  { key: 'spirit', label: 'Дух', summary: 'Мана и сопротивление', icon: 'skill' },
  { key: 'willpower', label: 'Воля', summary: 'Регенерация и стойкость', icon: 'hp' },
];

const equipmentSlots: Array<{ type: ItemType; label: string }> = [
  { type: 'helmet', label: 'Шлем' }, { type: 'weapon', label: 'Оружие' }, { type: 'offhand', label: 'Вторая рука' },
  { type: 'armor', label: 'Доспех' }, { type: 'gloves', label: 'Перчатки' }, { type: 'ring', label: 'Кольцо' },
  { type: 'pants', label: 'Поножи' }, { type: 'amulet', label: 'Амулет' }, { type: 'belt', label: 'Пояс' },
  { type: 'boots', label: 'Сапоги' }, { type: 'cloak', label: 'Плащ' }, { type: 'artifact', label: 'Артефакт' },
];

export const CharacterScreen: React.FC<CharacterScreenProps> = ({ onClose }) => {
  const { player, combatStats, allocateAttribute, premium } = useGame();
  const [activeTab, setActiveTab] = useState<CharacterTab>('stats');

  if (!player) return null;

  const classDef = CLASSES[player.classId] || CLASSES.warrior;
  const expPct = Math.min(100, Math.round((player.exp / Math.max(1, player.nextExp)) * 100));
  const heroImage = classDef.image || ASSETS.heroHunter;
  const tabs = [
    { id: 'stats', label: 'Характеристики' },
    { id: 'equipment', label: 'Снаряжение' },
    { id: 'talents', label: 'Таланты' },
    { id: 'pet', label: 'Спутник' },
  ];

  return <FolioPage className="space-y-3 pt-3">
    <div className="flex items-center justify-between gap-3 px-1">
      <div><div className="text-[11px] uppercase tracking-[.16em] text-[#918c82]">Лист героя</div><h1 className="section-title text-lg">Кодекс персонажа</h1></div>
      {onClose && <button onClick={onClose} aria-label="Закрыть лист персонажа" className="rpg-icon-button"><span className="text-lg">×</span></button>}
    </div>

    <BestiaryPanel className="relative overflow-hidden">
      <div className="relative grid min-h-[198px] grid-cols-[104px_minmax(0,1fr)] items-end overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,#55462d66,transparent_55%),linear-gradient(140deg,#201c17,#101315_70%)]" />
        <div className="relative z-10 h-[198px] w-[104px] self-end overflow-hidden border-r border-[#514633]">
          <img src={heroImage} alt={classDef.name} className="h-full w-full object-cover object-top" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b0d] via-transparent to-transparent" />
          <span className="absolute bottom-2 left-2 rounded border border-[#665940] bg-black/70 px-1.5 py-0.5 text-[11px] text-[#d8c28d]">Ранг {player.ascension?.rank || 'E'}</span>
        </div>
        <div className="relative z-10 min-w-0 p-3 pb-4">
          <div className="text-[11px] uppercase tracking-[.13em] text-[#b6a47f]">{classDef.role}</div>
          <h2 className="folio-title mt-1 break-words text-xl font-bold leading-tight">{player.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#b5aea2]">
            <span>{classDef.name}</span><span>·</span><span>Уровень {player.level}</span>
            {premium.active && <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#d1ad67]"><RpgIcon kind="crown" size={13} />Premium</span>}
          </div>
          <ProgressBar value={player.exp} max={player.nextExp} tone="energy" label={`До уровня ${player.level + 1}`} className="mt-4" />
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded border border-white/5 bg-black/25 px-1 py-1.5"><strong className="block text-sm text-[#d1ad67]">{player.statPoints}</strong><span className="text-[11px] text-[#918c82]">Атрибуты</span></div>
            <div className="rounded border border-white/5 bg-black/25 px-1 py-1.5"><strong className="block text-sm text-[#ae9ac4]">{player.talentPoints}</strong><span className="text-[11px] text-[#918c82]">Таланты</span></div>
            <div className="rounded border border-white/5 bg-black/25 px-1 py-1.5"><strong className="block text-sm text-[#c8c1b5]">{player.miningLevel}/{player.alchemyLevel}</strong><span className="text-[11px] text-[#918c82]">Профессии</span></div>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3"><details><summary className="flex min-h-11 cursor-pointer items-center gap-2 border-t border-[#343638] pt-2 text-xs text-[#d1ad67]"><RpgIcon kind="character" size={16} />Класс и пассивка · {classDef.passive.name}</summary><p className="pt-2 text-xs text-[#aaa49a]">{classDef.description}</p><p className="pt-2 text-xs text-[#c5b393]">{classDef.passive.description}</p></details></div>
    </BestiaryPanel>

    <CodexTabs tabs={tabs} active={activeTab} onChange={id => setActiveTab(id as CharacterTab)} />

    {activeTab === 'stats' && <div className="space-y-3">
      <BestiaryPanel className="p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><SectionTitle>Основные атрибуты</SectionTitle><span className="text-[11px] font-mono text-[#d1ad67]">Свободно: {player.statPoints}</span></div>
        <OrnamentDivider />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {attributes.map(attribute => <div key={attribute.key} className="flex min-h-[66px] items-center gap-2 rounded-lg border border-[#343638] bg-[#111416] px-2 py-1.5">
            <RpgIcon kind={attribute.icon} size={19} className="text-[#a48b60]" />
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-[#d8d1c4]">{attribute.label}</div><div className="mt-0.5 truncate text-[11px] text-[#918c82]">{attribute.summary}</div></div>
            <strong className="font-mono text-sm text-[#e5ddd0]">{player.attributes[attribute.key]}</strong>
            <button disabled={player.statPoints <= 0} aria-label={`Повысить: ${attribute.label}`} onClick={() => allocateAttribute(attribute.key)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#71603e] bg-[#282218] text-lg font-bold text-[#d1ad67] disabled:opacity-35">+</button>
          </div>)}
        </div>
      </BestiaryPanel>
      <BestiaryPanel className="p-3"><SectionTitle eyebrow="Производные значения">Боевые показатели</SectionTitle><div className="mt-2"><HeroStats stats={combatStats} /></div></BestiaryPanel>
    </div>}

    {activeTab === 'equipment' && <BestiaryPanel className="space-y-3 p-3">
      <SectionTitle eyebrow="Экипировка героя">Снаряжение</SectionTitle>
      <div className="ornament-divider" />
      <div className="grid grid-cols-3 gap-2">
        {equipmentSlots.map(slot => <ItemSlot key={slot.type} label={slot.label} itemName={player.equipped[slot.type]?.name} icon={slot.type} className="min-h-[72px]" />)}
      </div>
      {player.equipped.pickaxe && <ItemSlot label="Шахтная кирка" itemName={player.equipped.pickaxe.name} icon="pickaxe" />}
      {player.equipped.alchemyTool && <ItemSlot label="Алхимический инструмент" itemName={player.equipped.alchemyTool.name} icon="alchemyTool" />}
    </BestiaryPanel>}

    {activeTab === 'talents' && <BestiaryPanel className="p-2"><TalentTree /></BestiaryPanel>}

    {activeTab === 'pet' && <BestiaryPanel className="space-y-3 p-4">
      {player.activePet ? <>
        <div className="flex items-center gap-3"><div className="grid h-16 w-16 place-items-center rounded-lg border border-[#514633] bg-[#101315]"><RpgIcon kind="pet" size={34} className="text-[#a48b60]" /></div><div><div className="text-[11px] uppercase tracking-[.15em] text-[#918c82]">Спутник героя</div><h2 className="folio-title text-lg font-bold">{player.activePet.name}</h2><div className="text-xs text-[#b4aea2]">Уровень {player.activePet.level}</div></div></div>
        <OrnamentDivider />
        <StatRow label="Пассивный эффект" value={player.activePet.passiveBonus} />
        {player.activePet.activeSkillName && <div className="rounded-lg border border-[#343638] bg-[#111416] p-3"><div className="text-xs font-semibold text-[#d1ad67]">{player.activePet.activeSkillName}</div><p className="mt-1 text-xs text-[#aaa49a]">{player.activePet.activeSkillDesc}</p></div>}
      </> : <div className="py-8 text-center"><RpgIcon kind="pet" size={40} className="mx-auto text-[#756344]" /><p className="mt-3 text-xs text-[#918c82]">Пока рядом нет спутника.</p></div>}
    </BestiaryPanel>}
  </FolioPage>;
};
