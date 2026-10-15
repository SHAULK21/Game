import type {PoolClient} from 'pg';

/** Also works while rolling from the pre-expedition schema. Archived migration
 * backups stay in their old reset epoch and cannot become playable saves. */
export async function clearExpeditionAccount(client: PoolClient, owner: number) {
  const schema = (await client.query("SELECT to_regclass('expedition_accounts') IS NOT NULL AS enabled")).rows[0];
  if (!schema?.enabled) return;
  await client.query('DELETE FROM expedition_accounts WHERE telegram_id=$1', [owner]);
  await client.query('DELETE FROM expedition_operations WHERE telegram_id=$1', [owner]);
  await client.query(`UPDATE players SET progress_json=NULL,progress_version=progress_version+1,
    progress_session_hash=NULL,progress_session_generation=progress_session_generation+1,
    character_authority='legacy-local' WHERE telegram_id=$1`, [owner]);
}
