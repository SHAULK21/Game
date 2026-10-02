import type { Skill } from '../../types/game';
import { useLocale, t } from '../../i18n/locale';
import { skillDetails } from '../../utils/skillDetails';

export function SkillDetails({ skill }: { skill: Skill }) {
  const { locale } = useLocale();
  return <div className="mt-1 space-y-1 text-[11px] leading-relaxed text-slate-400" data-skill-details={skill.id}>
    {skillDetails(skill, locale).map((line,i)=><p key={i}>{line}</p>)}
    <p className="text-slate-500">{t('Указаны базовые параметры; таланты, пассивки и ступень развития могут усилить навык и снизить расход маны.')}</p>
  </div>;
}
