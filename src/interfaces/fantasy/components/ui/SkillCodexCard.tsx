import { BookOpen, Clock3, Droplets, Flame, HeartPulse, Leaf, ScrollText, Shield, Skull, Snowflake, Sparkles, Swords, Zap } from 'lucide-react';
import type { Skill } from '../../../../types/game';
import { useLocale, t } from '../../../../i18n/locale';
import { skillDetails } from '../../../../utils/skillDetails';

export function SkillCodexCard({ skill }: { skill: Skill }) {
  const { locale } = useLocale();
  const Icon = skill.poisonBurst ? Skull : skill.healMultiplier ? HeartPulse : skill.damageMultiplier === 0 ? Shield
    : skill.id.includes('curse') ? BookOpen : ({fire:Flame,ice:Snowflake,lightning:Zap,dark:Skull,poison:Leaf,holy:Sparkles,physical:Swords,magic:BookOpen,true:Droplets})[skill.damageType];
  const tone = skill.healMultiplier ? 'blood' : skill.damageMultiplier === 0 ? 'guard' : skill.damageType;
  return <section className={`skill-codex-card is-${tone}`} data-skill-details={skill.id}>
    <div className="skill-codex-art" aria-hidden="true"><Icon strokeWidth={1.35} /><span className="skill-codex-diamond" /></div>
    <div className="skill-codex-copy">
      <header><h3>{t(skill.name)}</h3><span>{t('Уровень ')}{skill.levelReq}</span></header>
      <div className="skill-codex-lines">{skillDetails(skill,locale).map((line,i)=>{
        const RowIcon=i===0?Clock3:i===1&&skill.damageMultiplier>0?Swords:ScrollText;
        return <p key={i}><RowIcon aria-hidden="true"/><span>{line}</span></p>;
      })}</div>
    </div>
  </section>;
}
