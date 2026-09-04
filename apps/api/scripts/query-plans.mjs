/**
 * AirOps Sprint 4 — Query Plan Analyzer
 * Runs EXPLAIN ANALYZE on the key queries in the baseline implementation.
 * Reveals sequential scans and query cost at each dataset size.
 */

import pkg from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function explain(label, query, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(`EXPLAIN ANALYZE ${query}`, params);
    console.log(`\n╔══ ${label}`);
    console.log(`╚═ Query:`);
    console.log(`   ${query.trim().replace(/\s+/g, ' ').slice(0, 200)}`);
    console.log(`\n   EXPLAIN ANALYZE Output:`);
    for (const row of res.rows) {
      console.log(`   ${row['QUERY PLAN']}`);
    }
  } finally {
    client.release();
  }
}

async function getTableCounts(client) {
  const res = await client.query(`
    SELECT
      (SELECT count(*) FROM flights)::int as flights,
      (SELECT count(*) FROM airports)::int as airports,
      (SELECT count(*) FROM aircraft)::int as aircraft,
      (SELECT count(*) FROM flight_events)::int as events,
      (SELECT count(*) FROM incidents)::int as incidents;
  `);
  return res.rows[0];
}

async function run() {
  const client = await pool.connect();
  const counts = await getTableCounts(client);
  client.release();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  AirOps — Sprint 4 Query Plan Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Dataset: flights=${counts.flights.toLocaleString()}  airports=${counts.airports}  aircraft=${counts.aircraft}`);
  console.log(`           events=${counts.events.toLocaleString()}    incidents=${counts.incidents.toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Dashboard aggregate scan
  await explain(
    'GET /api/dashboard — flights aggregate (Query 1 of 2)',
    `SELECT
       count(*)::int as total_flights,
       count(*) filter (where status = 'SCHEDULED')::int as scheduled,
       count(*) filter (where status = 'DELAYED')::int as delayed,
       coalesce(avg(delay_minutes) filter (where delay_minutes > 0), 0)::float as avg_delay,
       coalesce(sum(passenger_count) filter (where status in ('DELAYED','CANCELLED')), 0)::int as affected_pax
     FROM flights`
  );

  // 2. Dashboard incidents scan
  await explain(
    'GET /api/dashboard — incidents aggregate (Query 2 of 2)',
    `SELECT count(*)::int FROM incidents WHERE status IN ('OPEN', 'INVESTIGATING')`
  );

  // 3. Flights count query (the separate COUNT(*) request)
  await explain(
    'GET /api/flights — COUNT subquery (Query 1 of 2, runs on EVERY request)',
    `SELECT count(flights.id)::int
     FROM flights
     LEFT JOIN airports AS origin_airport ON flights.origin_airport_id = origin_airport.id
     LEFT JOIN airports AS destination_airport ON flights.destination_airport_id = destination_airport.id`
  );

  // 4. Flights paginated data query
  await explain(
    'GET /api/flights — paginated data (Query 2 of 2, page=1 limit=20)',
    `SELECT f.id, f.flight_number, f.status, f.delay_minutes, f.passenger_count,
            oa.code as origin_code, da.code as dest_code, ac.registration
     FROM flights f
     INNER JOIN airports oa ON f.origin_airport_id = oa.id
     INNER JOIN airports da ON f.destination_airport_id = da.id
     INNER JOIN aircraft ac ON f.aircraft_id = ac.id
     ORDER BY f.scheduled_departure DESC
     LIMIT 20 OFFSET 0`
  );

  // 5. Deep offset query (page 50)
  await explain(
    'GET /api/flights — deep offset (page=50 limit=20 → OFFSET 980)',
    `SELECT f.id, f.flight_number, f.status, f.delay_minutes
     FROM flights f
     INNER JOIN airports oa ON f.origin_airport_id = oa.id
     INNER JOIN airports da ON f.destination_airport_id = da.id
     INNER JOIN aircraft ac ON f.aircraft_id = ac.id
     ORDER BY f.scheduled_departure DESC
     LIMIT 20 OFFSET 980`
  );

  // 6. ILIKE search (no index)
  await explain(
    'GET /api/flights?search=AA — ILIKE full scan (worst-case query)',
    `SELECT count(f.id)::int
     FROM flights f
     LEFT JOIN airports oa ON f.origin_airport_id = oa.id
     LEFT JOIN airports da ON f.destination_airport_id = da.id
     WHERE f.flight_number ILIKE '%AA%'
        OR f.airline_code ILIKE '%AA%'
        OR oa.code ILIKE '%AA%'
        OR da.code ILIKE '%AA%'`
  );

  // 7. Status filter (no index on status column)
  await explain(
    'GET /api/flights?status=DELAYED — status filter (no index)',
    `SELECT count(*)::int FROM flights WHERE status = 'DELAYED'`
  );

  // 8. Single flight detail
  await explain(
    'GET /api/flights/:id — single flight by PK',
    `SELECT f.id, f.flight_number, f.status, oa.code, da.code, ac.registration
     FROM flights f
     INNER JOIN airports oa ON f.origin_airport_id = oa.id
     INNER JOIN airports da ON f.destination_airport_id = da.id
     INNER JOIN aircraft ac ON f.aircraft_id = ac.id
     WHERE f.id = $1`,
    [1]
  );

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await pool.end();
}

run().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
