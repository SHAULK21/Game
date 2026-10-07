import {canonicalJson} from '../src/utils/canonicalJson';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { ProgressError, validateProgress, type ProgressSave } from './progressValidation';
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const hash = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export interface ProgressEnvelope { ownerId: string; resetVersion: number; version: number; save: ProgressSave | null; activeHere: boolean; sessionGeneration: number; migrationOpen: boolean }
export async function projectProgress(client: Pick<PoolClient,'query'>, row: any, token: string): Promise<ProgressEnvelope> {
  const save = row.progress_json ? structuredClone(row.progress_json) as ProgressSave : null;
  if (save) {
    // The JSON partition never contains ledger items, even when a caller forgot the marker.
    const rows = (await client.query('SELECT id,item_json,quantity,locked,bound_clan_id,equipped_slot,origin FROM owned_items WHERE owner_telegram_id=$1 ORDER BY id',[row.telegram_id])).rows;
    const ids = new Set(rows.map(i=>String(i.id)));
    save.player.inventory = save.player.inventory.filter(i=>!i.serverOwned && !ids.has(i.id));
    for (const [slot,item] of Object.entries(save.player.equipped)) if (item?.serverOwned || ids.has(item?.id)) delete save.player.equipped[slot as keyof typeof save.player.equipped];
    for (const item of rows) {
      const projected = {...item.item_json,id:item.id,stackCount:Number(item.quantity),isLocked:item.locked,boundToClan:item.bound_clan_id || undefined,serverOwned:true,marketTradable:item.origin !== 'legacy_market_return',isEquipped:Boolean(item.equipped_slot)};
      if (item.equipped_slot) {
        const displaced=save.player.equipped[item.equipped_slot as keyof typeof save.player.equipped];
        if (displaced) save.player.inventory.push({...displaced,isEquipped:false});
        save.player.equipped[item.equipped_slot as keyof typeof save.player.equipped]=projected;
      } else save.player.inventory.push(projected);
    }
    save.player.marketGold = Number(row.market_gold);
    save.player.clanId = row.clan_id || undefined;
  }
  return {ownerId:String(row.telegram_id),resetVersion:Number(row.reset_version),version:Number(row.progress_version),save,activeHere:Boolean(token && row.progress_session_hash===hash(token)),sessionGeneration:Number(row.progress_session_generation),migrationOpen:row.progress_migration_open};
}
export class ProgressStore {
  constructor(private pool: Pick<Pool,'connect'>) {}
  private async transaction<T>(id: number, work: (client: PoolClient,row: any)=>Promise<T>): Promise<T> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row=(await client.query('SELECT * FROM players WHERE telegram_id=$1 FOR UPDATE',[id])).rows[0];
      if (!row) throw new ProgressError('NOT_FOUND','Игрок не найден.',404);
      const result=await work(client,row); await client.query('COMMIT'); return result;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async load(id: number, token: string) { return this.transaction(id,(client,row)=>projectProgress(client,row,token)); }
  async acquire(id: number, token: string, expectedGeneration: number, transfer: boolean) {
    if (!uuid(token)) throw new ProgressError('INVALID_SESSION','Некорректный ключ сессии.',400);
    return this.transaction(id,async(client,row)=>{
      if (row.progress_session_hash===hash(token)) return projectProgress(client,row,token);
      if (row.progress_session_hash && !transfer) throw new ProgressError('SESSION_ACTIVE','Персонаж открыт на другом устройстве. Перенесите активную сессию явно.');
      if (Number(row.progress_session_generation)!==expectedGeneration) throw new ProgressError('SESSION_CONFLICT','Активная сессия уже изменилась. Загрузите актуальные данные.');
      const next=(await client.query('UPDATE players SET progress_session_hash=$2,progress_session_generation=progress_session_generation+1 WHERE telegram_id=$1 RETURNING *',[id,hash(token)])).rows[0];
      return projectProgress(client,next,token);
    });
  }
  async write(id: number, token: string, body: any, mode: 'migrate'|'create'|'checkpoint') {
    const {operationId,expectedVersion,resetVersion,save,replaceExisting}=body || {};
    if (!uuid(operationId) || !Number.isSafeInteger(expectedVersion) || !Number.isSafeInteger(resetVersion)) throw new ProgressError('INVALID_REQUEST','Некорректная версия или ID операции.',400);
    const requestHash=hash(canonicalJson({mode,expectedVersion,resetVersion,save,replaceExisting:replaceExisting===true}));
    return this.transaction(id,async(client,row)=>{
      if (Number(row.reset_version)!==resetVersion) throw new ProgressError('ACCOUNT_RESET','Прогресс сброшен администратором.');
      if (!token || row.progress_session_hash!==hash(token)) throw new ProgressError('SESSION_LOST','Активная сессия перенесена на другое устройство. Изменения остановлены.');
      const cached=(await client.query('SELECT * FROM progress_operations WHERE telegram_id=$1 AND operation_id=$2',[id,operationId])).rows[0];
      if (cached) {
        if (cached.request_hash!==requestHash || Number(cached.reset_version)!==resetVersion) throw new ProgressError('OPERATION_CONFLICT','ID операции уже использован с другими параметрами.');
        // Return CURRENT state: replaying an older receipt must never roll the UI back.
        return {...await projectProgress(client,row,token),replayed:true};
      }
      if (Number(row.progress_version)!==expectedVersion) throw new ProgressError('VERSION_CONFLICT','На сервере уже сохранён новый прогресс. Ваши изменения остановлены.');
      if (mode==='checkpoint' && !row.progress_json) throw new ProgressError('NO_CHARACTER','Сначала создайте или перенесите персонажа.');
      if (mode==='create' && row.progress_json) throw new ProgressError('CHARACTER_EXISTS','На сервере уже есть персонаж.');
      if (mode==='migrate' && (!row.progress_migration_open || row.progress_json && !replaceExisting)) throw new ProgressError('MIGRATION_CLOSED','На сервере уже есть персонаж. Автоматическая замена запрещена.');
      const next=validateProgress(save,id,resetVersion,mode==='migrate');
      // UUIDs issued by the ledger can never be reintroduced as local items, including sold ones.
      const ledgerIds=(await client.query('SELECT item_id FROM progress_ledger_ids WHERE telegram_id=$1',[id])).rows.map(r=>r.item_id);
      const currentIds=(await client.query('SELECT id FROM owned_items WHERE owner_telegram_id=$1',[id])).rows.map(r=>r.id);
      const forbidden=new Set([...ledgerIds,...currentIds]);
      next.player.inventory=next.player.inventory.filter(i=>!forbidden.has(i.id));
      next.player.equipped=Object.fromEntries(Object.entries(next.player.equipped).filter(([,i])=>!forbidden.has(i?.id)));
      if (mode==='checkpoint' && next.player.id!==row.progress_json.player.id) throw new ProgressError('CHARACTER_CONFLICT','Замена персонажа через обычное сохранение запрещена.');
      if (mode==='checkpoint') {
        const previous=row.progress_json;
        if(next.player.classId!==previous.player.classId || next.player.level<previous.player.level)throw new ProgressError('PROGRESS_REGRESSION','Класс или уровень персонажа не может откатиться.');
        for(const field of ['quests','achievements'])for(const claimed of previous[field].filter((entry:any)=>entry.claimed)){
          if(!next[field as 'quests'].some(entry=>entry.id===claimed.id && entry.claimed))throw new ProgressError('PROGRESS_REGRESSION','Уже полученная награда не может стать доступной повторно.');
        }
      }
      if (mode==='create' && (next.player.level!==1 || next.player.gold!==120 || next.player.silver!==80)) throw new ProgressError('INVALID_CHARACTER','Начальные значения персонажа неверны.',400);
      if (mode==='migrate') {
        // Keep the original payload, not the filtered one, and the selected server predecessor.
        await client.query('INSERT INTO progress_backups (telegram_id,reset_version,progress_version,source,save_json) VALUES ($1,$2,$3,$4,$5::jsonb)',[id,resetVersion,expectedVersion,'local_migration',JSON.stringify(save)]);
        if (row.progress_json) await client.query('INSERT INTO progress_backups (telegram_id,reset_version,progress_version,source,save_json) VALUES ($1,$2,$3,$4,$5::jsonb)',[id,resetVersion,expectedVersion,'server_before_selection',JSON.stringify(row.progress_json)]);
      }
      const updated=(await client.query(`UPDATE players SET progress_json=$2::jsonb,progress_version=progress_version+1,
        progress_migration_open=$3,character_name=$4,level=$5,arena_rating=$6,class_id=$7,updated_at=NOW() WHERE telegram_id=$1 RETURNING *`,[id,JSON.stringify(next),mode==='migrate',next.player.name,next.player.level,next.player.arenaRating,next.player.classId])).rows[0];
      await client.query('INSERT INTO progress_operations (telegram_id,operation_id,reset_version,request_hash,result_version) VALUES ($1,$2,$3,$4,$5)',[id,operationId,resetVersion,requestHash,updated.progress_version]);
      await client.query('INSERT INTO progress_ledger_ids (telegram_id,item_id) SELECT owner_telegram_id,id FROM owned_items WHERE owner_telegram_id=$1 ON CONFLICT DO NOTHING',[id]);
      return {...await projectProgress(client,updated,token),replayed:false};
    });
  }
}
