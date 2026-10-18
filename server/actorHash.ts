import crypto from 'node:crypto';
// Native builds replace only this actor-specific entry. Authentication and
// economic operation hashes retain their existing implementation.
export const hashActorText=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
export const actorHashMode=()=>'typescript';
