import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  try {
    const migrationsFolder = path.resolve(__dirname, './migrations');
    await migrate(db, { migrationsFolder });
    console.log('✅ Database migrations applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}

// Allow direct execution via CLI
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async () => {
      await pool.end();
      process.exit(1);
    });
}
