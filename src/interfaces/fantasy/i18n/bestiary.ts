import { getLanguage, t } from '../../../i18n/locale';
import ukrainian from './bestiary.uk.json';

// These new labels belong to the fantasy bestiary; shared translations stay unchanged.
export function localizeBestiary<T>(value: T): T {
  if (typeof value !== 'string' || getLanguage() !== 'uk') return t(value);
  const translated = (ukrainian as Readonly<Record<string, string>>)[value];
  return translated === undefined ? t(value) : translated as T;
}
