import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { STORY_CHAPTERS } from '../../data/storyScenes';
import { availableAdventureChapters } from '../../utils/adventureJournal';
import { useLocale } from '../../i18n/locale';
import { StorySceneViewer } from '../dialogs/StorySceneViewer';

export function AdventureJournal() {
  const { player, isInCombat, isCombatEnded } = useGame();
  const { locale } = useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  if (!player) return null;
  const available = availableAdventureChapters(player);
  const chapter = STORY_CHAPTERS.find(chapter => chapter.id === selected);
  const battleActive = isInCombat && !isCombatEnded;
  return <section aria-label={locale === 'uk' ? 'Журнал пригод' : 'Журнал приключений'} className="space-y-3">
    <div className="ui-panel rounded-xl border p-4">
      <h2 className="font-cinzel text-base font-bold text-[#e8c889]">{locale === 'uk' ? 'Журнал пригод' : 'Журнал приключений'}</h2>
      <p className="mt-2 text-xs text-slate-400">{locale === 'uk'
        ? 'Переглядай відкриті сюжетні сцени. Нові розділи з’являються під час пригод.'
        : 'Пересматривай открытые сюжетные сцены. Новые главы появляются по ходу приключений.'}</p>
    </div>
    {battleActive && <p className="text-xs text-amber-300">{locale === 'uk' ? 'Заверши бій, щоб переглянути історію.' : 'Заверши бой, чтобы пересмотреть историю.'}</p>}
    {STORY_CHAPTERS.map(chapter => {
      const unlocked = available.includes(chapter.id);
      return <button key={chapter.id} disabled={!unlocked || battleActive} onClick={() => { setIndex(0); setSelected(chapter.id); }}
        className="ui-panel flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border p-4 text-left disabled:opacity-50">
        <span className="text-sm font-bold text-[#d5c9b4]">{chapter[locale]}</span>
        <span className="shrink-0 text-xs text-[#cfb783]">{unlocked
          ? (locale === 'uk' ? 'Переглянути' : 'Смотреть') : (locale === 'uk' ? 'Ще не відкрито' : 'Ещё не открыто')}</span>
      </button>;
    })}
    {chapter && available.includes(chapter.id) && !battleActive && <StorySceneViewer replay chapter={chapter} index={index}
      onIndexChange={setIndex} onFinish={() => setSelected(null)} />}
  </section>;
}
