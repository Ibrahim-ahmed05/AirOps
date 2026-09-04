import { FastifyInstance } from 'fastify';
import { db, airports } from '../db/index.js';
import { asc } from 'drizzle-orm';

export async function airportRoutes(fastify: FastifyInstance) {
  fastify.get('/api/airports', async (request, reply) => {
    try {
      const allAirports = await db
        .select({
          id: airports.id,
          code: airports.code,
          name: airports.name,
          city: airports.city,
          country: airports.country,
          timezone: airports.timezone,
        })
        .from(airports)
        .orderBy(asc(airports.code));

      return reply.send({
        data: allAirports,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        error: {
          message: 'Failed to fetch airports list',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });
}
