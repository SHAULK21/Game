import {PGlite} from '@electric-sql/pglite';
import {Pool} from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

/** Same production store and SQL. CI uses PostgreSQL with independent sockets;
 * PGlite is a fast PostgreSQL WASM fallback, not a game-state test adapter. */
export async function expeditionDatabase() {
  let pool: any, query: any, execute: (sql: string) => Promise<unknown>, close: () => Promise<void>;
  if (process.env.TEST_DATABASE_URL) {
    const admin = new Pool({connectionString: process.env.TEST_DATABASE_URL});
    const schema = 'expedition_test_' + crypto.randomBytes(8).toString('hex');
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({connectionString: process.env.TEST_DATABASE_URL, max: 6, options: `-c search_path=${schema},public`});
    query = (sql: string, args: any[] = []) => pool.query(sql, args);
    execute = sql => pool.query(sql);
    close = async () => {await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();};
  } else {
    const database = new PGlite();
    query = async (sql: string, args: any[] = []) => {const result = await database.query(sql, args); return {...result, rowCount: result.affectedRows ?? result.rows.length};};
    let tail = Promise.resolve();
    pool = {query, connect: async () => {const previous = tail; let release!: () => void; tail = new Promise<void>(resolve => {release = resolve;}); await previous; return {query, release};}};
    execute = sql => database.exec(sql);
    close = () => database.close();
  }
  try {
    const schema = (await fs.readFile('server/schema.sql', 'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
    const migration = await fs.readFile('server/migrations/20261015_expeditions.sql', 'utf8');
    await execute(schema); await execute(migration); await execute(migration);
    return {pool, query, close};
  } catch (error) {await close(); throw error;}
}
