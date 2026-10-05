import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { STORY_CHAPTERS } from '../../data/storyScenes';
import { useLocale } from '../../i18n/locale';
import { StorySceneViewer } from './StorySceneViewer';

export function AdventureStory() {
  const { player, setAdventureStoryStep, finishAdventureStory, dismissAdventureStory } = useGame();
  const { locale } = useLocale();
  const [error, setError] = useState('');
  const pending = player?.adventureJournal?.pending;
  const chapter = STORY_CHAPTERS.find(chapter => chapter.id === pending?.chapter);
  if (!pending || !chapter) return null;
  return <StorySceneViewer chapter={chapter} index={pending.step} onIndexChange={setAdventureStoryStep} error={error} onCancel={dismissAdventureStory}
    onFinish={() => {
      if (!finishAdventureStory()) setError(locale === 'uk'
        ? 'Не вдалося розпочати бій. Перевір енергію та активну експедицію і спробуй ще раз.'
        : 'Не удалось начать бой. Проверь энергию и активную экспедицию и попробуй ещё раз.');
    }} />;
}
