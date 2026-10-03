import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/index.js';

const closeGracefully = async (signal: string) => {
  app.log.info(`Received signal to terminate: ${signal}`);
  await app.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`AirOps API running at http://${env.HOST}:${env.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
