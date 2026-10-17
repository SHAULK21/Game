import {sha256} from '@noble/hashes/sha2.js';
import {hmac} from '@noble/hashes/hmac.js';
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
export function createHash(algorithm: string) {
  if (algorithm !== 'sha256') throw new Error('Unsupported digest.');
  const hash = sha256.create();
  return {
    update(value: string | Uint8Array) {hash.update(typeof value === 'string' ? new TextEncoder().encode(value) : value); return this;},
    digest(format: string) {if (format !== 'hex') throw new Error('Unsupported digest format.'); return hex(hash.digest());},
  };
}
export function randomBytes(size: number) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(size));
  return {toString(format: string) {if (format !== 'hex') throw new Error('Unsupported random format.'); return hex(bytes);}};
}
export function randomUUID() {return globalThis.crypto.randomUUID();}
export function createHmac(algorithm: string, key: string | Uint8Array) {
  if (algorithm !== 'sha256') throw new Error('Unsupported MAC.');
  const state = hmac.create(sha256, typeof key === 'string' ? new TextEncoder().encode(key) : key);
  return {update(value: string) {state.update(new TextEncoder().encode(value)); return this;},
    digest(format: string) {if (format !== 'hex') throw new Error('Unsupported MAC format.'); return hex(state.digest());}};
}
export default {createHash, createHmac, randomBytes, randomUUID};
