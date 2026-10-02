import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import React, { useEffect, useState } from 'react';
import { useGame } from '../../../../context/GameContext';
import { sound } from '../../../../utils/audio';
import { apiRequest } from '../../../../utils/api';
import { RpgIcon, type RpgIconKind } from '../ui/RpgIcon';
import { FolioPage, ResourceBadge } from '../ui/BestiaryUI';

interface MoreMenuScreenProps {
  onOpenAdmin: () => void;
}

export const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ onOpenAdmin }) => {
  useLocale();
  const { player, quests, achievements, premium, preparePremiumInvoice, purchasePremium, claimQuestReward, claimAchievementReward } = useGame();
  const [premiumFeedback, setPremiumFeedback] = useState<string | null>(null);
  const [premiumBusy, setPremiumBusy] = useState(false);
  const [preparedPremiumInvoice, setPreparedPremiumInvoice] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(sound.getIsMuted());
  const [activeSection, setActiveSection] = useState<'quests' | 'achievements' | 'stats' | 'leaderboard' | 'premium' | 'notifications'>('quests');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!player) return;
    apiRequest<{ isAdmin: boolean }>('/api/admin/status')
      .then(result => setIsAdmin(Boolean(result?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, [player?.userId]);

  useEffect(() => {
    if (activeSection !== 'premium' || premium.active || preparedPremiumInvoice) return;
    preparePremiumInvoice().then(link => {
      if (link) setPreparedPremiumInvoice(link);
    }).catch(() => undefined);
  }, [activeSection, premium.active, preparedPremiumInvoice, preparePremiumInvoice]);


  if (!player) return null;

  return (
    <FolioPage className="space-y-3 pt-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#35383a] bg-[#111416] px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-[#aaa49a]"><RpgIcon kind="settings" size={17} /><span>{localize("Настройки звука")}</span></div>
        <button className="rpg-button rpg-button-secondary min-h-10 px-3 text-xs" onClick={() => setIsMuted(sound.toggleMute())}>{localize(isMuted ? 'Звук выключен' : 'Звук включён')}</button>
      </div>
      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-cinzel font-bold">
        <button
          onClick={() => setActiveSection('quests')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'quests'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Квесты")}</button>

        <button
          onClick={() => setActiveSection('achievements')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'achievements'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Достижения")}</button>

        <button
          onClick={() => setActiveSection('stats')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'stats'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Статистика")}</button>

        <button
          onClick={() => setActiveSection('leaderboard')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'leaderboard'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Рейтинг")}</button>

        <button
          onClick={() => setActiveSection('premium')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'premium'
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Premium
        </button>
        <button onClick={() => setActiveSection('notifications')} className={`min-h-11 flex items-center justify-center gap-1 py-2 px-1 rounded-lg border ${activeSection==='notifications'?'bg-cyan-950 text-cyan-200':'bg-slate-900 text-slate-400'}`}><RpgIcon kind="quest" size={15} />{localize("Оповещения")}</button>
      </div>
      {activeSection === 'notifications' && <NotificationsPanel />}

      {/* QUESTS SECTION */}
      {activeSection === 'quests' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-amber-300 px-1">
            <span>{localize("Журнал заданий:")}</span>
            <span>{localize(quests.filter(q => q.completed && !q.claimed).length)}{localize(" готово к сдаче")}</span>
          </div>

          <div className="space-y-2">
            {quests.map(q => {
              const pct = Math.min(100, Math.round((q.currentCount / q.targetCount) * 100));
              return (
                <div
                  key={q.id}
                  className={`p-3 rounded-xl border transition-all ${
                    q.completed && !q.claimed
                      ? 'border-amber-400 bg-amber-950/30'
                      : 'border-slate-800 bg-[#0a0f1d]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-cinzel text-xs font-bold text-slate-100">
                          {localize(q.title)}
                        </span>
                        <span className="text-[11px] font-mono px-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {localize(q.category)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {localize(q.description)}
                      </p>
                    </div>

                    {q.completed ? (
                      q.claimed ? (
                        <span className="text-[11px] font-mono text-slate-500 font-bold px-2 py-1 bg-slate-900 rounded">{localize("Сдано")}</span>
                      ) : (
                        <button
                          onClick={() => claimQuestReward(q.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs active:scale-95 transition-all shadow-md"
                        >{localize("Забрать")}</button>
                      )
                    ) : (
                      <span className="text-[11px] font-mono text-[#d5ba89]">
                        {localize(q.currentCount)}/{localize(q.targetCount)}
                      </span>
                    )}
                  </div>

                  {/* Rewards preview */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                    <span>{localize("Награда:")}</span>
                    <ResourceBadge kind="gold" value={`+${q.rewardGold}`} />
                    <ResourceBadge kind="silver" value={`+${q.rewardSilver || 0}`} />
                    <span className="text-indigo-300 font-bold">+{localize(q.rewardExp)} EXP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS SECTION */}
      {activeSection === 'achievements' && (
        <div className="space-y-2">
          <div className="text-xs font-mono text-amber-300 px-1">{localize("Постоянные достижения:")}</div>

          <div className="space-y-2">
            {achievements.map(ach => (
              <div
                key={ach.id}
                className="p-3 rounded-xl border border-slate-800 bg-[#0a0f1d] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg border border-[#514633] bg-slate-900">
                    <RpgIcon kind="quest" size={24} className="text-[#b99558]" />
                  </span>
                  <div>
                    <span className="font-cinzel text-xs font-bold text-slate-100">
                      {localize(ach.title)}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {localize(ach.description)}
                    </p>
                    <div className="text-[11px] font-mono text-emerald-400 mt-1">
                      {localize(ach.permanentBonusDesc)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {ach.completed && !ach.claimed ? (
                    <button
                      onClick={() => claimAchievementReward(ach.id)}
                      className="text-[11px] font-mono text-amber-300 font-bold px-2 py-1 bg-amber-950/60 border border-amber-500/40 rounded"
                    >{localize("Забрать")}</button>
                  ) : ach.claimed ? (
                    <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-1 bg-emerald-950/60 border border-emerald-500/40 rounded">{localize("Получено")}</span>
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500">
                      {localize(ach.progress)}/{localize(ach.maxProgress)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS SECTION */}
      {activeSection === 'stats' && (
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-3">
          <span className="font-cinzel text-xs font-bold text-[#d5ba89] uppercase tracking-wider block border-b border-slate-800 pb-2">{localize("Статистика учетной записи:")}</span>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">{localize("Убито монстров:")}</span>
              <span className="text-slate-100 font-bold">{localize(player.statsSummary.monstersKilled)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">{localize("Побеждено боссов:")}</span>
              <span className="text-amber-400 font-bold">{localize(player.statsSummary.bossesDefeated)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">{localize("Побед в боях:")}</span>
              <span className="text-emerald-400 font-bold">{localize(player.statsSummary.battlesWon)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">{localize("Добыто руды в шахтах:")}</span>
              <span className="text-[#d5ba89] font-bold">{localize(player.statsSummary.oresMined)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">{localize("Сварено зелий:")}</span>
              <span className="text-purple-400 font-bold">{localize(player.statsSummary.potionsCrafted)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">{localize("Макс. уровень заточки:")}</span>
              <span className="text-yellow-400 font-bold">+{localize(player.statsSummary.maxUpgradeReached)}</span>
            </div>
          </div>
        </div>
      )}

      {/* LEADERBOARD SECTION */}
      {activeSection === 'leaderboard' && (
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 text-center">
          <RpgIcon kind="arena" size={32} className="mx-auto mb-2 text-amber-400" />
          <div className="font-cinzel text-sm font-bold text-slate-200">{localize("Рейтинг игроков")}</div>
          <p className="text-[11px] text-slate-500 mt-1">{localize("Глобальный рейтинг будет показываться только из серверной базы. Тестовые персонажи больше не используются.")}</p>
        </div>
      )}

      {activeSection === 'premium' && (
        <div className="space-y-3">
          <div className="ui-panel rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <RpgIcon kind="crown" size={20} className="text-yellow-300" />
                  <h3 className="font-cinzel text-base font-bold text-yellow-200">Aethelgard Premium</h3>
                </div>
                <div className="mt-1 text-xs text-slate-300">{localize("150 Telegram Stars / 30 дней · автоматическое продление")}</div>
              </div>
              <span className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${
                premium.active
                  ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}>
                {localize(premium.active ? 'АКТИВЕН' : 'НЕ АКТИВЕН')}
              </span>
            </div>

            {premium.active && premium.premiumUntil && (
              <div className="mt-3 text-[11px] text-emerald-300 font-mono">{localize("Активен до: ")}{localize(new Date(premium.premiumUntil).toLocaleDateString(intlLocale()))}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {[
                ['attack', 'Автобой', 'Сам выполняет ходы в бою.'],
                ['inventory', 'Массовая продажа и разбор', 'Обработка снаряжения по редкости и типу с защитой ценных вещей.'],
                ['hunt', 'Автопродолжение серии', 'Переходит к следующему врагу без нажатий.'],
                ['settings', 'Расширенные настройки автобоя', 'Порог лечения, навыки, ультимейт и отступление.'],
                ['mine', 'Автоматическая офлайн-добыча', 'Пока вас нет, шахтёры собирают руду и материалы по уровню горного дела.'],
                ['crown', 'VIP-статус', 'Premium-метка в игровых сообщениях.']
              ].map(([icon, title, desc]) => (
                <div key={title} className="bestiary-panel flex gap-2.5 p-2.5">
                  <RpgIcon kind={icon as RpgIconKind} size={20} className="text-[#b99558]" />
                  <div>
                    <div className="text-xs font-bold text-slate-100">{localize(title)}</div>
                    <div className="text-[11px] text-slate-400">{localize(desc)}</div>
                  </div>
                </div>
              ))}
            </div>

            {!premium.active && (
              <button
                disabled={premiumBusy || premium.loading}
                onClick={async () => {
                  setPremiumBusy(true);
                  setPremiumFeedback(null);
                  const result = await purchasePremium(preparedPremiumInvoice);
                  setPremiumFeedback(result.message);
                  setPremiumBusy(false);
                }}
                className="ui-primary mt-4 w-full py-3 rounded-xl disabled:opacity-50 font-cinzel font-bold text-sm active:scale-95 transition-all"
              >
                {localize(premiumBusy ? 'Открываю оплату…' : 'Подключить Premium · 150 Stars')}
              </button>
            )}

            {premiumFeedback && (
              <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-[11px] text-slate-300 text-center">
                {localize(premiumFeedback)}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-3">
            <div className="text-xs font-bold text-purple-300 mb-2">{localize("Следующие Premium-функции")}</div>
            <div className="space-y-1 text-[11px] text-slate-400">
              <div>{localize("• Профили автобоя для разных классов и локаций.")}</div>
              <div>{localize("• Массовый разбор и фильтры автолута.")}</div>
              <div>{localize("• Расширенная статистика боёв и добычи.")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Button */}
      {isAdmin && (
        <div className="pt-2">
        <button
          onClick={onOpenAdmin}
          className="w-full py-2.5 px-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 font-cinzel font-bold text-xs flex items-center justify-center gap-2 hover:bg-purple-900/60 active:scale-95 transition-all"
        >
          <RpgIcon kind="settings" size={17} className="text-purple-400" />
          <span>{localize("Панель Администратора")}</span>
        </button>
        </div>
      )}
    </FolioPage>
  );
};
