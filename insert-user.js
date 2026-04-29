import { getDb } from './src/storage/database/db.js';
import { users } from './src/storage/database/shared/schema.js';

async function insertTestUser() {
  const db = await getDb();
  await db.insert(users).values({ id: 'test_user_123', nickname: '测试用户' }).onConflictDoNothing();
  console.log('测试用户插入完成');
  process.exit(0);
}

insertTestUser();