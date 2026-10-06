import { HeroEquipment } from '../../interfaces/modern/HeroEquipment';
import { FirstJourneyHint } from './FirstJourneyHint';
import { t as localize, useLocale, intlLocale } from '../../i18n/locale';
import { HeroStats } from './HeroStats';
import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CLASSES, ASSETS } from '../../data/gameData';
import { CharacterAttributes } from '../../types/game';
import { 
  User, 
  Shield, 
  Swords, 
  Zap, 
  Sparkles, 
  Heart, 
  Check, 
  Plus, 
  ArrowLeft,
  Dog
} from 'lucide-react';
import { TalentTree } from './TalentTree';
import { sound } from '../../utils/audio';

interface CharacterScreenProps {
  onClose?: () => void;
  onOpenInventory?: () => void;
}

export const CharacterScreen: React.FC<CharacterScreenProps> = ({ onClose, onOpenInventory }) => {
  useLocale();
  const { player, combatStats, allocateAttribute, premium } = useGame();
  const [activeTab, setActiveTab] = useState<'stats' | 'talents' | 'pet'>('stats');

  if (!player) return null;

  const classDef = CLASSES[player.classId];
  const expPct = Math.min(100, Math.round((player.exp / player.nextExp) * 100));

  return (
    <div className="p-3 space-y-4 max-w-lg mx-auto pb-24">
      <FirstJourneyHint />
      <div className="flex items-center gap-3"><button onClick={onClose} disabled={!onClose} aria-label={localize("Закрыть профиль")} className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400"><ArrowLeft className="w-4 h-4"/></button><h2 className="font-cinzel text-sm font-bold text-slate-200">{localize("Профиль героя")}</h2></div>

      <section className="ui-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 data-player-name className="font-cinzel break-words">{player.name}</h2><p className="mt-1 text-xs text-slate-400">{localize(classDef.name)} · {localize("Уровень ")}{player.level} · {localize("Ранг ")}{player.ascension?.rank || 'E'}{premium.active && ' · Premium'}</p></div><span className="modern-tag">EXP {expPct}%</span></div>
        <div role="progressbar" aria-label={localize("Опыт героя")} aria-valuenow={expPct} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-1.5 rounded-full bg-black/50 overflow-hidden"><div className="h-full bg-amber-400" style={{width:`${expPct}%`}} /></div>
        <details className="mt-3 text-xs"><summary className="cursor-pointer text-amber-200">{localize("Класс и пассивка · ")}{localize(classDef.passive.name)}</summary><p className="mt-2 text-slate-400">{localize(classDef.description)}</p><p className="mt-2 text-slate-400">{localize(classDef.passive.description)}</p><p className="mt-2 text-slate-400">{localize("Шахта / алхимия")}: {player.miningLevel} / {player.alchemyLevel}</p></details>
      </section>

      <HeroEquipment onOpenInventory={onOpenInventory} />
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1 text-xs">
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 text-center rounded-lg font-cinzel font-bold transition-colors ${
            activeTab === 'stats'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Характеристики")}{player.statPoints > 0 && (
            <span className="ml-1.5 px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-mono">
              +{localize(player.statPoints)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('talents')}
          className={`flex-1 py-2 text-center rounded-lg font-cinzel font-bold transition-colors ${
            activeTab === 'talents'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Дерево талантов")}{player.talentPoints > 0 && (
            <span className="ml-1.5 px-1 py-0.2 rounded-full bg-purple-500 text-white text-[10px] font-mono">
              +{localize(player.talentPoints)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pet')}
          className={`flex-1 py-2 text-center rounded-lg font-cinzel font-bold transition-colors ${
            activeTab === 'pet'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Питомец")}</button>
      </div>

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <div className="space-y-3">
          {/* Attributes Allocation */}
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3 space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
              <span className="font-cinzel font-bold text-slate-200">{localize("Базовые атрибуты:")}</span>
              <span className="font-mono text-amber-400">{localize("Свободно очков: ")}{localize(player.statPoints)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'strength', label: 'Сила', desc: 'Физическая атака и защита', icon: '⚔️' },
                { key: 'agility', label: 'Ловкость', desc: 'Скорость, уклонение, крит', icon: '🏹' },
                { key: 'intelligence', label: 'Интеллект', desc: 'Маг. атака, запас маны', icon: '🔮' },
                { key: 'vitality', label: 'Живучесть', desc: 'Здоровье, физ. защита', icon: '🛡️' },
                { key: 'luck', label: 'Удача', desc: 'Дроп редких предметов, крит', icon: '🍀' },
                { key: 'spirit', label: 'Дух', desc: 'Регенерация MP, маг. защита', icon: '✨' },
                { key: 'willpower', label: 'Воля', desc: 'Регенерация HP, стойкость', icon: '🧠' },
              ] as const).map(attr => (
                <div
                  key={attr.key}
                  className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-900/60 text-xs font-mono"
                >
                  <div className="min-w-0">
                    <span className="mr-1">{localize(attr.icon)}</span>
                    <span className="text-slate-300">{localize(attr.label)}</span>
                    <span className="block mt-1 text-[9px] text-slate-500">{localize(attr.desc)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-bold">
                      {localize(player.attributes[attr.key as keyof CharacterAttributes])}
                    </span>
                    <button
                        disabled={player.statPoints <= 0}
                        aria-label={localize(`Повысить: ${attr.label}`)}
                        onClick={() => allocateAttribute(attr.key as keyof CharacterAttributes)}
                        className="modern-attribute-plus w-8 h-8 shrink-0 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <HeroStats stats={combatStats} />
        </div>
      )}

      {/* TALENTS TAB */}
      {activeTab === 'talents' && <TalentTree />}

      {/* PET TAB */}
      {activeTab === 'pet' && (
        <div className="rounded-xl border border-teal-500/30 bg-[#0a121d] p-4 space-y-3">
          {player.activePet ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl p-2 bg-slate-900 rounded-xl border border-slate-800">
                  {localize(player.activePet.icon)}
                </span>
                <div>
                  <h3 className="font-cinzel text-sm font-bold text-slate-100">
                    {localize(player.activePet.name)}
                  </h3>
                  <span className="text-[10px] font-mono text-teal-400">{localize("Уровень ")}{localize(player.activePet.level)}{localize(" · Питомец героя")}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-900 text-xs text-slate-300">
                <span className="text-teal-300 font-bold block mb-0.5">{localize("Пассивный бонус:")}</span>
                {localize(player.activePet.passiveBonus)}
              </div>

              {player.activePet.activeSkillName && (
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-900 text-xs text-slate-300">
                  <span className="text-amber-300 font-bold block mb-0.5">{localize("Навык: ")}{localize(player.activePet.activeSkillName)}
                  </span>
                  {localize(player.activePet.activeSkillDesc)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-6">{localize("У вас пока нет активного питомца.")}</div>
          )}
        </div>
      )}
    </div>
  );
};
