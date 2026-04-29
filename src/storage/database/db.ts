import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './shared/schema';

// 统一类型，避免TypeScript类型冲突
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

// 单例模式，复用数据库连接
let dbInstance: DbInstance | null = null;
let dbInitPromise: Promise<DbInstance> | null = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbInitPromise) {
    dbInitPromise = createDb();
  }

  dbInstance = await dbInitPromise;
  return dbInstance;
}

async function createDb(): Promise<DbInstance> {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  // 本地开发用 pg 驱动连接 Docker PG；线上 Worker 只加载 Neon HTTP 驱动。
  if (dbUrl.includes('localhost')) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as <T>(
      specifier: string
    ) => Promise<T>;
    const [{ drizzle: pgDrizzle }, { Pool }] = await Promise.all([
      dynamicImport<typeof import('drizzle-orm/node-postgres')>('drizzle-orm/node-postgres'),
      dynamicImport<typeof import('pg')>('pg'),
    ]);
    const pool = new Pool({ connectionString: dbUrl });
    return pgDrizzle(pool, { schema }) as unknown as DbInstance;
  }

  const sql = neon(dbUrl);
  return drizzle(sql, { schema });
}
