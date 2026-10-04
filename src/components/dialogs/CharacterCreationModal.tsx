import { ClassPortraitIcon } from '../../interfaces/fantasy/components/ui/ClassPortraitIcon';
import { SkillCodexCard } from '../../interfaces/fantasy/components/ui/SkillCodexCard';
import { t as localize, useLocale } from '../../i18n/locale';
import { useInterface } from '../../context/InterfaceContext';
import { getFantasyHeroArtwork } from '../../interfaces/fantasy/utils/heroArtwork';
import { InterfaceSwitcher } from '../ui/InterfaceSwitcher';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CharacterClassId } from '../../types/game';
import { CLASSES, ASSETS } from '../../data/gameData';
import { getTelegramUser } from '../../utils/telegram';
import { Swords } from 'lucide-react';
import { ClassIcon } from '../ui/ClassIcon';
import { SkillDetails } from '../ui/SkillDetails';
import { CLASS_SKILLS } from '../../data/classEvolution';
import { sound } from '../../utils/audio';
import { CLASS_EQUIPMENT } from '../../utils/classEquipment';
import { ClassGearBonus } from '../ui/ClassGearBonus';

export const CharacterCreationModal: React.FC = () => {
  useLocale();
  const { createCharacter } = useGame();
  const tgUser = getTelegramUser();

  const [name, setName] = useState<string>(tgUser.first_name || 'Теневой Странник');
  const [selectedClass, setSelectedClass] = useState<CharacterClassId>('warrior');

  const handleStart = () => {
    if (!name.trim()) return;
    createCharacter(name, selectedClass);
  };

  const { style } = useInterface();
  const classList = Object.values(CLASSES);
  const activeClassDef = CLASSES[selectedClass];

  return (
    <div className="registration-screen fixed inset-0 z-50 bg-[#07090e] overflow-y-auto p-4 flex flex-col items-center justify-start">
      <div className="w-full max-w-md shrink-0 space-y-4 my-auto">
        {/* Logo / Header */}
        <div className="text-center space-y-1">

          <h1 className="text-2xl font-semibold tracking-wide text-slate-100">
            AETHELGARD
          </h1>
          <p className="text-xs text-slate-400">{localize("Выберите класс и имя персонажа.")}</p>
        </div>

        <InterfaceSwitcher />

        {/* Hero Visual Card */}
        <div className="registration-hero-art relative shrink-0 rounded-2xl overflow-hidden border border-slate-700 h-40 bg-gradient-to-t from-[#0a0f1d] to-transparent">
          <img
            src={style === 'fantasy' ? getFantasyHeroArtwork(selectedClass) : activeClassDef?.image || ASSETS.heroHunter}
            alt={localize(activeClassDef?.name || 'Hero')}
            className="w-full h-full object-cover object-top opacity-85 transition-opacity duration-300"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
            <span className="font-cinzel font-bold text-slate-100 flex items-center gap-1.5">
              <ClassIcon classId={selectedClass} className="h-4 w-4" />
              <span>{localize("Класс: ")}{localize(activeClassDef?.name)}</span>
            </span>
          </div>
        </div>

        {/* Character Name Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{localize("Имя персонажа:")}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={localize("Введите имя героя...")}
            className="w-full bg-[#0b101c] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-cinzel font-bold focus:outline-none focus:border-cyan-400 shadow-inner"
          />
        </div>

        {/* Class Selection Grid */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">{localize("Выберите класс героя:")}</label>

          <div className="grid grid-cols-3 gap-2">
            {classList.map(c => {
              const isSelected = selectedClass === c.id;
              return (
                <button
                  key={c.id}
                  aria-pressed={isSelected}
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
                  {style === 'fantasy' ? <ClassPortraitIcon classId={c.id} className="registration-class-portrait" /> : <ClassIcon classId={c.id} className="h-6 w-6 mb-1" />}
                  <span className="font-cinzel text-[11px] font-bold">{localize(c.name)}</span>
                  <span className="text-[8px] text-slate-400 truncate w-full text-center">
                    {localize(c.role.split('/')[0])}
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
                <ClassIcon classId={selectedClass} className="h-4 w-4" />
                <span>{localize(activeClassDef.name)} ({localize(activeClassDef.role)})</span>
              </span>
              <span className="text-[#d5ba89] font-mono text-[11px]">
                {localize(activeClassDef.startingSkills.length)}{localize(" стартовых навыка")}</span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {localize(activeClassDef.description)}
            </p>
            <div className="rounded-lg border border-slate-700 p-2 text-[10px] text-cyan-200">{localize("Основное оружие: ")}{localize(CLASS_EQUIPMENT[selectedClass].weapon)}{localize(". Нагрудник: ")}{localize(CLASS_EQUIPMENT[selectedClass].armor)}.
              <ClassGearBonus item={{ name: CLASS_EQUIPMENT[selectedClass].weapon, type: 'weapon', targetClass: selectedClass, level: 1 }} characterClass={selectedClass} />
              <ClassGearBonus item={{ name: CLASS_EQUIPMENT[selectedClass].armor, type: 'armor', targetClass: selectedClass, level: 1 }} characterClass={selectedClass} />
              <p className="mt-1 text-slate-400">{localize("Можно носить оружие и нагрудники любого класса по уровню. Дополнительный бонус работает только у целевого класса.")}</p>
            </div>
            <div className="registration-passive rounded-lg border border-amber-500/30 bg-amber-950/20 px-2.5 py-2"><div className="text-[9px] uppercase tracking-wider font-bold text-amber-300">{localize("Пассив: ")}{localize(activeClassDef.passive.name)}</div><div className="text-[10px] text-amber-100/80 mt-0.5">{localize(activeClassDef.passive.description)}</div></div>

            <details className="registration-skills rounded-lg border border-slate-700 p-2">
              <summary className="cursor-pointer font-semibold text-slate-200">{localize('Навыки класса и условия применения')}</summary>
              <div className="mt-2 space-y-3">
                {[...activeClassDef.startingSkills, ...CLASS_SKILLS[selectedClass]].map(skill => style === 'fantasy' ? <SkillCodexCard key={skill.id} skill={skill} /> : <section key={skill.id}>
                  <h3 className="flex items-center gap-2 font-semibold text-slate-200"><Swords className="h-4 w-4" aria-hidden="true" />{localize(skill.name)}</h3>
                  <SkillDetails skill={skill} />
                </section>)}
              </div>
            </details>

            {/* Base Attributes preview */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-400 pt-1">
              <div>{localize("СИЛ: ")}<span className="text-slate-200 font-bold">{localize(activeClassDef.baseAttributes.strength)}</span></div>
              <div>{localize("ЛОВ: ")}<span className="text-slate-200 font-bold">{localize(activeClassDef.baseAttributes.agility)}</span></div>
              <div>{localize("ИНТ: ")}<span className="text-slate-200 font-bold">{localize(activeClassDef.baseAttributes.intelligence)}</span></div>
              <div>{localize("ЖИВ: ")}<span className="text-slate-200 font-bold">{localize(activeClassDef.baseAttributes.vitality)}</span></div>
            </div>
          </div>
        )}

        {/* Start Game Button */}
        <button
          onClick={handleStart}
          disabled={!name.trim()}
          className="ui-primary w-full py-3.5 rounded-xl font-cinzel font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 border border-cyan-400/40"
        >
          <Swords className="w-4 h-4" />
          <span>{localize("Начать путешествие")}</span>
        </button>
      </div>
    </div>
  );
};
