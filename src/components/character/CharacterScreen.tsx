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
}

export const CharacterScreen: React.FC<CharacterScreenProps> = ({ onClose }) => {
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

      <section className="relative overflow-hidden rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-slate-900 via-cyan-950/30 to-slate-950 p-4 space-y-4">
        <div className="flex items-center gap-4"><div className="relative shrink-0"><img src={classDef.image || ASSETS.heroHunter} alt={localize(classDef.name)} className="w-20 h-24 rounded-xl object-cover border border-amber-500/40 shadow-lg" referrerPolicy="no-referrer"/><span className="absolute -bottom-2 inset-x-1 rounded-lg border border-amber-700 bg-slate-950 py-1 text-center text-[10px] text-amber-200">{localize("Ранг ")}{localize(player.ascension?.rank || 'E')}</span></div><div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-widest text-cyan-400">{localize(classDef.role)}</p><h3 className="mt-1 font-cinzel text-lg font-bold text-slate-100 break-words">{player.name}</h3><p className="text-xs text-slate-400 mt-1">{localize(classDef.icon)} {localize(classDef.name)}{localize(" · Уровень ")}{localize(player.level)}</p>{premium.active && <span className="inline-block mt-2 rounded border border-amber-600/40 bg-amber-950/40 px-2 py-1 text-[10px] text-amber-200">👑 Premium</span>}</div></div>
        <div className="pt-1 space-y-1.5"><div className="flex justify-between text-[10px] text-slate-400"><span>{localize("До уровня ")}{localize(player.level+1)}</span><span className="font-mono text-cyan-200">{localize(player.exp.toLocaleString(intlLocale()))} / {localize(player.nextExp.toLocaleString(intlLocale()))} EXP</span></div><div role="progressbar" aria-label={localize("Опыт героя")} aria-valuenow={expPct} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-slate-950 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-400" style={{width:`${expPct}%`}} /></div></div>
        <div className="grid grid-cols-3 gap-2 text-center text-[10px]"><div className="rounded-xl bg-slate-950/60 p-2"><b className="block text-amber-200">{localize(player.statPoints)}</b><span className="text-slate-500">{localize("Очки атрибутов")}</span></div><div className="rounded-xl bg-slate-950/60 p-2"><b className="block text-purple-200">{localize(player.talentPoints)}</b><span className="text-slate-500">{localize("Очки талантов")}</span></div><div className="rounded-xl bg-slate-950/60 p-2"><b className="block text-emerald-200">{localize(player.miningLevel)} / {localize(player.alchemyLevel)}</b><span className="text-slate-500">{localize("Шахта / алхимия")}</span></div></div>
        <details className="border-t border-slate-800 pt-2"><summary className="cursor-pointer py-1 text-xs text-amber-200">{localize("Класс и пассивка · ")}{localize(classDef.passive.name)}</summary><p className="text-[11px] text-slate-400 mt-2">{localize(classDef.description)}</p><p className="mt-2 text-[11px] text-amber-100/80">{localize(classDef.passive.description)}</p></details>
      </section>

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
                        className="w-5 h-5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
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
