// Telegram's V8 sandbox currently has no structuredClone global.
export function clone<T>(input: T, seen = new Map<any, any>()): T {
  if (typeof input === 'function' || typeof input === 'symbol') throw new Error('Value is not cloneable.');
  if (!input || typeof input !== 'object') return input;
  if (seen.has(input)) return seen.get(input);
  if (input instanceof Date) return new Date(input.getTime()) as T;
  if (input instanceof RegExp) return new RegExp(input.source, input.flags) as T;
  if (input instanceof ArrayBuffer) return input.slice(0) as T;
  if (ArrayBuffer.isView(input)) {
    const bytes = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    return (input instanceof DataView ? new DataView(bytes) : new (input.constructor as any)(bytes)) as T;
  }
  if (input instanceof Map) {
    const output = new Map(); seen.set(input, output);
    for (const [key, value] of input) output.set(clone(key, seen), clone(value, seen));
    return output as T;
  }
  if (input instanceof Set) {
    const output = new Set(); seen.set(input, output);
    for (const value of input) output.add(clone(value, seen));
    return output as T;
  }
  const output: any = Array.isArray(input) ? [] : {}; seen.set(input, output);
  for (const key of Object.keys(input)) Object.defineProperty(output, key, {
    value: clone((input as any)[key], seen), enumerable: true, writable: true, configurable: true,
  });
  return output;
}
if (!globalThis.structuredClone) globalThis.structuredClone = (value, options) => {
  if (options?.transfer?.length) throw new Error('Transferable objects are not supported.');
  return clone(value);
};
