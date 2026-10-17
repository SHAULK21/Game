import type {Pool, PoolClient} from 'pg';
// One request per isolate invocation. Nested services run sequentially and share
// the private candidate; durable concurrency is handled by the outer document CAS.
let active: PoolClient | undefined;
let sequence = 0;
export function gameTransactionPool(pool: Pool): Pool {
  return new Proxy(pool, {get(target, key) {
    if (key === 'query') return (...args: any[]) => ((active || target).query as any)(...args);
    if (key === 'connect') return async () => {
      if (!active) return target.connect();
      const client = active, name = 'native_nested_' + (++sequence); let started = false;
      return {query: async (sql: string, args?: any[]) => {
        if (/^BEGIN\s*;?$/.test(sql)) {started = true; return client.query('SAVEPOINT ' + name);}
        if (/^COMMIT\s*;?$/.test(sql)) {started = false; return client.query('RELEASE SAVEPOINT ' + name);}
        if (/^ROLLBACK\s*;?$/.test(sql)) {
          if (started) {started = false; await client.query('ROLLBACK TO SAVEPOINT ' + name); return client.query('RELEASE SAVEPOINT ' + name);}
          return {rows: [], rowCount: 0};
        }
        return client.query(sql, args);
      }, release() {}};
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
}
export async function withGameTransaction<T>(client: PoolClient, callback: () => Promise<T>): Promise<T> {
  const previous = active; active = client;
  try {return await callback();} finally {active = previous;}
}
