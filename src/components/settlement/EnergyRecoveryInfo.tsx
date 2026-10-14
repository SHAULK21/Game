import { useLocale } from '../../i18n/locale';
import { BEER_ENERGY, INTOXICATION_PER_MUG } from '../../utils/tavernBeer';
export function EnergyRecoveryInfo({ onTavern }: { onTavern?: () => void }) {
  const { locale } = useLocale();
  return <div className="energy-recovery-info text-xs leading-relaxed">
    <p>{locale === 'uk' ? `Енергія відновлюється сама. Пиво в таверні: +${BEER_ENERGY} енергії безкоштовно, але −${INTOXICATION_PER_MUG}% атаки й захисту за кухоль. Знімає «Ганьбу втікача».` : `Энергия восстанавливается сама. Пиво в таверне: +${BEER_ENERGY} энергии бесплатно, но −${INTOXICATION_PER_MUG}% атаки и защиты за кружку. Снимает «Позор беглеца».`}</p>
    {onTavern && <button type="button" onClick={onTavern} className="mt-2 min-h-11 rounded-lg border px-4">{locale === 'uk' ? 'До таверни в поселенні' : 'В таверну в поселении'}</button>}
  </div>;
}
