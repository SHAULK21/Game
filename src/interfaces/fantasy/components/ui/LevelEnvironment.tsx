import { t as localize, useLocale } from '../../../../i18n/locale';
import { levelEnvironment } from '../../utils/levelEnvironment';
import { RpgIcon } from './RpgIcon';

export function LevelEnvironment({ level }: { level: number }) {
  useLocale();
  const environment = levelEnvironment(level);
  return (
    <div className={`mt-3 rounded-xl border p-3 ${environment.color}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <RpgIcon kind={environment.icon} size={18} />
        <span>{localize(environment.name)}</span>
      </div>
      <div className="mt-1 text-[11px] opacity-80">{localize("Ваш герой: ")}{localize(level)}{localize(" ур. · Этап: ")}{localize(environment.range)}{localize(" ур.")}</div>
    </div>
  );
}
