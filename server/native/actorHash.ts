import {sha256} from '@noble/hashes/sha2.js';
import {initSync,actor_sha256} from './hash-generated/actor_hash.js';
import {actorHashHex} from './hash-generated/bytes';
declare const __ACTOR_WASM_HASH__:boolean;
const encoder=new TextEncoder(),digits='0123456789abcdef';
const hex=(bytes:Uint8Array)=>{let text='';for(const byte of bytes)text+=digits[byte>>4]+digits[byte&15];return text;};
type HashModule={actor_sha256(input:Uint8Array):Uint8Array};
function loadHash():HashModule{
 const bytes=new Uint8Array(actorHashHex.length/2);
 for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(actorHashHex.slice(i*2,i*2+2),16);
 initSync({module:bytes});return {actor_sha256};
}
/** Only actor dependency fingerprints. Never used for auth, HMAC or receipts.
 * One bounded lazy init per isolate; any unavailable runtime uses the same SHA-256 in JS. */
export function createActorTextHasher({enabled=false,threshold=4096,load=loadHash}:{enabled?:boolean;threshold?:number;load?:()=>HashModule}={}){
 let module:HashModule|null|undefined;
 const hash=(text:string)=>{
  const bytes=encoder.encode(text);
  if(enabled&&bytes.length>=threshold&&bytes.length<=4*1024*1024){
   if(module===undefined){
    try{const candidate=load();
     if(hex(candidate.actor_sha256(encoder.encode('abc')))!=='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')throw new Error('SHA-256 self-test failed');
     module=candidate;
    }catch{module=null;}
   }
   if(module)try{const digest=module.actor_sha256(bytes);if(digest.length!==32)throw new Error('Invalid digest');return hex(digest);}catch{module=null;}
  }
  return hex(sha256(bytes));
 };
 return {hash,mode:()=>module?'rust':module===null?'fallback':'uninitialized'};
}
const backend=createActorTextHasher({enabled:typeof __ACTOR_WASM_HASH__!=='undefined'&&__ACTOR_WASM_HASH__});
export const hashActorText=backend.hash;
export const actorHashMode=backend.mode;
