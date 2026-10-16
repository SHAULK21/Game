/** Stable across PostgreSQL JSONB key ordering and browser object construction. */
export function canonicalJson(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
