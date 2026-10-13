import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '@/lib/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
/** Kiểu của `tx` bên trong `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const globalForDb = globalThis as unknown as { db?: Db };

/**
 * Một client cho mỗi instance function. Dùng URL của connection pooler (Neon/Supabase)
 * vì serverless mở nhiều kết nối; `prepare: false` để tương thích pooler chế độ transaction.
 */
export function db(): Db {
  if (!globalForDb.db) {
    const client = postgres(env().DATABASE_URL, { max: 5, prepare: false });
    globalForDb.db = drizzle(client, { schema });
  }
  return globalForDb.db;
}

export { schema };
