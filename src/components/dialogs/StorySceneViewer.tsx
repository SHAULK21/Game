import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../i18n/locale';
import type { StoryChapter } from '../../data/storyScenes';

interface Props {
  chapter: StoryChapter;
  index: number;
  onIndexChange: (index: number) => void;
  onFinish: () => void;
  replay?: boolean;
  error?: string;
  onCancel?: () => void;
}

/** Shared reader; replay callbacks only close it and never mutate quest/combat state. */
export function StorySceneViewer({ chapter, index, onIndexChange, onFinish, replay = false, error, onCancel }: Props) {
  const { locale } = useLocale();
  const panel = useRef<HTMLDivElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const [failed, setFailed] = useState<string[]>([]);
  const safeIndex = Math.max(0, Math.min(chapter.scenes.length - 1, index));
  const scene = chapter.scenes[safeIndex];
  const [title, text] = scene[locale];
  const last = safeIndex === chapter.scenes.length - 1;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish.current(); }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
      const first = buttons[0], end = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); end?.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#080c10]/95 p-3 text-[#e8dcc5] sm:p-6">
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={chapter[locale]}
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#725936] bg-[#151817] shadow-xl outline-none">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
        <span className="tracking-widest text-[#cfb783]">{chapter[locale]} · {safeIndex + 1}/{chapter.scenes.length}</span>
        <button onClick={onFinish} className="min-h-11 shrink-0 text-[#c1b49d] underline underline-offset-4">
          {replay ? (locale === 'uk' ? 'Закрити' : 'Закрыть') : (locale === 'uk' ? 'Пропустити' : 'Пропустить')}
        </button>
      </div>
      <div className="aspect-[3/2] overflow-hidden bg-[#211d17]">
        {!failed.includes(scene.id) && <img key={scene.id} src={`/assets/story/${scene.imageId || scene.id}.webp`} alt=""
          className="h-full w-full object-cover" onError={() => setFailed(ids => [...ids, scene.id])} />}
      </div>
      <div aria-live="polite" className="px-5 py-5 sm:px-7">
        <h2 className="mb-3 font-serif text-2xl font-bold text-[#e8c889]">{title}</h2>
        <p className="text-sm leading-7 text-[#d5c9b4] sm:text-base">{text}</p>
        {error && <div className="mt-3">
          <p role="alert" className="text-sm text-rose-300">{error}</p>
          {onCancel && <button onClick={onCancel} className="mt-2 min-h-11 rounded-lg border border-[#655238] px-4 text-sm">
            {locale === 'uk' ? 'Повернутися до гри' : 'Вернуться в игру'}
          </button>}
        </div>}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-5">
        <button disabled={safeIndex === 0} onClick={() => onIndexChange(safeIndex - 1)}
          className="min-h-11 rounded-lg border border-[#655238] px-4 text-sm disabled:opacity-30">Назад</button>
        <button onClick={() => last ? onFinish() : onIndexChange(safeIndex + 1)}
          className="min-h-11 rounded-lg border border-[#c39b55] bg-[#594022] px-4 text-sm font-bold text-[#ffdfa1]">
          {last ? (replay ? (locale === 'uk' ? 'До журналу' : 'К журналу')
            : chapter.id === 'first-boss' ? (locale === 'uk' ? 'До бою' : 'К бою')
              : (locale === 'uk' ? 'Продовжити пригоду' : 'Продолжить приключение'))
            : (locale === 'uk' ? 'Далі' : 'Далее')}
        </button>
      </div>
    </div>
  </div>;
}
