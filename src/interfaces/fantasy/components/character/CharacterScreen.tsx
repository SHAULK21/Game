import { HeroReferenceArt } from '../ui/HeroReferenceArt';
import { t as localize, useLocale } from '../../../../i18n/locale';
import React, { useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { CLASSES, ASSETS } from '../../data/gameData';
import type { CharacterAttributes, ItemType } from '../../../../types/game';
import { TalentTree } from '../../../../components/character/TalentTree';
import { HeroStats } from './HeroStats';
import { useNavigation } from '../../../../context/NavigationContext';
import { ItemArtwork } from '../ui/ItemArtwork';
import { Portrait } from '../ui/Portrait';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, ItemSlot, OrnamentDivider, ProgressBar, SectionTitle, StatRow } from '../ui/BestiaryUI';

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
  useLocale();
  const { player, combatStats, allocateAttribute, premium } = useGame();
  const { setCurrentTab, setIsCharacterSheetOpen } = useNavigation();
  const navigate = (tab: 'inventory' | 'mine' | 'pets') => { setIsCharacterSheetOpen(false); setCurrentTab(tab); };
  const [activeTab, setActiveTab] = useState<CharacterTab>('stats');

  if (!player) return null;

  const classDef = CLASSES[player.classId] || CLASSES.warrior;
  const heroImage = classDef.image || ASSETS.heroHunter;
  const tabs = [
    { id: 'stats', label: 'Характеристики' },
    { id: 'equipment', label: 'Снаряжение' },
    { id: 'talents', label: 'Таланты' },
    { id: 'pet', label: 'Спутник' },
  ];

  return <FolioPage className="hero-codex hero-reference-codex space-y-3 pt-3">
    <HeroReferenceArt region="frame" stretch className="hero-reference-backdrop"/>
    <div className="hero-reference-clean-page" aria-hidden="true"><HeroReferenceArt region="paper" stretch/></div>

    <BestiaryPanel className="codex-paper hero-sheet"><HeroReferenceArt region="paper" stretch className="hero-paper-surface"/>
      <div className="hero-identity">
        <div className="hero-portrait">{player.classId === 'necromancer' ? <HeroReferenceArt region="necromancer" className="hero-reference-portrait"/> : <Portrait src={heroImage} alt={localize(classDef.name)} fallback="character" className="h-full w-full object-cover object-top"/>}<span className="hero-rank">{localize("Ранг ")}{localize(player.ascension?.rank || 'E')}</span></div>
        <div className="hero-biography">
    <div className="hero-codex-heading flex items-center justify-between gap-3 px-1"><HeroReferenceArt region="title" stretch className="hero-title-art"/>
      <div><div className="text-[11px] uppercase tracking-[.16em] text-[#918c82]">{localize("Лист героя")}</div><h1 className="section-title text-lg">{localize("Кодекс персонажа")}</h1></div>
      {onClose && <button onClick={onClose} aria-label={localize("Закрыть лист персонажа")} className="rpg-icon-button"><HeroReferenceArt region="close" className="hero-close-art"/></button>}
    </div>
          <div className="hero-class-heading"><span className="codex-eyebrow">{localize(classDef.role)}</span></div>
          <h2>{player.name}</h2>
          <p>{localize(classDef.name)}{localize(" · Уровень ")}{localize(player.level)}{localize(premium.active && ' · Premium')}</p>
          <ProgressBar value={player.exp} max={player.nextExp} tone="energy" label={`До уровня ${player.level + 1}`} className="mt-3"/>
          <div className="hero-counters">
            <button onClick={() => setActiveTab('stats')}><HeroReferenceArt region="strength"/><strong>{localize(player.statPoints)}</strong><span>{localize("Атрибуты")}</span></button>
            <button onClick={() => setActiveTab('talents')}><HeroReferenceArt region="intelligence"/><strong>{localize(player.talentPoints)}</strong><span>{localize("Таланты")}</span></button>
            <button onClick={() => navigate('mine')}><HeroReferenceArt region="critical"/><strong>{localize(player.miningLevel)}/{localize(player.alchemyLevel)}</strong><span>{localize("Профессии")}</span></button>
          </div>
        </div>
        <HeroReferenceArt region="castle" className="hero-reference-castle"/>
      </div>
      <details className="codex-detail hero-passive"><summary>{localize("Класс и пассивка · ")}{localize(classDef.passive.name)}</summary><p>{localize(classDef.description)}</p><p>{localize(classDef.passive.description)}</p></details>
    </BestiaryPanel>

    <div className="hero-reference-tabs" role="tablist">{tabs.map(tab=><button key={tab.id} type="button" role="tab" aria-selected={activeTab===tab.id} onClick={()=>setActiveTab(tab.id as CharacterTab)}>
      <HeroReferenceArt region={activeTab===tab.id?'tabActive':'tab'} stretch/><span>{localize(tab.label)}</span>
    </button>)}</div>

    {activeTab === 'stats' && <div className="space-y-3">
      <BestiaryPanel className="codex-paper hero-attributes p-3"><HeroReferenceArt region="paper" stretch className="hero-paper-surface"/>
        <div className="mb-2 flex items-center justify-between gap-2"><SectionTitle>{localize("Основные атрибуты")}</SectionTitle><span className="text-[11px] font-mono text-[#d1ad67]">{localize("Свободно: ")}{localize(player.statPoints)}</span></div>
        <OrnamentDivider />
        <div className="attribute-grid mt-2">
          {attributes.map(attribute => <div key={attribute.key} className="attribute-card">
            <HeroReferenceArt region={attribute.key} className="hero-attribute-icon"/>
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-[#d8d1c4]">{localize(attribute.label)}</div><div className="attribute-summary">{localize(attribute.summary)}</div></div>
            <strong className="font-mono text-sm text-[#e5ddd0]">{localize(player.attributes[attribute.key])}</strong>
            <button disabled={player.statPoints <= 0} aria-label={localize(`Повысить: ${attribute.label}`)} onClick={() => allocateAttribute(attribute.key)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#71603e] bg-[#282218] text-lg font-bold text-[#d1ad67] disabled:opacity-35"><HeroReferenceArt region="plus" className="hero-plus-icon"/></button>
          </div>)}
        </div>
      </BestiaryPanel>
      <BestiaryPanel className="codex-paper hero-combat-figures p-3"><HeroReferenceArt region="paper" stretch className="hero-paper-surface"/><SectionTitle>{localize("Боевые показатели")}</SectionTitle><div className="mt-2"><HeroStats stats={combatStats} /></div></BestiaryPanel>
    </div>}

    {activeTab === 'equipment' && <BestiaryPanel className="codex-paper space-y-3 p-3">
      <SectionTitle eyebrow="Экипировка героя" action={<button className="codex-link" onClick={() => navigate('inventory')}>{localize("Изменить ›")}</button>}>{localize("Снаряжение")}</SectionTitle>
      <div className="ornament-divider" />
      <div className="grid grid-cols-3 gap-2">
        {equipmentSlots.map(slot => <button key={slot.type} onClick={() => navigate('inventory')} className="equipment-tile" aria-label={localize(`Сменить: ${slot.label}`)}>{player.equipped[slot.type] ? <ItemArtwork item={player.equipped[slot.type]!} size={48}/> : <RpgIcon kind={slot.type} size={36}/>}<span>{localize(slot.label)}</span><small>{localize(player.equipped[slot.type]?.name || 'Пусто')}</small></button>)}
      </div>
      {player.equipped.pickaxe && <ItemSlot label="Шахтная кирка" itemName={player.equipped.pickaxe.name} icon="pickaxe" />}
      {player.equipped.alchemyTool && <ItemSlot label="Алхимический инструмент" itemName={player.equipped.alchemyTool.name} icon="alchemyTool" />}
    </BestiaryPanel>}

    {activeTab === 'talents' && <BestiaryPanel className="fantasy-talents p-2"><TalentTree /></BestiaryPanel>}

    {activeTab === 'pet' && <BestiaryPanel className="codex-paper space-y-3 p-4"><SectionTitle action={<button className="codex-link" onClick={() => navigate('pets')}>{localize("Выбрать ›")}</button>}>{localize("Спутник")}</SectionTitle>
      {player.activePet ? <>
        <div className="flex items-center gap-3"><div className="grid h-16 w-16 place-items-center rounded-lg border border-[#514633] bg-[#101315]"><RpgIcon kind="pet" size={34} className="text-[#a48b60]" /></div><div><div className="text-[11px] uppercase tracking-[.15em] text-[#918c82]">{localize("Спутник героя")}</div><h2 className="folio-title text-lg font-bold">{localize(player.activePet.name)}</h2><div className="text-xs text-[#b4aea2]">{localize("Уровень ")}{localize(player.activePet.level)}</div></div></div>
        <OrnamentDivider />
        <StatRow label="Пассивный эффект" value={player.activePet.passiveBonus} />
        {player.activePet.activeSkillName && <div className="rounded-lg border border-[#343638] bg-[#111416] p-3"><div className="text-xs font-semibold text-[#d1ad67]">{localize(player.activePet.activeSkillName)}</div><p className="mt-1 text-xs text-[#aaa49a]">{localize(player.activePet.activeSkillDesc)}</p></div>}
      </> : <div className="py-8 text-center"><RpgIcon kind="pet" size={40} className="mx-auto text-[#756344]" /><p className="mt-3 text-xs text-[#918c82]">{localize("Пока рядом нет спутника.")}</p></div>}
    </BestiaryPanel>}
  </FolioPage>;
};
