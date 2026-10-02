import { t as localize, useLocale } from '../../../../i18n/locale';
import React from 'react';
import { useDialog } from '../ui/useDialog';
import { useGame } from '../../../../context/GameContext';
import { sound } from '../../../../utils/audio';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, RpgButton } from '../ui/BestiaryUI';

export const OfflineReportModal: React.FC = () => {
  useLocale();
  const { offlineReport, dismissOfflineReport } = useGame();

  const dialogRef = useDialog(Boolean(offlineReport), dismissOfflineReport);
  if (!offlineReport) return null;

  const hours = Math.floor(offlineReport.minutes / 60);
  const mins = offlineReport.minutes % 60;
  const timeStr = hours > 0 ? `${hours}ч ${mins}м` : `${mins} минут`;
  const miningRewards = offlineReport.miningRewards || [];
  const totalResources = miningRewards.reduce((sum, reward) => sum + reward.count, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={localize("Отчёт офлайн-добычи")} className="dialog-frame w-full max-w-sm space-y-4 p-5 text-center animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-full bg-yellow-950/80 border border-yellow-400 text-yellow-300 flex items-center justify-center mx-auto">
          <RpgIcon kind="mine" size={25} />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest flex items-center justify-center gap-1">
            <RpgIcon kind="crown" size={14} />{localize(" Premium офлайн-добыча")}</span>
          <h3 className="font-cinzel text-lg font-bold text-slate-100">{localize("Шахтёры вернулись")}</h3>
          <p className="text-xs text-slate-400">{localize("Пока вас не было (")}{localize(timeStr)}{localize("), Premium автоматически собирал доступные по вашему уровню ресурсы.")}</p>
        </div>

        <BestiaryPanel className="space-y-2 p-3 text-left">
          {miningRewards.length > 0 ? (
            <>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <RpgIcon kind="inventory" size={16} className="text-purple-400" />{localize("Всего ресурсов")}</span>
                <span className="text-purple-300 font-bold">×{localize(totalResources)}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {miningRewards.map(reward => (
                  <div key={reward.name} className="rounded-lg border border-slate-800 bg-black/20 p-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <RpgIcon kind="ore" size={20} />
                      <div className="min-w-0">
                        <div className="break-words text-xs leading-tight text-slate-200">{localize(reward.name)}</div>
                        <div className="text-xs font-bold text-emerald-300">×{localize(reward.count)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-[11px] text-rose-300">{localize("Рюкзак был заполнен, поэтому автоматическую добычу сохранить не удалось.")}</div>
          )}
        </BestiaryPanel>

        <RpgButton
          onClick={() => {
            sound.playVictory();
            dismissOfflineReport();
          }}
          variant="primary"
          className="w-full"
        >{localize("Понятно")}</RpgButton>
      </section>
    </div>
  );
};
