import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CharacterClassId } from '../../types/game';
import { CLASSES, ASSETS } from '../../data/gameData';
import { getTelegramUser } from '../../utils/telegram';
import { sound } from '../../utils/audio';
import { CLASS_EQUIPMENT } from '../../utils/classEquipment';
import { ClassGearBonus } from '../ui/ClassGearBonus';
import { RpgIcon, type RpgIconKind } from '../ui/RpgIcon';

const classIconFor = (id: CharacterClassId): RpgIconKind => {
  const icons: Record<CharacterClassId, RpgIconKind> = {
  warrior: 'attack', berserker: 'attack', knight: 'defend', rogue: 'hunt', assassin: 'attack',
  archer: 'attack', mage: 'skill', necromancer: 'skill', paladin: 'defend', druid: 'herb'
  };
  return icons[id] || 'character';
};

export const CharacterCreationModal: React.FC = () => {
  const { createCharacter } = useGame();
  const tgUser = getTelegramUser();

  const [name, setName] = useState<string>(tgUser.first_name || 'Теневой Странник');
  const [selectedClass, setSelectedClass] = useState<CharacterClassId>('warrior');

  const handleStart = () => {
    if (!name.trim()) return;
    createCharacter(name, selectedClass);
  };

  const classList = Object.values(CLASSES);
  const activeClassDef = CLASSES[selectedClass];

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] overflow-y-auto p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-4 my-auto">
        {/* Logo / Header */}
        <div className="text-center space-y-1">

          <h1 className="text-2xl font-semibold tracking-wide text-slate-100">
            AETHELGARD
          </h1>
          <p className="text-xs text-slate-400">
            Выберите класс и имя персонажа.
          </p>
        </div>

        {/* Hero Visual Card */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700 h-40 bg-gradient-to-t from-[#0a0f1d] to-transparent">
          <img
            src={activeClassDef?.image || ASSETS.heroHunter}
            alt={activeClassDef?.name || 'Hero'}
            className="w-full h-full object-cover object-top opacity-85 transition-opacity duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
            <span className="font-cinzel font-bold text-slate-100 flex items-center gap-1.5">
              <RpgIcon kind={classIconFor(selectedClass)} size={19} />
              <span>Класс: {activeClassDef?.name}</span>
            </span>
          </div>
        </div>

        {/* Character Name Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Имя персонажа:
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Введите имя героя..."
            className="w-full bg-[#0b101c] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-cinzel font-bold focus:outline-none focus:border-cyan-400 shadow-inner"
          />
        </div>

        {/* Class Selection Grid */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
            Выберите класс героя:
          </label>

          <div className="grid grid-cols-3 gap-2">
            {classList.map(c => {
              const isSelected = selectedClass === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedClass(c.id);
                    sound.playClick();
                  }}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'border-[#9d8459] bg-[#302c24] text-[#d5ba89]'
                      : 'border-slate-800 bg-[#0a0f1d] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <RpgIcon kind={classIconFor(c.id)} size={22} className="mb-1" />
                  <span className="font-cinzel text-xs font-bold">{c.name}</span>
                  <span className="w-full truncate text-[11px] text-center text-slate-400">
                    {c.role.split('/')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Class Details Card */}
        {activeClassDef && (
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-cinzel font-bold text-slate-100 flex items-center gap-1.5">
                <RpgIcon kind={classIconFor(selectedClass)} size={18} />
                <span>{activeClassDef.name} ({activeClassDef.role})</span>
              </span>
              <span className="text-[#d5ba89] font-mono text-[11px]">
                {activeClassDef.startingSkills.length} стартовых навыка
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {activeClassDef.description}
            </p>
            <div className="rounded-lg border border-slate-700 p-2 text-[10px] text-cyan-200">
              Основное оружие: {CLASS_EQUIPMENT[selectedClass].weapon}. Нагрудник: {CLASS_EQUIPMENT[selectedClass].armor}.
              <ClassGearBonus item={{ name: CLASS_EQUIPMENT[selectedClass].weapon, type: 'weapon', targetClass: selectedClass, level: 1 }} characterClass={selectedClass} />
              <ClassGearBonus item={{ name: CLASS_EQUIPMENT[selectedClass].armor, type: 'armor', targetClass: selectedClass, level: 1 }} characterClass={selectedClass} />
              <p className="mt-1 text-slate-400">Можно носить оружие и нагрудники любого класса по уровню. Дополнительный бонус работает только у целевого класса.</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-2"><div className="text-[9px] uppercase tracking-wider font-bold text-amber-300">Пассив: {activeClassDef.passive.name}</div><div className="text-[10px] text-amber-100/80 mt-0.5">{activeClassDef.passive.description}</div></div>

            {/* Base Attributes preview */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-400 pt-1">
              <div>СИЛ: <span className="text-slate-200 font-bold">{activeClassDef.baseAttributes.strength}</span></div>
              <div>ЛОВ: <span className="text-slate-200 font-bold">{activeClassDef.baseAttributes.agility}</span></div>
              <div>ИНТ: <span className="text-slate-200 font-bold">{activeClassDef.baseAttributes.intelligence}</span></div>
              <div>ЖИВ: <span className="text-slate-200 font-bold">{activeClassDef.baseAttributes.vitality}</span></div>
            </div>
          </div>
        )}

        {/* Start Game Button */}
        <button
          onClick={handleStart}
          disabled={!name.trim()}
          className="rpg-button rpg-button-primary min-h-12 w-full border border-cyan-400/40"
        >
          <RpgIcon kind="attack" size={17} />
          <span>Начать путешествие</span>
        </button>
      </div>
    </div>
  );
};
