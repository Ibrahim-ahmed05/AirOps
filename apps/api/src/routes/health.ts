import { FastifyInstance } from 'fastify';
import { checkDatabaseHealth } from '../db/index.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    const dbHealth = await checkDatabaseHealth();
    
    const isHealthy = dbHealth.status === 'connected';
    const statusCode = isHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      status: isHealthy ? 'ok' : 'degraded',
      service: 'airops-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      database: dbHealth,
    });
  });
}
