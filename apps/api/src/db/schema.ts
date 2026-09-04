import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Airports Entity
export const airports = pgTable('airports', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 3 }).notNull().unique(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
  timezone: text('timezone').notNull(),
});

// 2. Aircraft Entity
export const aircraft = pgTable('aircraft', {
  id: serial('id').primaryKey(),
  registration: varchar('registration', { length: 20 }).notNull().unique(),
  model: text('model').notNull(),
  capacity: integer('capacity').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // ACTIVE, MAINTENANCE, RETIRED
});

// 3. Flights Entity
export const flights = pgTable('flights', {
  id: serial('id').primaryKey(),
  flightNumber: varchar('flight_number', { length: 10 }).notNull(),
  airlineCode: varchar('airline_code', { length: 3 }).notNull(),
  originAirportId: integer('origin_airport_id').notNull().references(() => airports.id),
  destinationAirportId: integer('destination_airport_id').notNull().references(() => airports.id),
  aircraftId: integer('aircraft_id').notNull().references(() => aircraft.id),
  scheduledDeparture: timestamp('scheduled_departure', { withTimezone: true }).notNull(),
  scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }).notNull(),
  actualDeparture: timestamp('actual_departure', { withTimezone: true }),
  actualArrival: timestamp('actual_arrival', { withTimezone: true }),
  gate: varchar('gate', { length: 10 }),
  status: varchar('status', { length: 20 }).notNull(), // SCHEDULED, BOARDING, DEPARTED, DELAYED, ARRIVED, CANCELLED
  delayMinutes: integer('delay_minutes').default(0).notNull(),
  passengerCount: integer('passenger_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Flight Events Entity (Historical Activity Log)
export const flightEvents = pgTable('flight_events', {
  id: serial('id').primaryKey(),
  flightId: integer('flight_id').notNull().references(() => flights.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 30 }).notNull(),
  message: text('message').notNull(),
  eventTime: timestamp('event_time', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Incidents Entity
export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  flightId: integer('flight_id').notNull().references(() => flights.id, { onDelete: 'cascade' }),
  severity: varchar('severity', { length: 20 }).notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  type: varchar('type', { length: 30 }).notNull(), // MECHANICAL, WEATHER, MEDICAL, SECURITY, BAGGAGE, CREW_SHORTAGE
  status: varchar('status', { length: 20 }).notNull(), // OPEN, INVESTIGATING, RESOLVED, CLOSED
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// Relational Definitions
export const airportsRelations = relations(airports, ({ many }) => ({
  departingFlights: many(flights, { relationName: 'originAirport' }),
  arrivingFlights: many(flights, { relationName: 'destinationAirport' }),
}));

export const aircraftRelations = relations(aircraft, ({ many }) => ({
  flights: many(flights),
}));

export const flightsRelations = relations(flights, ({ one, many }) => ({
  originAirport: one(airports, {
    fields: [flights.originAirportId],
    references: [airports.id],
    relationName: 'originAirport',
  }),
  destinationAirport: one(airports, {
    fields: [flights.destinationAirportId],
    references: [airports.id],
    relationName: 'destinationAirport',
  }),
  aircraft: one(aircraft, {
    fields: [flights.aircraftId],
    references: [aircraft.id],
  }),
  events: many(flightEvents),
  incidents: many(incidents),
}));

export const flightEventsRelations = relations(flightEvents, ({ one }) => ({
  flight: one(flights, {
    fields: [flightEvents.flightId],
    references: [flights.id],
  }),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  flight: one(flights, {
    fields: [incidents.flightId],
    references: [flights.id],
  }),
}));
