import { FastifyInstance } from 'fastify';
import { db, flights, incidents } from '../db/index.js';
import { sql, inArray } from 'drizzle-orm';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/api/dashboard', async (request, reply) => {
    try {
      // 1. Calculate Flights Breakdown Aggregates via single SQL query
      const flightMetricsRes = await db
        .select({
          totalFlights: sql<number>`count(*)::int`,
          scheduledFlights: sql<number>`count(*) filter (where status = 'SCHEDULED')::int`,
          boardingFlights: sql<number>`count(*) filter (where status = 'BOARDING')::int`,
          departedFlights: sql<number>`count(*) filter (where status = 'DEPARTED')::int`,
          delayedFlights: sql<number>`count(*) filter (where status = 'DELAYED')::int`,
          cancelledFlights: sql<number>`count(*) filter (where status = 'CANCELLED')::int`,
          arrivedFlights: sql<number>`count(*) filter (where status = 'ARRIVED')::int`,
          averageDelayMinutes: sql<number>`coalesce(avg(delay_minutes) filter (where delay_minutes > 0), 0)::float`,
          affectedPassengers: sql<number>`coalesce(sum(passenger_count) filter (where status in ('DELAYED', 'CANCELLED')), 0)::int`,
        })
        .from(flights);

      const metrics = flightMetricsRes[0];

      // 2. Calculate Active Incidents count
      const activeIncidentsRes = await db
        .select({
          activeIncidents: sql<number>`count(*)::int`,
        })
        .from(incidents)
        .where(inArray(incidents.status, ['OPEN', 'INVESTIGATING']));

      const activeIncidents = activeIncidentsRes[0]?.activeIncidents || 0;

      return reply.send({
        data: {
          totalFlights: metrics.totalFlights,
          scheduledFlights: metrics.scheduledFlights,
          boardingFlights: metrics.boardingFlights,
          departedFlights: metrics.departedFlights,
          delayedFlights: metrics.delayedFlights,
          cancelledFlights: metrics.cancelledFlights,
          arrivedFlights: metrics.arrivedFlights,
          averageDelayMinutes: Number(metrics.averageDelayMinutes.toFixed(1)),
          affectedPassengers: metrics.affectedPassengers,
          activeIncidents,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(503).send({
        error: {
          message: 'PostgreSQL database is disconnected or unreachable on port 5432',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });
}
