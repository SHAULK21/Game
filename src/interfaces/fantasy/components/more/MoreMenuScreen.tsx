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
    <FolioPage className="fantasy-more-menu space-y-3 pt-3">
      <div className="journal-sound flex items-center justify-between gap-3 rounded-xl border border-[#35383a] bg-[#111416] px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-[#aaa49a]"><RpgIcon kind="settings" size={17} /><span>{localize("Настройки звука")}</span></div>
        <button className="rpg-button rpg-button-secondary min-h-10 px-3 text-xs" onClick={() => setIsMuted(sound.toggleMute())}>{localize(isMuted ? 'Звук выключен' : 'Звук включён')}</button>
      </div>
      {/* Navigation Sub-Tabs */}
      <div className="journal-tabs grid grid-cols-3 gap-1.5 text-[11px] font-cinzel font-bold">
        <button
          aria-pressed={activeSection === 'quests'} onClick={() => setActiveSection('quests')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'quests'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Квесты")}</button>

        <button
          aria-pressed={activeSection === 'achievements'} onClick={() => setActiveSection('achievements')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'achievements'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Достижения")}</button>

        <button
          aria-pressed={activeSection === 'stats'} onClick={() => setActiveSection('stats')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'stats'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Статистика")}</button>

        <button
          aria-pressed={activeSection === 'leaderboard'} onClick={() => setActiveSection('leaderboard')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'leaderboard'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >{localize("Рейтинг")}</button>

        <button
          aria-pressed={activeSection === 'premium'} onClick={() => setActiveSection('premium')}
          className={`py-2 px-1 text-center rounded-lg border transition-all ${
            activeSection === 'premium'
              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 shadow-sm'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          Premium
        </button>
        <button aria-pressed={activeSection === 'notifications'} onClick={() => setActiveSection('notifications')} className={`min-h-11 flex items-center justify-center gap-1 py-2 px-1 rounded-lg border ${activeSection==='notifications'?'bg-cyan-950 text-cyan-200':'bg-slate-900 text-slate-400'}`}><RpgIcon kind="quest" size={15} />{localize("Оповещения")}</button>
      </div>
      {activeSection === 'notifications' && <NotificationsPanel />}

      {/* Quest manuscript uses the same reward actions and live quest data. */}
      {activeSection === 'quests' && (
        <section className="quest-book" aria-label={localize("Журнал заданий:")}>
          <header className="quest-book-heading">
            <h1>{localize("Квесты")}</h1>
            <span role="status">{localize(quests.filter(q => q.completed && !q.claimed).length)}{localize(" готово к сдаче")}</span>
          </header>
          {quests.map(q => {
            const pct = q.targetCount > 0 ? Math.max(0, Math.min(100, Math.round((q.currentCount / q.targetCount) * 100))) : 0;
            return (
              <article key={q.id} data-quest-id={q.id} className={`quest-entry${q.claimed ? ' is-claimed' : q.completed ? ' is-ready' : ''}`}>
                <div className="quest-entry-heading">
                  <h2>{localize(q.title)}</h2>
                  <span className="quest-category">{localize({ story: 'Сюжет', daily: 'Ежедневные', hunting: 'Охота', mining: 'Шахта', boss: 'Босс' }[q.category])}</span>
                </div>
                <p className="quest-description">{localize(q.description)}</p>
                <div className="quest-progress-row">
                  <progress aria-label={localize(q.title)} value={pct} max={100} />
                  <span>{localize(q.currentCount)}/{localize(q.targetCount)}</span>
                </div>
                <div className="quest-rewards">
                  <span>{localize("Награда:")}</span>
                  <ResourceBadge kind="gold" value={`+${q.rewardGold}`} />
                  <ResourceBadge kind="silver" value={`+${q.rewardSilver || 0}`} />
                  <strong>+{localize(q.rewardExp)} EXP</strong>
                </div>
                {q.claimed ? (
                  <span className="quest-claimed">{localize("Сдано")}</span>
                ) : q.completed && (
                  <button className="quest-claim" onClick={() => claimQuestReward(q.id)}>{localize("Забрать")}</button>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* Permanent achievements in the same parchment journal. */}
      {activeSection === 'achievements' && (
        <section className="achievement-book quest-book" aria-label={localize("Постоянные достижения:")}>
          <div className="quest-book-heading"><h1>{localize("Достижения")}</h1></div>
          {achievements.map(ach => (
            <article key={ach.id} data-achievement-id={ach.id} className={`quest-entry${ach.claimed ? ' is-claimed' : ach.completed ? ' is-ready' : ''}`}>
              <div className="achievement-heading"><RpgIcon kind="quest" size={24} /><h2>{localize(ach.title)}</h2></div>
              <p className="quest-description">{localize(ach.description)}</p>
              <p className="achievement-bonus">{localize(ach.permanentBonusDesc)}</p>
              {ach.claimed ? (
                <span className="quest-claimed">{localize("Получено")}</span>
              ) : ach.completed ? (
                <button className="quest-claim" onClick={() => claimAchievementReward(ach.id)}>{localize("Забрать")}</button>
              ) : (
                <div className="quest-progress-row">
                  <progress aria-label={localize(ach.title)} value={Math.max(0, Math.min(ach.progress, ach.maxProgress))} max={Math.max(1, ach.maxProgress)} />
                  <span>{localize(ach.progress)}/{localize(ach.maxProgress)}</span>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {activeSection === 'stats' && (
        <section className="stats-book quest-book" aria-label={localize("Статистика учетной записи:")}>
          <div className="quest-book-heading"><h1>{localize("Статистика учетной записи:")}</h1></div>
          <dl className="stats-ledger">
            {[
              ['Убито монстров:', player.statsSummary.monstersKilled],
              ['Побеждено боссов:', player.statsSummary.bossesDefeated],
              ['Побед в боях:', player.statsSummary.battlesWon],
              ['Добыто руды в шахтах:', player.statsSummary.oresMined],
              ['Сварено зелий:', player.statsSummary.potionsCrafted],
              ['Макс. уровень заточки:', `+${player.statsSummary.maxUpgradeReached}`]
            ].map(([label, value]) => (
              <div key={label}><dt>{localize(label)}</dt><dd>{localize(value)}</dd></div>
            ))}
          </dl>
        </section>
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
          className="journal-admin min-h-11 w-full flex items-center justify-center gap-2"
        >
          <RpgIcon kind="settings" size={17} />
          <span>{localize("Панель Администратора")}</span>
        </button>
        </div>
      )}
    </FolioPage>
  );
};
