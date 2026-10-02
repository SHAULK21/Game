import { t } from './locale';
/** Translate the action between known fighter names, never the names themselves. */
export function localizeDuelLog(line: string, attackerName: string, defenderName: string) {
  const round = line.match(/^\d+\. /)?.[0];
  if (!round) return line;
  for (const [actor, target] of [[attackerName, defenderName], [defenderName, attackerName]]) {
    const prefix = `${round}${actor}: `;
    const tail = line.match(/\d+ HP\.$/)?.[0];
    if (!tail) continue;
    const suffix = `. ${target}: ${tail}`;
    if (!line.startsWith(prefix) || !line.endsWith(suffix)) continue;
    const action = line.slice(prefix.length, -suffix.length);
    if (action === 'промах') return prefix + t(action) + suffix;
    const damage = action.match(/^(приём · )?(\d+) урона( · крит)?$/);
    if (damage) return prefix + (damage[1] ? t('приём ·') + ' ' : '') + damage[2] + ' ' + t('урона') + (damage[3] ? ' · ' + t('крит') : '') + suffix;
  }
  return line;
}
