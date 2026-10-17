import {config} from 'dotenv';
import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
config({path: path.join(root, '.env.migration'), quiet: true});
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const output = path.join(root, '.migration-backups', new Date().toISOString().replaceAll(':', '-'));
const client = new pg.Client({connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : {rejectUnauthorized: false},
  connectionTimeoutMillis: 15000, application_name: 'game-readonly-migration-export'});
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
let transaction = false;
try {
  await client.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  transaction = true;
  await client.query("SET LOCAL statement_timeout = '120s'");
  const metadata = (await client.query(`SELECT current_setting('server_version') AS version,
    transaction_timestamp()::text AS snapshot_at`)).rows[0];
  const tables = (await client.query(`SELECT tablename FROM pg_tables
    WHERE schemaname='public' ORDER BY tablename`)).rows.map(row => row.tablename);
  const columns = (await client.query(`SELECT table_name,column_name,ordinal_position,data_type,
    udt_name,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
  const constraints = (await client.query(`SELECT c.relname AS table_name, con.conname,
    con.contype,pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    ORDER BY c.relname,con.conname`)).rows;
  const indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes
    WHERE schemaname='public' ORDER BY tablename,indexname`)).rows;
  const sequences = (await client.query(`SELECT sequencename,data_type,start_value,min_value,
    max_value,increment_by,cycle,last_value::text FROM pg_sequences
    WHERE schemaname='public' ORDER BY sequencename`)).rows;
  await fs.mkdir(output, {recursive: true});
  const manifest = {format: 'game-postgres-snapshot-v1', complete: false, ...metadata,
    note: 'Public-schema logical migration snapshot; not a replacement for a native PostgreSQL disaster recovery backup. No production writes were stopped.',
    columns, constraints, indexes, sequences, tables: []};
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  for (const [index, table] of tables.entries()) {
    const filename = String(index).padStart(3, '0') + '.ndjson';
    const file = await fs.open(path.join(output, filename), 'wx');
    let count = 0, bytes = 0;
    const hash = createHash('sha256');
    // Cast server-side JSON to text to preserve bigint/numeric precision exactly.
    await client.query(`DECLARE migration_export NO SCROLL CURSOR FOR
      SELECT row_to_json(t)::text AS document FROM public.${identifier(table)} t`);
    try {
      for (;;) {
        const rows = (await client.query('FETCH FORWARD 500 FROM migration_export')).rows;
        if (!rows.length) break;
        for (const row of rows) {
          const buffer = Buffer.from(row.document + '\n');
          // FileHandle.writeFile appends at the handle's current position.
          await file.writeFile(buffer);
          hash.update(buffer); bytes += buffer.length; count++;
        }
      }
    } finally {await file.close(); await client.query('CLOSE migration_export');}
    manifest.tables.push({table, file: filename, rows: count, bytes, sha256: hash.digest('hex')});
    console.log(`${table}: ${count} rows`);
  }
  await client.query('COMMIT'); transaction = false;
  manifest.complete = true;
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Snapshot completed: ${output}`);
} catch (error) {
  if (transaction) await client.query('ROLLBACK').catch(() => {});
  // Avoid emitting connection URLs or credentials in diagnostic stacks.
  console.error('Snapshot failed:', error.code || error.name || 'UNKNOWN');
  process.exitCode = 1;
} finally {await client.end().catch(() => {});}
