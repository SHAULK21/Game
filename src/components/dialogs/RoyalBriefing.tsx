import {useGame} from '../../context/GameContext';
import {useLocale} from '../../i18n/locale';
import {useState} from 'react';
export const ROYAL_SCENES=[
 {id:'royal-order',ru:['Первое поручение короля','«Первое испытание позади. Теперь мне нужен твой взгляд за стенами замка. Соберись и отправляйся на Зелёные равнины — проверь дорогу к поселениям». Король вручает тебе запечатанный приказ. В квестах появилось «Первое поручение короля».'],uk:['Перше доручення короля','«Перше випробування позаду. Тепер мені потрібен твій погляд за мурами замку. Зберися та вирушай на Зелені рівнини — перевір дорогу до поселень». Король вручає тобі запечатаний наказ. У квестах з’явилося «Перше доручення короля».']},
 {id:'royal-preparation',ru:['Собраться в дорогу','Сначала распредели свободные очки в Кодексе персонажа. Затем выбери, как идти на Зелёные равнины: способы похода отличаются расходом энергии, шансом засады и наградами. Подготовься — за воротами начинается твой путь.'],uk:['Зібратися в дорогу','Спочатку розподіли вільні очки в Кодексі персонажа. Потім обери, як іти на Зелені рівнини: способи походу відрізняються витратами енергії, шансом засідки та нагородами. Підготуйся — за воротами починається твій шлях.']},
 {id:'royal-reward',ru:['Награда за поручение','Когда доберёшься до Зелёных равнин, первое поручение будет выполнено. Открой квесты в меню «Ещё» (в фэнтези — раздел «Журнал») и нажми «Забрать»: королевский писарь выдаст 120 золота, 80 серебра и 75 опыта. Награда ждёт тебя в квестах — не забудь её получить.'],uk:['Нагорода за доручення','Коли дістанешся Зелених рівнин, перше доручення буде виконано. Відкрий квести в меню «Ще» (у фентезі — розділ «Журнал») і натисни «Забрати»: королівський писар видасть 120 золота, 80 срібла та 75 досвіду. Нагорода чекає на тебе у квестах — не забудь її отримати.']}
];
export function RoyalBriefing() {
 const {player,advanceRoyalBriefing}=useGame();const {locale}=useLocale();const [failed,setFailed]=useState<string[]>([]);
 if(player?.firstJourney!=='briefing')return null;
 const index=Math.min(2,Math.max(0,player.royalBriefingStep||0)),scene=ROYAL_SCENES[index];const [title,text]=scene[locale];
 return <main className="royal-briefing min-h-dvh bg-[#0b1013] px-3 py-4 text-[#e8dcc5] sm:grid sm:place-items-center">
  <section aria-label={locale==='uk'?'Доручення короля':'Поручение короля'} className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#725936] bg-[#151817] shadow-xl">
   <div className="px-5 py-3 text-xs tracking-widest text-[#cfb783]">AETHELGARD · {index+1}/3</div>
   <div className="aspect-[3/2] w-full overflow-hidden bg-[#211d17]">{!failed.includes(scene.id)&&<img key={scene.id} src={`/assets/story/${scene.id}.webp`} alt="" className="h-full w-full object-cover" onError={()=>setFailed(old=>[...old,scene.id])}/>}</div>
   <div aria-live="polite" className="px-5 py-5 sm:px-7"><h1 className="mb-3 font-serif text-2xl font-bold text-[#e8c889]">{title}</h1><p className="text-sm leading-7 text-[#d5c9b4] sm:text-base">{text}</p></div>
   <div className="flex items-center justify-between gap-4 px-5 pb-5"><span aria-hidden="true" className="flex gap-1.5">{ROYAL_SCENES.map((s,i)=><span key={s.id} className={`h-1.5 w-1.5 rounded-full ${i===index?'bg-[#d7b46f]':'bg-[#5d513e]'}`}/>)}</span><button onClick={advanceRoyalBriefing} className="min-h-11 rounded-lg border border-[#c39b55] bg-[#594022] px-4 text-sm font-bold text-[#ffdfa1]">{locale==='uk'?(index===2?'Відкрити Кодекс':'Далі'):(index===2?'Открыть Кодекс':'Далее')}</button></div>
  </section>
 </main>;
}
