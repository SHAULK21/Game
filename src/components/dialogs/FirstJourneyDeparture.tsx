import { useGame } from '../../context/GameContext';
import { useNavigation } from '../../context/NavigationContext';
import { useInterface } from '../../context/InterfaceContext';
import { useLocale } from '../../i18n/locale';
import { MapPin, Footprints, ArrowRight, BookOpen } from 'lucide-react';

export function FirstJourneyDeparture() {
  const {player,travelState,startFirstJourneyDeparture} = useGame();
  const {setIsCharacterSheetOpen} = useNavigation();
  const {style} = useInterface();
  const {locale} = useLocale();
  if (!player) return null;
  const uk = locale === 'uk';
  const traveling = Boolean(player.firstJourneyDepartureStartedAt);
  const fantasy = style === 'fantasy';
  const remaining = player.statPoints > 0;
  return <main className={`min-h-dvh w-full mx-auto px-4 py-6 flex items-center justify-center ${style==='fantasy'?'folio-page':'bg-slate-950'}`}>
    <section aria-labelledby="first-departure-title" className={`w-full max-w-md overflow-hidden ${style==='fantasy'?'quest-book':'rounded-2xl border border-slate-700 bg-slate-900'}`}>
      <img src={traveling?'/assets/story/mission.webp':'/assets/story/courtyard.webp'} alt="" className="w-full aspect-[3/2] object-cover" />
      <div className="p-5 space-y-4">
        <p className={`flex items-center gap-2 text-xs uppercase tracking-wider ${fantasy?'text-[#75532f]':'text-amber-300'}`}><MapPin size={16}/>{uk?'Подвір’я замку':'Двор замка'}</p>
        <h1 id="first-departure-title" className={`text-2xl font-bold ${fantasy?'text-[#39291b]':'text-amber-100'}`}>{uk?'Перше доручення короля':'Первое поручение короля'}</h1>
        <p className={`text-sm leading-relaxed ${fantasy?'text-[#4b3928]':'text-slate-200'}`}>{uk?'Король доручив оглянути Зелені рівнини за мурами замку. Там почнеться твій перший похід.':'Король поручил осмотреть Зелёные равнины за стенами замка. Там начнётся твой первый поход.'}</p>
        {traveling ? <div className="space-y-3">
          <p role="status" className={`flex items-center gap-2 text-sm ${fantasy?'text-[#75532f]':'text-amber-200'}`}><Footprints size={18}/>{uk?'Ти вирушаєш на Зелені рівнини…':'Вы отправляетесь на Зелёные равнины…'}</p>
          <div role="progressbar" aria-label={uk?'Шлях до Зелених рівнин':'Путь на Зелёные равнины'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={travelState.progress} className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full bg-amber-500 transition-[width]" style={{width:`${travelState.progress}%`}}/></div>
        </div> : <>
          {remaining && <p className={`text-sm ${fantasy?'text-[#75532f]':'text-amber-200'}`}>{uk?'Перед виходом розподіли всі вільні очки характеристик.':'Перед выходом распредели все свободные очки характеристик.'}</p>}
          <button onClick={remaining?()=>setIsCharacterSheetOpen(true):startFirstJourneyDeparture} className={`flex min-h-12 w-full items-center justify-center gap-2 text-sm font-bold ${style==='fantasy'?'rpg-button rpg-button-primary':'rounded-xl bg-amber-500 px-4 text-slate-950'}`}>
            {remaining?<BookOpen size={18}/>:<ArrowRight size={18}/>}{remaining?(uk?'Розподілити характеристики':'Распределить характеристики'):(uk?'Вирушити на Зелені рівнини':'Отправиться на Зелёные равнины')}
          </button>
        </>}
      </div>
    </section>
  </main>;
}
