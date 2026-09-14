import pkg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export interface DatabaseHealthResult {
  status: 'connected' | 'disconnected';
  latencyMs: number | null;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const start = performance.now();
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const latencyMs = Number((performance.now() - start).toFixed(2));
      return {
        status: 'connected',
        latencyMs,
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      status: 'disconnected',
      latencyMs: null,
      error: err?.message || 'Failed to connect to database',
    };
  }
}

export * from './schema.js';
