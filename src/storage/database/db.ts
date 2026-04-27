import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

// 单例模式，复用数据库连接
let dbInstance: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    const dbUrl = process.env.DATABASE_URL!;
    // 本地开发用pg驱动连接Docker PG，生产环境用Neon驱动
    if (dbUrl.includes('localhost')) {
      const pool = new Pool({ connectionString: dbUrl });
      dbInstance = pgDrizzle(pool, { schema });
    } else {
      const sql = neon(dbUrl);
      dbInstance = neonDrizzle(sql, { schema });
    }
  }
  return dbInstance;
}
