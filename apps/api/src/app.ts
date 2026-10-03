import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { healthRoutes } from './routes/health.js';
import { airportRoutes } from './routes/airports.js';
import { flightRoutes } from './routes/flights.js';
import { dashboardRoutes } from './routes/dashboard.js';

export function buildApp() {
  const allowedOrigins = env.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
            }
          : undefined,
    },
  });

  fastify.register(cors, {
    origin(origin, callback) {
      // Requests made directly to the API do not include an Origin header.
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  fastify.addHook('onRequest', (request, _reply, done) => {
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

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          message: 'Invalid request payload or query parameters',
          statusCode: 400,
          details: error.errors.map((item) => ({
            field: item.path.join('.'),
            message: item.message,
          })),
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

  fastify.get('/', async () => ({
    status: 'ok',
    service: 'airops-api',
    health: '/health',
  }));

  fastify.register(healthRoutes);
  fastify.register(airportRoutes);
  fastify.register(flightRoutes);
  fastify.register(dashboardRoutes);

  return fastify;
}

export const app = buildApp();
