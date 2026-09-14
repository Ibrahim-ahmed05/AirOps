import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env if present
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('4000'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgres://airops:airops_password@localhost:5432/airops'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(process.env.VERCEL ? 5 : 20),
});

const parseEnv = () => {
  if (process.env.NODE_ENV === 'production' && (!process.env.DATABASE_URL || !process.env.CORS_ORIGIN)) {
    throw new Error('Production requires DATABASE_URL and CORS_ORIGIN environment variables');
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return result.data;
};

export const env = parseEnv();
