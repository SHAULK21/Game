import { levelEnvironment } from '../../utils/levelEnvironment';

export function LevelEnvironment({ level }: { level: number }) {
  const environment = levelEnvironment(level);
  return (
    <div className={`mt-3 rounded-xl border p-3 ${environment.color}`}>
      <div className="flex items-center gap-2 text-sm font-bold">
        <span aria-hidden="true">{environment.icon}</span>
        <span>{environment.name}</span>
      </div>
      <div className="mt-1 text-[11px] opacity-80">Ваш герой: {level} ур. · Этап: {environment.range} ур.</div>
    </div>
  );
}
