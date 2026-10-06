import { SelectionField } from '../ui/SelectionField';
import { INTRO_SCENES } from '../../data/storyScenes';
export { INTRO_SCENES } from '../../data/storyScenes';
import { createContext, useContext, useState } from 'react';
const StoryReplayContext = createContext<(() => void) | null>(null);
export const useStoryReplay = () => useContext(StoryReplayContext);
import { useLocale } from '../../i18n/locale';
import { getTelegramUser } from '../../utils/telegram';
const completionKey = () => 'aethelgard_story_intro_v1_' + getTelegramUser().id;
export function markStoryIntroSeen() { try { localStorage.setItem(completionKey(),'done'); } catch {} }
export function hasSeenStoryIntro() { try { return localStorage.getItem(completionKey()) === 'done'; } catch { return false; } }

export function StoryIntro({onFinish}: {onFinish:()=>void}) {
  const {locale,setLocale} = useLocale();
  const [index,setIndex] = useState(0);
  const [failed,setFailed] = useState<string[]>([]);
  const scene = INTRO_SCENES[index];
  const [title,text] = scene[locale];
  const last = index === INTRO_SCENES.length - 1;
  const finish = () => {markStoryIntroSeen();onFinish();};
  return <main className="story-intro min-h-dvh bg-[#0b1013] px-3 py-4 text-[#e8dcc5] sm:grid sm:place-items-center">
    <section aria-label={locale==='uk'?'Історія Аетельгарда':'История Аэтельгарда'} className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#725936] bg-[#151817] shadow-xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs"><span className="tracking-widest text-[#cfb783]">AETHELGARD · {index+1}/5</span><div className="flex items-center gap-3"><SelectionField aria-label={locale==='uk'?'Мова гри':'Язык игры'} value={locale} onChange={e=>setLocale(e.target.value as 'ru'|'uk')} className="min-h-11 rounded border border-[#584a33] bg-[#161b1c] px-2"><option value="uk">Українська</option><option value="ru">Русский</option></SelectionField><button onClick={finish} className="min-h-11 text-[#c1b49d] underline underline-offset-4">{locale==='uk'?'Пропустити':'Пропустить'}</button></div></div>
      <div className="aspect-[3/2] w-full overflow-hidden bg-[#211d17]">
        {!failed.includes(scene.id) && <img key={scene.id} src={`/assets/story/${scene.id}.webp`} alt="" className="h-full w-full object-cover" onError={()=>setFailed(old=>old.includes(scene.id)?old:[...old,scene.id])}/>}
      </div>
      <div aria-live="polite" className="px-5 py-5 sm:px-7"><h1 className="mb-3 font-serif text-2xl font-bold text-[#e8c889]">{title}</h1><p className="text-sm leading-7 text-[#d5c9b4] sm:text-base">{text}</p></div>
      <div className="flex items-center justify-between gap-3 px-5 pb-5"><button disabled={index===0} onClick={()=>setIndex(i=>i-1)} className="min-h-11 rounded-lg border border-[#655238] px-4 text-sm disabled:opacity-30">{locale==='uk'?'Назад':'Назад'}</button><span aria-hidden="true" className="flex gap-1.5">{INTRO_SCENES.map((s,i)=><span key={s.id} className={`h-1.5 w-1.5 rounded-full ${i===index?'bg-[#d7b46f]':'bg-[#5d513e]'}`}/>)}</span><button onClick={()=>last?finish():setIndex(i=>i+1)} className="min-h-11 rounded-lg border border-[#c39b55] bg-[#594022] px-4 text-sm font-bold text-[#ffdfa1]">{locale==='uk'?(last?'Створити героя':'Далі'):(last?'Создать героя':'Далее')}</button></div>
    </section>
  </main>;
}
export function StoryRegistration({children}: {children: React.ReactNode}) {
  const [seen,setSeen] = useState(hasSeenStoryIntro);
  return <StoryReplayContext.Provider value={()=>setSeen(false)}>
    <div hidden={!seen}>{children}</div>
    {!seen && <StoryIntro onFinish={()=>setSeen(true)}/>}
  </StoryReplayContext.Provider>;
}
