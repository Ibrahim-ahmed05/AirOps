# AirOps Data Model & High-Volume Data Generator

## Overview

Sprint 1 defines the relational PostgreSQL schema for AirOps using **Drizzle ORM** and introduces a high-performance, chunked bulk seed generator capable of scaling from 10,000 to 1,000,000 flight records.

---

## Schema Architecture & Entities

```
+-------------------+           +-------------------+           +-------------------+
|     Airports      |           |      Flights      |           |     Aircraft      |
+-------------------+           +-------------------+           +-------------------+
| id (PK)           | <-------- | originAirportId   |           | id (PK)           |
| code (UNIQUE)     |           | destinationApId   | --------> | registration (UQ) |
| name, city        |           | aircraftId        |           | model, capacity   |
| country, timezone |           | status, times...  |           | status            |
+-------------------+           +---------+---------+           +-------------------+
                                          |
                                          +---------------------+
                                          |                     |
                                          v                     v
                                +-------------------+ +-------------------+
                                |   FlightEvents    | |     Incidents     |
                                +-------------------+ +-------------------+
                                | id (PK)           | | id (PK)           |
                                | flightId (FK)     | | flightId (FK)     |
                                | eventType         | | severity, type    |
                                | eventTime         | | status, desc      |
                                +-------------------+ +-------------------+
```

### 1. `airports`
Contains reference data for global airport hubs.
- **Fields:** `id` (Serial PK), `code` (VarChar 3, Unique), `name` (Text), `city` (Text), `country` (Text), `timezone` (Text).

### 2. `aircraft`
Fleet inventory table.
- **Fields:** `id` (Serial PK), `registration` (VarChar 20, Unique), `model` (Text), `capacity` (Integer), `status` (VarChar 20: `ACTIVE`, `MAINTENANCE`, `RETIRED`).

### 3. `flights`
Core operations table storing flight schedules, real-time statuses, and passenger figures.
- **Fields:**
  - `id`: Serial PK
  - `flight_number`: VarChar 10 (e.g. `AA104`)
  - `airline_code`: VarChar 3 (e.g. `AA`, `DL`, `UA`, `BA`, `LH`, `EK`)
  - `origin_airport_id`: Foreign Key referencing `airports(id)`
  - `destination_airport_id`: Foreign Key referencing `airports(id)`
  - `aircraft_id`: Foreign Key referencing `aircraft(id)`
  - `scheduled_departure`: Timestamp with time zone
  - `scheduled_arrival`: Timestamp with time zone
  - `actual_departure`: Timestamp with time zone (nullable)
  - `actual_arrival`: Timestamp with time zone (nullable)
  - `gate`: VarChar 10 (nullable)
  - `status`: VarChar 20 (`SCHEDULED`, `BOARDING`, `DEPARTED`, `DELAYED`, `ARRIVED`, `CANCELLED`)
  - `delay_minutes`: Integer (default 0)
  - `passenger_count`: Integer (default 0)
  - `created_at` / `updated_at`: Timestamps with time zone

### 4. `flight_events`
Historical operational activity audit trail for each flight.
- **Fields:** `id` (Serial PK), `flight_id` (FK -> `flights.id` ON DELETE CASCADE), `event_type` (`SCHEDULED`, `BOARDING_STARTED`, `DEPARTED`, `ARRIVED`, `CANCELLED`), `message` (Text), `event_time` (Timestamp), `created_at` (Timestamp).

### 5. `incidents`
Operational delays, safety, and mechanical issue reports attached to flights.
- **Fields:** `id` (Serial PK), `flight_id` (FK -> `flights.id` ON DELETE CASCADE), `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `type` (`MECHANICAL`, `WEATHER`, `MEDICAL`, `SECURITY`, `BAGGAGE`, `CREW_SHORTAGE`), `status` (`OPEN`, `INVESTIGATING`, `RESOLVED`, `CLOSED`), `description` (Text), `created_at` (Timestamp), `resolved_at` (Timestamp).

---

## Indexing Policy & Constraints

> [!IMPORTANT]
> **Performance Index Restriction:**
> Per Sprint 1 guidelines, **no query performance indexes** (such as composite indexes on status, origin/destination IDs, or date ranges) have been added.
> The database strictly uses:
> 1. Primary Keys (`id` serial)
> 2. Unique Constraints (`airports.code`, `aircraft.registration`)
> 3. Foreign Key relations (`flights.origin_airport_id`, etc.)
>
> This allows subsequent load-testing sprints to identify raw SQL query bottlenecks before index optimizations are introduced.

---

## High-Volume Bulk Seed Generator

The seed script (`apps/api/src/db/seed.ts`) uses **parameterized multi-row SQL bulk inserts** (5,000 flights per transaction batch) to bypass ORM per-row insertion overhead.

### Seed Commands

Run from the root directory:

```bash
# Seed 10,000 flights (Default)
npm run seed -- 10000

# Seed 100,000 flights
npm run seed -- 100000

# Seed 500,000 flights
npm run seed -- 500000

# Seed 1,000,000 flights
npm run seed -- 1000000

# Truncate and reset database before seeding (shorthand flag -r or --reset)
npm run seed -- 100000 --reset
```

### Estimated Record Counts per Dataset Scale

| Target Flights | Airports | Aircraft | Flight Records | Flight Events (Est.) | Incidents (Est.) | Total Rows | Est. Seed Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **10,000** | 40 | 250 | 10,000 | ~25,000 | ~300 | ~35,340 | ~1–2s |
| **100,000** | 40 | 250 | 100,000 | ~250,000 | ~3,000 | ~353,290 | ~10–18s |
| **500,000** | 40 | 250 | 500,000 | ~1,250,000 | ~15,000 | ~1,765,290 | ~50–90s |
| **1,000,000**| 40 | 250 | 1,000,000 | ~2,500,000 | ~30,000 | ~3,530,290 | ~2–3 min |

---

## How to Reset / Reseed the Database

To wipe all data and start with a fresh schema:

```bash
# Apply schema push / migrations
npm run db:push

# Reset tables and seed desired flight volume
npm run seed -- 100000 --reset
```
