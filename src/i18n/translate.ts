import { SYSTEM_SLOTS } from './systemSlots';
import ukrainian from './uk.json';

export type Locale = 'ru' | 'uk';
export const ukrainianDictionary: Readonly<Record<string, string>> = ukrainian;
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(ukrainianDictionary)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([key, value]) => {
    const slots: string[] = [];
    const parts = normalize(key).split(/(\{\d+\})/);
    const pattern = parts.map(part => /^\{\d+\}$/.test(part) ? (slots.push(part), '(.*?)') : escape(part).replace(/ +/g, '\\s+')).join('');
    return { key, regex: new RegExp('^' + pattern + '$', 's'), value, slots };
  });
const cache = new Map<string, string>();

/** Presentation only. Never use translated values as game IDs, recipe keys or saved names. */
export function translateText(text: string, locale: Locale, depth = 0): string {
  if (locale === 'ru' || depth > 4) return text;
  const key = normalize(text);
  const exact = ukrainianDictionary[key];
  if (exact !== undefined) return preserveSpace(text, exact);
  const cacheKey = text.trim();
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return preserveSpace(text, cached);
  let translated: string | undefined;
  for (const template of templates) {
    const match = template.regex.exec(text.trim());
    if (!match) continue;
    const system = SYSTEM_SLOTS[template.key] ?? [];
    const values = new Map(template.slots.map((slot, index) => [slot,
      system.includes(Number(slot.slice(1, -1))) ? translateText(match[index + 1], locale, depth + 1) : match[index + 1]]));
    translated = template.value.replace(/\{\d+\}/g, slot => values.get(slot) ?? slot);
    break;
  }
  if (translated === undefined && key.startsWith('Error: ')) translated = 'Error: ' + translateText(text.trim().slice(7), locale, depth + 1);
  if (translated === undefined && / \(HTTP \d+\)$/.test(key)) {
    const suffix = key.match(/ \(HTTP \d+\)$/)![0];
    translated = translateText(text.trim().slice(0, -suffix.length), locale, depth + 1) + suffix;
  }
  // Broadcast additions are authored by the administrator, not translation keys.
  if (translated === undefined && text.includes('\n\n')) {
    const split = text.indexOf('\n\n');
    const first = text.slice(0, split);
    if (ukrainianDictionary[normalize(first)] !== undefined)
      translated = translateText(first, locale, depth + 1) + text.slice(split);
  }
  if (translated === undefined) return text;
  if (cache.size >= 2000) cache.clear();
  cache.set(cacheKey, translated.trim());
  return preserveSpace(text, translated.trim());
}
function preserveSpace(original: string, translated: string) {
  return (original.match(/^\s*/)?.[0] ?? '') + translated + (original.match(/\s*$/)?.[0] ?? '');
}
