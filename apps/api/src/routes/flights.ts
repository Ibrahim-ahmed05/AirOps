import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, flights, airports, aircraft, flightEvents, incidents } from '../db/index.js';
import { eq, and, or, ilike, sql, asc, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

// Query Validation Schema for GET /api/flights
const flightsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  sortBy: z
    .enum(['scheduledDeparture', 'scheduledArrival', 'flightNumber', 'status', 'delayMinutes'])
    .default('scheduledDeparture'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Body Validation Schema for PATCH /api/flights/:id/status
const updateStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'BOARDING', 'DEPARTED', 'DELAYED', 'ARRIVED', 'CANCELLED']),
  delayMinutes: z.number().int().min(0).optional(),
  message: z.string().min(1).optional(),
});

// Aliases for double joins on airports table
const originAirport = alias(airports, 'origin_airport');
const destinationAirport = alias(airports, 'destination_airport');

export async function flightRoutes(fastify: FastifyInstance) {
  // 1. GET /api/flights (Paginated, Filtered, Sorted)
  fastify.get('/api/flights', async (request, reply) => {
    const query = flightsQuerySchema.parse(request.query);
    const offset = (query.page - 1) * query.limit;

    try {
      const conditions = [];

      if (query.search && query.search.trim() !== '') {
        const term = `%${query.search.trim()}%`;
        conditions.push(
          or(
            ilike(flights.flightNumber, term),
            ilike(flights.airlineCode, term),
            ilike(originAirport.code, term),
            ilike(destinationAirport.code, term)
          )
        );
      }

      if (query.status && query.status.trim() !== '') {
        const statuses = query.status.split(',').map((s) => s.trim().toUpperCase());
        if (statuses.length === 1) {
          conditions.push(eq(flights.status, statuses[0]));
        } else {
          conditions.push(or(...statuses.map((s) => eq(flights.status, s))));
        }
      }

      if (query.origin && query.origin.trim() !== '') {
        const val = query.origin.trim();
        const numVal = parseInt(val, 10);
        if (!isNaN(numVal)) {
          conditions.push(eq(flights.originAirportId, numVal));
        } else {
          conditions.push(ilike(originAirport.code, val));
        }
      }

      if (query.destination && query.destination.trim() !== '') {
        const val = query.destination.trim();
        const numVal = parseInt(val, 10);
        if (!isNaN(numVal)) {
          conditions.push(eq(flights.destinationAirportId, numVal));
        } else {
          conditions.push(ilike(destinationAirport.code, val));
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      let sortColumn;
      switch (query.sortBy) {
        case 'scheduledArrival':
          sortColumn = flights.scheduledArrival;
          break;
        case 'flightNumber':
          sortColumn = flights.flightNumber;
          break;
        case 'status':
          sortColumn = flights.status;
          break;
        case 'delayMinutes':
          sortColumn = flights.delayMinutes;
          break;
        case 'scheduledDeparture':
        default:
          sortColumn = flights.scheduledDeparture;
          break;
      }

      const orderExpr = query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

      // Query 1: Total Count
      const countQuery = db
        .select({ count: sql<number>`count(${flights.id})::int` })
        .from(flights)
        .leftJoin(originAirport, eq(flights.originAirportId, originAirport.id))
        .leftJoin(destinationAirport, eq(flights.destinationAirportId, destinationAirport.id));

      if (whereClause) countQuery.where(whereClause);

      const countRes = await countQuery;
      const total = countRes[0]?.count || 0;
      const totalPages = Math.ceil(total / query.limit);

      // Query 2: Paginated Data — list projection
      // Only the columns the table actually renders are selected.
      // Dropped from the old projection:
      //   flights:          airlineCode, scheduledArrival, actualDeparture,
      //                     actualArrival, createdAt, updatedAt
      //   originAirport:    id, name, country, timezone
      //   destinationAirport: id, name, country, timezone
      //   aircraft:         id, status
      // The full set of fields is still returned by GET /api/flights/:id.
      const dataQuery = db
        .select({
          id: flights.id,
          flightNumber: flights.flightNumber,
          originAirport: {
            code: originAirport.code,
            city: originAirport.city,
          },
          destinationAirport: {
            code: destinationAirport.code,
            city: destinationAirport.city,
          },
          aircraft: {
            registration: aircraft.registration,
            model: aircraft.model,
            capacity: aircraft.capacity,
          },
          scheduledDeparture: flights.scheduledDeparture,
          gate: flights.gate,
          status: flights.status,
          delayMinutes: flights.delayMinutes,
          passengerCount: flights.passengerCount,
        })
        .from(flights)
        .innerJoin(originAirport, eq(flights.originAirportId, originAirport.id))
        .innerJoin(destinationAirport, eq(flights.destinationAirportId, destinationAirport.id))
        .innerJoin(aircraft, eq(flights.aircraftId, aircraft.id));

      if (whereClause) dataQuery.where(whereClause);

      const flightRows = await dataQuery
        .orderBy(orderExpr)
        .limit(query.limit)
        .offset(offset);

      return reply.send({
        data: flightRows,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
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

  // 2. GET /api/flights/:id
  fastify.get('/api/flights/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int().min(1) });
    const { id } = paramsSchema.parse(request.params);

    try {
      const flightRes = await db
        .select({
          id: flights.id,
          flightNumber: flights.flightNumber,
          airlineCode: flights.airlineCode,
          originAirport: {
            id: originAirport.id,
            code: originAirport.code,
            name: originAirport.name,
            city: originAirport.city,
            country: originAirport.country,
            timezone: originAirport.timezone,
          },
          destinationAirport: {
            id: destinationAirport.id,
            code: destinationAirport.code,
            name: destinationAirport.name,
            city: destinationAirport.city,
            country: destinationAirport.country,
            timezone: destinationAirport.timezone,
          },
          aircraft: {
            id: aircraft.id,
            registration: aircraft.registration,
            model: aircraft.model,
            capacity: aircraft.capacity,
            status: aircraft.status,
          },
          scheduledDeparture: flights.scheduledDeparture,
          scheduledArrival: flights.scheduledArrival,
          actualDeparture: flights.actualDeparture,
          actualArrival: flights.actualArrival,
          gate: flights.gate,
          status: flights.status,
          delayMinutes: flights.delayMinutes,
          passengerCount: flights.passengerCount,
          createdAt: flights.createdAt,
          updatedAt: flights.updatedAt,
        })
        .from(flights)
        .innerJoin(originAirport, eq(flights.originAirportId, originAirport.id))
        .innerJoin(destinationAirport, eq(flights.destinationAirportId, destinationAirport.id))
        .innerJoin(aircraft, eq(flights.aircraftId, aircraft.id))
        .where(eq(flights.id, id))
        .limit(1);

      if (flightRes.length === 0) {
        return reply.status(404).send({
          error: {
            message: `Flight with ID ${id} not found`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const flight = flightRes[0];

      const events = await db
        .select()
        .from(flightEvents)
        .where(eq(flightEvents.flightId, id))
        .orderBy(desc(flightEvents.eventTime));

      const flightIncidents = await db
        .select()
        .from(incidents)
        .where(eq(incidents.flightId, id))
        .orderBy(desc(incidents.createdAt));

      return reply.send({
        data: {
          ...flight,
          events,
          incidents: flightIncidents,
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

  // 3. PATCH /api/flights/:id/status
  fastify.patch('/api/flights/:id/status', async (request, reply) => {
    const paramsSchema = z.object({ id: z.coerce.number().int().min(1) });
    const { id } = paramsSchema.parse(request.params);
    const body = updateStatusSchema.parse(request.body);

    try {
      const existingFlight = await db
        .select({ id: flights.id, status: flights.status })
        .from(flights)
        .where(eq(flights.id, id))
        .limit(1);

      if (existingFlight.length === 0) {
        return reply.status(404).send({
          error: {
            message: `Flight with ID ${id} not found`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const currentStatus = existingFlight[0].status;

      if (currentStatus === 'ARRIVED' && body.status === 'BOARDING') {
        return reply.status(400).send({
          error: {
            message: `Cannot transition flight status from ARRIVED back to BOARDING`,
            statusCode: 400,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const now = new Date();
      const updateData: Record<string, any> = {
        status: body.status,
        updatedAt: now,
      };

      if (body.delayMinutes !== undefined) {
        updateData.delayMinutes = body.delayMinutes;
      }

      if (body.status === 'DEPARTED' && !existingFlight[0].status.includes('DEPARTED')) {
        updateData.actualDeparture = now;
      }

      if (body.status === 'ARRIVED') {
        updateData.actualArrival = now;
      }

      await db.transaction(async (tx) => {
        await tx.update(flights).set(updateData).where(eq(flights.id, id));

        await tx.insert(flightEvents).values({
          flightId: id,
          eventType: body.status,
          message: body.message || `Flight status updated to ${body.status}`,
          eventTime: now,
          createdAt: now,
        });
      });

      const updatedFlightRes = await db
        .select({
          id: flights.id,
          flightNumber: flights.flightNumber,
          airlineCode: flights.airlineCode,
          originAirport: {
            id: originAirport.id,
            code: originAirport.code,
            name: originAirport.name,
          },
          destinationAirport: {
            id: destinationAirport.id,
            code: destinationAirport.code,
            name: destinationAirport.name,
          },
          status: flights.status,
          delayMinutes: flights.delayMinutes,
          updatedAt: flights.updatedAt,
        })
        .from(flights)
        .innerJoin(originAirport, eq(flights.originAirportId, originAirport.id))
        .innerJoin(destinationAirport, eq(flights.destinationAirportId, destinationAirport.id))
        .where(eq(flights.id, id))
        .limit(1);

      return reply.send({
        message: 'Flight status updated successfully',
        data: updatedFlightRes[0],
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
