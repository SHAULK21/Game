import { useGame } from '../../context/GameContext';
import { StorySceneViewer } from './StorySceneViewer';
import type { StoryChapter } from '../../data/storyScenes';
const chapter: StoryChapter = {
  id: 'flight-warning', ru: 'Цена побега', uk: 'Ціна втечі', scenes: [{
    id: 'flight-warning', imageId: 'royal-order',
    ru: ['В королевстве трусы не в почёте', 'Весть о вашем побеге дошла до короля. Каждый раз, когда вы успешно сбегаете или покидаете незавершённый бой, на следующие 3 боя накладывается «Позор беглеца»: физическая и магическая атака, а также обе защиты снижены на 10%. Повторный побег обновляет срок до 3 боёв. Неудачная попытка побега не накладывает штраф.'],
    uk: ['У королівстві боягузи не в пошані', 'Звістка про вашу втечу дійшла до короля. Щоразу, коли ви успішно тікаєте або залишаєте незавершений бій, на наступні 3 бої накладається «Ганьба втікача»: фізична й магічна атака, а також обидва захисти знижені на 10%. Повторна втеча оновлює строк до 3 боїв. Невдала спроба втечі не накладає штраф.']
  }]
};
export function FlightWarning() {
  const { dismissFlightWarning } = useGame();
  return <StorySceneViewer chapter={chapter} index={0} onIndexChange={() => {}} onFinish={dismissFlightWarning} />;
}
