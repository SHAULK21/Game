import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { CLASS_BRANCHES, branchSpent, spentTalentPoints, talentCost, talentLockReason, talentResetPrice, talentBonuses } from '../../data/talents';
import type { Talent } from '../../types/game';

const BRANCHES = ['damage', 'survival', 'class'] as const;
const RANGES = ['1–20', '21–40', '41–60', '61–80', '81–100'];
export function TalentTree() {
  const { player, unlockTalent, resetTalentTree, isInCombat, isCombatEnded } = useGame();
  const [branch, setBranch] = useState<'damage' | 'survival' | 'class' | 'mastery'>('damage');
  const [confirmReset, setConfirmReset] = useState(false);
  if (!player) return null;
  const busy = isInCombat && !isCombatEnded;
  const spent = player.talents.reduce((sum, talent) => sum + spentTalentPoints(talent), 0);
  const price = talentResetPrice(player.level);
  const selected = player.talents.filter(t => t.branch === branch);
  const legacy = player.talents.filter(t => t.branch === 'legacy');
  const names = CLASS_BRANCHES[player.classId];
  const renderTalent = (talent: Talent) => {
    const reason = busy ? 'Завершите бой' : talentLockReason(player, talent);
    const mastered = talent.currentRank >= talent.maxRank;
    const bonus = talent.branch === 'mastery' ? talentBonuses([talent])[talent.effect.stat] || 0 : null;
    return <article key={talent.id} className={`rounded-xl border p-3 flex flex-col gap-2 ${talent.currentRank ? 'border-amber-700/60 bg-amber-950/15' : 'border-slate-800 bg-slate-950/50'}`}>
      <div className="flex justify-between gap-2 text-[10px] text-slate-400"><span>Ур. {talent.levelReq || 1}</span><span>{talent.branch === 'mastery' ? `Ранг ${talent.currentRank}` : `${talent.currentRank}/${talent.maxRank}`}</span></div>
      <h3 className="text-xs font-semibold text-slate-100">{talent.name}</h3>
      <p className="text-[11px] leading-relaxed text-slate-400 flex-1">{talent.description}</p>
      {bonus !== null && <p className="text-[10px] text-amber-200">Сейчас: +{bonus.toFixed(2)}%</p>}
      {talent.branchPointsReq ? <p className="text-[10px] text-slate-500">В ветке: {branchSpent(player.talents, talent.branch!)}/{talent.branchPointsReq} очков для доступа</p> : null}
      <button disabled={Boolean(reason)} title={reason || 'Изучить талант'} onClick={() => unlockTalent(talent.id)} className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-2 py-2 text-[10px] font-semibold text-amber-100 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500 min-h-10">
        {mastered ? 'Изучено полностью' : reason || `Изучить · ${talentCost(talent)} очк.`}
      </button>
    </article>;
  };
  return <div className="space-y-4">
    <div className="ui-panel rounded-xl border p-3 space-y-2">
      <div className="flex justify-between text-xs"><span>Свободно: <strong className="text-amber-200">{player.talentPoints}</strong></span><span className="text-slate-400">Вложено: {spent}</span></div>
      <p className="text-[11px] leading-relaxed text-slate-400">Выберите стиль боя. Полная ветка стоит 58 очков: к 100 уровню доступны одна специализация и часть других. Очки характеристик распределяются отдельно.</p>
      {busy && <p role="status" className="text-[11px] text-amber-200">Распределение и сброс доступны после боя.</p>}
    </div>
    <div role="tablist" aria-label="Ветки талантов" className="grid grid-cols-3 gap-1">
      {BRANCHES.map((id, index) => <button key={id} role="tab" aria-selected={branch === id} onClick={() => setBranch(id)} className={`rounded-lg border px-2 py-2 min-h-14 text-[11px] ${branch === id ? 'border-amber-700 text-amber-100 bg-amber-950/30' : 'border-slate-800 text-slate-400'}`}>
        {names[index]}<span className="block mt-1 text-[10px] opacity-70">{branchSpent(player.talents, id)} / 58 очк.</span>
      </button>)}
    </div>
    <button onClick={() => setBranch('mastery')} className={`w-full rounded-lg border py-2 text-xs ${branch === 'mastery' ? 'border-amber-700 text-amber-100' : 'border-slate-800 text-slate-400'}`}>Мастерство · с 101 уровня</button>
    {branch === 'mastery' ? <><p className="text-[11px] text-slate-400">Малые прибавки с убывающей отдачей и растущей ценой. Мастерство не повышает крит или вампиризм.</p><div className="grid grid-cols-2 gap-2">{selected.map(renderTalent)}</div></> :
      <div role="tabpanel" className="space-y-3">{RANGES.map((range, index) => <section key={range} className="relative space-y-2">
        {index > 0 && <div aria-hidden="true" className="mx-auto h-4 w-px bg-slate-700" />}
        <h4 className="text-[10px] uppercase tracking-wider text-slate-500">Уровни {range}</h4>
        <div className="grid grid-cols-2 gap-2">{selected.filter(t => t.tier === index + 1).map(renderTalent)}</div>
      </section>)}</div>}
    {legacy.length > 0 && <details className="rounded-xl border border-slate-800 p-3"><summary className="text-xs text-amber-200 cursor-pointer">Сохранённые таланты · {branchSpent(player.talents, 'legacy')} очк.</summary><p className="mt-2 text-[11px] text-slate-400">Старые ранги и бонусы действуют. При сбросе их очки вернутся для нового дерева.</p><div className="mt-2 space-y-2">{legacy.map(t => <div key={t.id} className="text-[11px] text-slate-300">{t.name} · {t.currentRank}/{t.maxRank}<p className="text-slate-500">{t.description}</p></div>)}</div></details>}
    <div className="rounded-xl border border-slate-800 p-3 space-y-2">
      <p className="text-[11px] text-slate-400">Сброс вернёт все {spent} вложенных очков, включая старые таланты и мастерство. Стоимость: {price} серебра. У вас: {player.silver}.</p>
      {confirmReset ? <div className="flex gap-2"><button disabled={busy || player.silver < price || !spent} onClick={() => { resetTalentTree(); setConfirmReset(false); }} className="flex-1 rounded-lg bg-amber-900/40 border border-amber-700 p-2 text-xs text-amber-100 disabled:opacity-40">Сбросить за {price} серебра</button><button onClick={() => setConfirmReset(false)} className="rounded-lg border border-slate-700 p-2 text-xs text-slate-400">Отмена</button></div> :
        <button disabled={busy || !spent || player.silver < price} onClick={() => setConfirmReset(true)} className="w-full rounded-lg border border-slate-700 p-2 text-xs text-slate-300 disabled:opacity-40">Сбросить распределение</button>}
    </div>
  </div>;
}
