import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";
const scope = new AsyncLocalStorage<PoolClient>();
/** Legacy ledger helpers join the character transaction rather than committing independently. */
export function transactionAwarePool(getPool: () => Pool): Pool {
  return new Proxy({} as Pool, {
    get(_target, key) {
      if (key === "query")
        return (...args: any[]) => {
          const client = scope.getStore();
          return (client ?? getPool()).query(...(args as [any]));
        };
      if (key === "connect")
        return async () => {
          const client = scope.getStore();
          if (!client) return getPool().connect();
          let depth = 0;
          return new Proxy(client, {
            get(target, k) {
              if (k === "release") return () => {};
              if (k === "query")
                return async (sql: any, values?: any[]) => {
                  const text = typeof sql === "string" ? sql : sql.text;
                  if (text.trim().toUpperCase() === "BEGIN")
                    return target.query("SAVEPOINT nested_" + ++depth);
                  if (text.trim().toUpperCase() === "COMMIT")
                    return target.query("RELEASE SAVEPOINT nested_" + depth--);
                  if (text.trim().toUpperCase() === "ROLLBACK")
                    return target.query(
                      "ROLLBACK TO SAVEPOINT nested_" + depth--,
                    );
                  return target.query(sql, values);
                };
              const value = (target as any)[k];
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        };
      const value = (getPool() as any)[key];
      return typeof value === "function" ? value.bind(getPool()) : value;
    },
  });
}
export const inCharacterTransaction = <T>(
  client: PoolClient,
  action: () => Promise<T>,
) => scope.run(client, action);
