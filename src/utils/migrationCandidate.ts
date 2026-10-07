import {readAccountSave,readResetVersion} from './accountReset';
import type {ProgressSave} from '../../server/progressValidation';
export const migrationCandidateKey=(owner:string|number,epoch:number)=>`aethelgard_migration_candidate_${owner}_${epoch}`;
export interface MigrationCandidate {ownerId:string;resetVersion:number;raw:string;save:ProgressSave;request?:Record<string,unknown>}
/** The journal is independent of the replaceable confirmed cache. Never infer a legacy epoch from a newer reset. */
export function readMigrationCandidate(owner:string|number,epoch:number):MigrationCandidate|null {
 if(epoch<readResetVersion(owner))return null;
 try {
  const record=JSON.parse(localStorage.getItem(migrationCandidateKey(owner,epoch))||'null');
  if(record?.ownerId===String(owner)&&record.resetVersion===epoch&&String(record.save?.player?.userId)===String(owner)&&record.save?.resetVersion===epoch)return record;
 }catch{}
 return null;
}
export function preserveMigrationCandidate(owner:string|number,epoch:number):MigrationCandidate|null {
 const existing=readMigrationCandidate(owner,epoch);if(existing)return existing;
 const raw=readAccountSave(owner);if(!raw)return null;
 let local:any;try{local=JSON.parse(raw);}catch{return null;}
 {
  // Saves predating epoch tracking are importable only before the first reset.
  const localEpoch=local.resetVersion??0;
  if(!local.player||String(local.player.userId)!==String(owner)||Number.isSafeInteger(local.confirmedVersion)||localEpoch!==epoch||epoch<readResetVersion(owner))return null;
  const record:MigrationCandidate={ownerId:String(owner),resetVersion:epoch,raw,save:{...local,resetVersion:epoch}};
  localStorage.setItem(`aethelgard_migration_backup_${owner}_${epoch}_${Date.now()}`,raw);
  localStorage.setItem(migrationCandidateKey(owner,epoch),JSON.stringify(record));
  return record;
 }
}
export function finishMigrationChoice(owner:string|number,epoch:number){localStorage.removeItem(migrationCandidateKey(owner,epoch));}
