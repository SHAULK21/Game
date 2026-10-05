import { createContext, useContext, useState } from 'react';
const StoryReplayContext = createContext<(() => void) | null>(null);
export const useStoryReplay = () => useContext(StoryReplayContext);
import { useLocale } from '../../i18n/locale';
import { getTelegramUser } from '../../utils/telegram';
const completionKey = () => 'aethelgard_story_intro_v1_' + getTelegramUser().id;
export function markStoryIntroSeen() { try { localStorage.setItem(completionKey(),'done'); } catch {} }
export function hasSeenStoryIntro() { try { return localStorage.getItem(completionKey()) === 'done'; } catch { return false; } }
export const INTRO_SCENES = [
  {id:'arrival',ru:['Врата Аэтельгарда','Долгая дорога привела тебя к стенам Аэтельгарда. За воротами ещё горят огни, но вокруг замка всё чаще пропадают путники. Сегодня здесь ждут тех, кто готов стать защитником королевства.'],uk:['Брама Аетельгарда','Довга дорога привела тебе до мурів Аетельгарда. За брамою ще горять вогні, але навколо замку дедалі частіше зникають подорожні. Сьогодні тут чекають тих, хто готовий стати захисником королівства.']},
  {id:'courtyard',ru:['Под защитой замка','Стража пропускает тебя во двор. Здесь куют оружие, варят зелья и учат новобранцев. Твоя сила может быть в стали, метком выстреле или магии — королю нужны все, кто способен защитить эти стены.'],uk:['Під захистом замку','Варта пропускає тебе у двір. Тут кують зброю, варять зілля й навчають новобранців. Твоя сила може бути у сталі, влучному пострілі або магії — королю потрібні всі, хто здатен захистити ці мури.']},
  {id:'king',ru:['Слово короля','«Мои рыцари удерживают перевалы, но дороги у замка остаются без защиты. Я не обещаю лёгкого пути. Помоги жителям, докажи свою силу — и Аэтельгард станет твоим домом». Герольд вручает тебе королевскую печать.'],uk:['Слово короля','«Мої лицарі тримають перевали, але дороги біля замку залишаються без захисту. Я не обіцяю легкого шляху. Допоможи жителям, доведи свою силу — і Аетельгард стане твоїм домом». Герольд вручає тобі королівську печатку.']},
  {id:'threat',ru:['Тени за стенами','На Зелёных равнинах волки подбираются к поселениям, а в лесах появляются чужие огни. Дальше ждут пещеры, руины и враги сильнее прежних. Начни с ближайших дорог: даже великая история начинается с первого боя.'],uk:['Тіні за мурами','На Зелених рівнинах вовки підбираються до поселень, а в лісах з’являються чужі вогні. Далі чекають печери, руїни й вороги сильніші за попередніх. Почни з найближчих доріг: навіть велика історія починається з першого бою.']},
  {id:'mission',ru:['Первое поручение','Твой путь начинается с охоты на Зелёных равнинах. Принимай задания, возвращайся за наградой, собирай снаряжение и найди верного спутника. Теперь назови себя и выбери свой путь. Королевство ждёт нового героя.'],uk:['Перше доручення','Твій шлях починається з полювання на Зелених рівнинах. Бери завдання, повертайся по нагороду, збирай спорядження й знайди вірного супутника. Тепер назви себе та обери свій шлях. Королівство чекає нового героя.']}
];
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
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs"><span className="tracking-widest text-[#cfb783]">AETHELGARD · {index+1}/5</span><div className="flex items-center gap-3"><select aria-label={locale==='uk'?'Мова гри':'Язык игры'} value={locale} onChange={e=>setLocale(e.target.value as 'ru'|'uk')} className="min-h-11 rounded border border-[#584a33] bg-[#161b1c] px-2"><option value="uk">Українська</option><option value="ru">Русский</option></select><button onClick={finish} className="min-h-11 text-[#c1b49d] underline underline-offset-4">{locale==='uk'?'Пропустити':'Пропустить'}</button></div></div>
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
