import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { airportRoutes } from './routes/airports.js';
import { flightRoutes } from './routes/flights.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { pool } from './db/index.js';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

// Register CORS
await fastify.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Request timing hook
fastify.addHook('onRequest', (request, reply, done) => {
  (request as any).startTime = performance.now();
  done();
});

fastify.addHook('onResponse', (request, reply, done) => {
  const startTime = (request as any).startTime;
  if (startTime) {
    const duration = (performance.now() - startTime).toFixed(2);
    fastify.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Number(duration),
    }, `${request.method} ${request.url} completed in ${duration}ms [HTTP ${reply.statusCode}]`);
  }
  done();
});

// Centralized Error Handler (Zod & HTTP errors)
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return reply.status(400).send({
      error: {
        message: 'Invalid request payload or query parameters',
        statusCode: 400,
        details: formattedErrors,
        timestamp: new Date().toISOString(),
      },
    });
  }

  fastify.log.error(error);
  return reply.status(error.statusCode || 500).send({
    error: {
      message: error.message || 'Internal Server Error',
      statusCode: error.statusCode || 500,
      timestamp: new Date().toISOString(),
    },
  });
});

// Register Routes
await fastify.register(healthRoutes);
await fastify.register(airportRoutes);
await fastify.register(flightRoutes);
await fastify.register(dashboardRoutes);

// Graceful shutdown handling
const closeGracefully = async (signal: string) => {
  fastify.log.info(`Received signal to terminate: ${signal}`);
  await fastify.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// Start Fastify Server
try {
  await fastify.listen({ port: env.PORT, host: env.HOST });
  fastify.log.info(`AirOps API running at http://${env.HOST}:${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
