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

  return <FolioPage className="hero-codex space-y-3 pt-3">
    <div className="flex items-center justify-between gap-3 px-1">
      <div><div className="text-[11px] uppercase tracking-[.16em] text-[#918c82]">Лист героя</div><h1 className="section-title text-lg">Кодекс персонажа</h1></div>
      {onClose && <button onClick={onClose} aria-label="Закрыть лист персонажа" className="rpg-icon-button"><span className="text-lg">×</span></button>}
    </div>

    <BestiaryPanel className="codex-paper hero-sheet">
      <div className="hero-identity">
        <div className="hero-portrait"><Portrait src={heroImage} alt={classDef.name} fallback="character" className="h-full w-full object-cover object-top"/><span className="hero-rank">Ранг {player.ascension?.rank || 'E'}</span></div>
        <div className="hero-biography">
          <div className="codex-eyebrow">{classDef.role}</div>
          <h2>{player.name}</h2>
          <p>{classDef.name} · Уровень {player.level}{premium.active && ' · Premium'}</p>
          <ProgressBar value={player.exp} max={player.nextExp} tone="energy" label={`До уровня ${player.level + 1}`} className="mt-3"/>
          <div className="hero-counters">
            <button onClick={() => setActiveTab('stats')}><RpgIcon kind="attack" size={22}/><strong>{player.statPoints}</strong><span>Атрибуты</span></button>
            <button onClick={() => setActiveTab('talents')}><RpgIcon kind="quest" size={22}/><strong>{player.talentPoints}</strong><span>Таланты</span></button>
            <button onClick={() => navigate('mine')}><RpgIcon kind="forge" size={22}/><strong>{player.miningLevel}/{player.alchemyLevel}</strong><span>Профессии</span></button>
          </div>
        </div>
      </div>
      <details className="codex-detail hero-passive"><summary>Класс и пассивка · {classDef.passive.name}</summary><p>{classDef.description}</p><p>{classDef.passive.description}</p></details>
    </BestiaryPanel>

    <CodexTabs tabs={tabs} active={activeTab} onChange={id => setActiveTab(id as CharacterTab)} />

    {activeTab === 'stats' && <div className="space-y-3">
      <BestiaryPanel className="codex-paper p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><SectionTitle>Основные атрибуты</SectionTitle><span className="text-[11px] font-mono text-[#d1ad67]">Свободно: {player.statPoints}</span></div>
        <OrnamentDivider />
        <div className="attribute-grid mt-2">
          {attributes.map(attribute => <div key={attribute.key} className="attribute-card">
            <RpgIcon kind={attribute.icon} size={19} className="text-[#a48b60]" />
            <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-[#d8d1c4]">{attribute.label}</div><div className="attribute-summary">{attribute.summary}</div></div>
            <strong className="font-mono text-sm text-[#e5ddd0]">{player.attributes[attribute.key]}</strong>
            <button disabled={player.statPoints <= 0} aria-label={`Повысить: ${attribute.label}`} onClick={() => allocateAttribute(attribute.key)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#71603e] bg-[#282218] text-lg font-bold text-[#d1ad67] disabled:opacity-35">+</button>
          </div>)}
        </div>
      </BestiaryPanel>
      <BestiaryPanel className="codex-paper p-3"><SectionTitle action={<button className="codex-link" onClick={() => navigate('inventory')}>Изменить ›</button>}>Снаряжение</SectionTitle><div className="equipment-preview">{equipmentSlots.filter(slot => player.equipped[slot.type]).map(slot => <button key={slot.type} title={player.equipped[slot.type]!.name} aria-label={`Сменить: ${player.equipped[slot.type]!.name}`} onClick={() => navigate('inventory')} className="equipment-tile"><ItemArtwork item={player.equipped[slot.type]!} size={48}/></button>)}</div></BestiaryPanel>
      <BestiaryPanel className="codex-paper p-3"><SectionTitle eyebrow="Производные значения">Боевые показатели</SectionTitle><div className="mt-2"><HeroStats stats={combatStats} /></div></BestiaryPanel>
    </div>}

    {activeTab === 'equipment' && <BestiaryPanel className="codex-paper space-y-3 p-3">
      <SectionTitle eyebrow="Экипировка героя" action={<button className="codex-link" onClick={() => navigate('inventory')}>Изменить ›</button>}>Снаряжение</SectionTitle>
      <div className="ornament-divider" />
      <div className="grid grid-cols-3 gap-2">
        {equipmentSlots.map(slot => <button key={slot.type} onClick={() => navigate('inventory')} className="equipment-tile" aria-label={`Сменить: ${slot.label}`}>{player.equipped[slot.type] ? <ItemArtwork item={player.equipped[slot.type]!} size={48}/> : <RpgIcon kind={slot.type} size={36}/>}<span>{slot.label}</span><small>{player.equipped[slot.type]?.name || 'Пусто'}</small></button>)}
      </div>
      {player.equipped.pickaxe && <ItemSlot label="Шахтная кирка" itemName={player.equipped.pickaxe.name} icon="pickaxe" />}
      {player.equipped.alchemyTool && <ItemSlot label="Алхимический инструмент" itemName={player.equipped.alchemyTool.name} icon="alchemyTool" />}
    </BestiaryPanel>}

    {activeTab === 'talents' && <BestiaryPanel className="fantasy-talents p-2"><TalentTree /></BestiaryPanel>}

    {activeTab === 'pet' && <BestiaryPanel className="codex-paper space-y-3 p-4"><SectionTitle action={<button className="codex-link" onClick={() => navigate('pets')}>Выбрать ›</button>}>Спутник</SectionTitle>
      {player.activePet ? <>
        <div className="flex items-center gap-3"><div className="grid h-16 w-16 place-items-center rounded-lg border border-[#514633] bg-[#101315]"><RpgIcon kind="pet" size={34} className="text-[#a48b60]" /></div><div><div className="text-[11px] uppercase tracking-[.15em] text-[#918c82]">Спутник героя</div><h2 className="folio-title text-lg font-bold">{player.activePet.name}</h2><div className="text-xs text-[#b4aea2]">Уровень {player.activePet.level}</div></div></div>
        <OrnamentDivider />
        <StatRow label="Пассивный эффект" value={player.activePet.passiveBonus} />
        {player.activePet.activeSkillName && <div className="rounded-lg border border-[#343638] bg-[#111416] p-3"><div className="text-xs font-semibold text-[#d1ad67]">{player.activePet.activeSkillName}</div><p className="mt-1 text-xs text-[#aaa49a]">{player.activePet.activeSkillDesc}</p></div>}
      </> : <div className="py-8 text-center"><RpgIcon kind="pet" size={40} className="mx-auto text-[#756344]" /><p className="mt-3 text-xs text-[#918c82]">Пока рядом нет спутника.</p></div>}
    </BestiaryPanel>}
  </FolioPage>;
};
