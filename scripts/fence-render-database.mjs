// Reversible write fence for the retained source DB. Does not delete data.
import 'dotenv/config';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({path: '.env.migration', quiet: true});
const mode = process.argv[2];
if (!['--freeze', '--unfreeze', '--status'].includes(mode)) throw new Error('Use --status, --freeze or --unfreeze.');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const connect = () => new pg.Client({connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized: false}, application_name: 'telegram-migration-fence'});
let client;
try {
  client = connect(); await client.connect();
  const {rows: [account]} = await client.query('SELECT current_user AS role,current_database() AS database');
  const others = Number((await client.query('SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND pid<>pg_backend_pid()')).rows[0].n);
  if (mode === '--freeze' && others) throw Object.assign(new Error('Source sessions still connected; stop old writers first.'), {code: 'SOURCE_SESSIONS_PRESENT'});
  if (mode !== '--status') {
    await client.query('SET default_transaction_read_only=off');
    await client.query('ALTER ROLE ' + quote(account.role) + ' IN DATABASE ' + quote(account.database) +
      (mode === '--freeze' ? ' SET default_transaction_read_only=on' : ' RESET default_transaction_read_only'));
    await client.end(); client = connect(); await client.connect();
  }
  const readonly = (await client.query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only === 'on';
  console.log(JSON.stringify({sourceReadonlyByDefault: readonly, otherSourceSessions: others}));
  if (mode === '--freeze' && !readonly || mode === '--unfreeze' && readonly) process.exitCode = 1;
} catch (error) {console.error('Source write fence failed:', error.code || error.name || 'UNKNOWN'); process.exitCode = 1;}
finally {if (client) await client.end().catch(() => {});}
