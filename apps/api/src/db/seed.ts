import pkg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pkg;

// Reference Datasets
const AIRPORTS_DATA = [
  { code: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', country: 'United States', timezone: 'America/New_York' },
  { code: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', country: 'United States', timezone: 'America/Los_Angeles' },
  { code: 'ORD', name: 'O\'Hare Intl', city: 'Chicago', country: 'United States', timezone: 'America/Chicago' },
  { code: 'DFW', name: 'Dallas/Fort Worth Intl', city: 'Dallas', country: 'United States', timezone: 'America/Chicago' },
  { code: 'DEN', name: 'Denver Intl', city: 'Denver', country: 'United States', timezone: 'America/Denver' },
  { code: 'ATL', name: 'Hartsfield-Jackson Intl', city: 'Atlanta', country: 'United States', timezone: 'America/New_York' },
  { code: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', country: 'United States', timezone: 'America/Los_Angeles' },
  { code: 'SEA', name: 'Seattle-Tacoma Intl', city: 'Seattle', country: 'United States', timezone: 'America/Los_Angeles' },
  { code: 'MIA', name: 'Miami Intl', city: 'Miami', country: 'United States', timezone: 'America/New_York' },
  { code: 'BOS', name: 'Logan Intl', city: 'Boston', country: 'United States', timezone: 'America/New_York' },
  { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom', timezone: 'Europe/London' },
  { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', timezone: 'Europe/Paris' },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
  { code: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam' },
  { code: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Spain', timezone: 'Europe/Madrid' },
  { code: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat', city: 'Barcelona', country: 'Spain', timezone: 'Europe/Madrid' },
  { code: 'FCO', name: 'Leonardo da Vinci-Fiumicino', city: 'Rome', country: 'Italy', timezone: 'Europe/Rome' },
  { code: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', timezone: 'Europe/Zurich' },
  { code: 'DXB', name: 'Dubai Intl', city: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai' },
  { code: 'DOH', name: 'Hamad Intl', city: 'Doha', country: 'Qatar', timezone: 'Asia/Qatar' },
  { code: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
  { code: 'NRT', name: 'Tokyo Narita', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
  { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },
  { code: 'HKG', name: 'Hong Kong Intl', city: 'Hong Kong', country: 'China', timezone: 'Asia/Hong_Kong' },
  { code: 'ICN', name: 'Incheon Intl', city: 'Seoul', country: 'South Korea', timezone: 'Asia/Seoul' },
  { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', timezone: 'Asia/Bangkok' },
  { code: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney' },
  { code: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', timezone: 'Australia/Melbourne' },
  { code: 'YYZ', name: 'Toronto Pearson Intl', city: 'Toronto', country: 'Canada', timezone: 'America/Toronto' },
  { code: 'YVR', name: 'Vancouver Intl', city: 'Vancouver', country: 'Canada', timezone: 'America/Vancouver' },
  { code: 'MEX', name: 'Benito Juárez Intl', city: 'Mexico City', country: 'Mexico', timezone: 'America/Mexico_City' },
  { code: 'GRU', name: 'São Paulo/Guarulhos Intl', city: 'São Paulo', country: 'Brazil', timezone: 'America/Sao_Paulo' },
  { code: 'EZE', name: 'Ministro Pistarini Intl', city: 'Buenos Aires', country: 'Argentina', timezone: 'America/Argentina/Buenos_Aires' },
  { code: 'CAI', name: 'Cairo Intl', city: 'Cairo', country: 'Egypt', timezone: 'Africa/Cairo' },
  { code: 'JNB', name: 'O. R. Tambo Intl', city: 'Johannesburg', country: 'South Africa', timezone: 'Africa/Johannesburg' },
  { code: 'DEL', name: 'Indira Gandhi Intl', city: 'New Delhi', country: 'India', timezone: 'Asia/Kolkata' },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj Intl', city: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata' },
  { code: 'PEK', name: 'Beijing Capital Intl', city: 'Beijing', country: 'China', timezone: 'Asia/Shanghai' },
  { code: 'PVG', name: 'Shanghai Pudong Intl', city: 'Shanghai', country: 'China', timezone: 'Asia/Shanghai' },
  { code: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', timezone: 'Pacific/Auckland' },
];

const AIRCRAFT_MODELS = [
  { model: 'Boeing 737-800', capacity: 180 },
  { model: 'Boeing 737 MAX 8', capacity: 178 },
  { model: 'Airbus A320neo', capacity: 180 },
  { model: 'Airbus A321neo', capacity: 220 },
  { model: 'Boeing 777-300ER', capacity: 396 },
  { model: 'Airbus A350-900', capacity: 325 },
  { model: 'Boeing 787-9', capacity: 290 },
  { model: 'Airbus A330-300', capacity: 277 },
  { model: 'Embraer E190', capacity: 100 },
];

const AIRLINES = ['AA', 'DL', 'UA', 'BA', 'LH', 'AF', 'EK', 'SQ', 'NH', 'QF', 'AC', 'KL'];

const GATES = ['A1', 'A5', 'B12', 'B20', 'C4', 'C15', 'D8', 'D22', 'E3', 'F10', 'G18'];

const INCIDENT_TYPES = ['MECHANICAL', 'WEATHER', 'MEDICAL', 'SECURITY', 'BAGGAGE', 'CREW_SHORTAGE'];
const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const INCIDENT_DESCRIPTIONS: Record<string, string[]> = {
  MECHANICAL: [
    'Hydraulic pressure indicator warning during taxiing.',
    'Avionics sensor fault detected during pre-flight diagnostics.',
    'Auxiliary power unit (APU) restart required at gate.',
  ],
  WEATHER: [
    'Severe convective turbulence along flight plan route.',
    'De-icing delay due to freezing precipitation.',
    'High crosswind advisory at destination runway.',
  ],
  MEDICAL: [
    'Passenger medical assistance required prior to pushback.',
    'In-flight medical evaluation for passenger experiencing dizziness.',
  ],
  SECURITY: [
    'Unattended baggage sweep conducted in jetbridge.',
    'Passenger baggage rescreening requested by airport security.',
  ],
  BAGGAGE: [
    'Baggage sorting system belt jam causing loading delay.',
    'Cargo door actuator latch check required before loading.',
  ],
  CREW_SHORTAGE: [
    'Flight crew duty hour limit extension required reserve replacement.',
    'Inbound connecting crew delayed due to air traffic hold.',
  ],
};

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseCountArgument(): { count: number; reset: boolean } {
  const args = process.argv.slice(2);
  let count = 10000;
  let reset = false;

  for (const arg of args) {
    if (arg === '--reset' || arg === '-r') {
      reset = true;
      continue;
    }

    const cleanArg = arg.toLowerCase().replace('--count=', '');
    if (cleanArg.endsWith('k')) {
      const num = parseFloat(cleanArg.slice(0, -1));
      if (!isNaN(num)) count = Math.round(num * 1000);
    } else if (cleanArg.endsWith('m')) {
      const num = parseFloat(cleanArg.slice(0, -1));
      if (!isNaN(num)) count = Math.round(num * 1000000);
    } else {
      const num = parseInt(cleanArg, 10);
      if (!isNaN(num) && num > 0) count = num;
    }
  }

  return { count, reset };
}

async function runSeed() {
  const { count: totalFlights, reset } = parseCountArgument();
  console.log(`\n✈️  AirOps Seeder Initialized`);
  console.log(`   Target Flights Count: ${totalFlights.toLocaleString()}`);
  console.log(`   Reset Database First: ${reset ? 'YES' : 'NO'}`);
  console.log(`   Database URL: ${env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  const startTime = performance.now();

  try {
    if (reset) {
      console.log('🧹 Truncating existing tables...');
      await client.query('TRUNCATE TABLE incidents, flight_events, flights, aircraft, airports RESTART IDENTITY CASCADE;');
      console.log('✓ Tables truncated cleanly.\n');
    }

    // 1. Seed Airports if not populated
    const existingAirportsRes = await client.query('SELECT count(*) FROM airports;');
    let airportIds: number[] = [];

    if (parseInt(existingAirportsRes.rows[0].count, 10) === 0) {
      console.log(`📍 Inserting ${AIRPORTS_DATA.length} reference airports...`);
      const airportInsertQuery = `
        INSERT INTO airports (code, name, city, country, timezone)
        VALUES ${AIRPORTS_DATA.map(
          (_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
        ).join(', ')}
        RETURNING id;
      `;
      const airportValues = AIRPORTS_DATA.flatMap((a) => [a.code, a.name, a.city, a.country, a.timezone]);
      const res = await client.query(airportInsertQuery, airportValues);
      airportIds = res.rows.map((r) => r.id);
      console.log(`✓ Inserted ${airportIds.length} airports.`);
    } else {
      const res = await client.query('SELECT id FROM airports;');
      airportIds = res.rows.map((r) => r.id);
      console.log(`✓ Using ${airportIds.length} existing airports.`);
    }

    // 2. Seed Aircraft fleet (250 aircraft)
    const existingAircraftRes = await client.query('SELECT count(*) FROM aircraft;');
    let aircraftMap: Array<{ id: number; capacity: number }> = [];

    if (parseInt(existingAircraftRes.rows[0].count, 10) === 0) {
      console.log(`🛩️ Inserting 250 reference aircraft...`);
      const aircraftRowsToInsert: Array<[string, string, number, string]> = [];
      const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'MAINTENANCE', 'RETIRED'];

      for (let i = 1; i <= 250; i++) {
        const modelObj = AIRCRAFT_MODELS[i % AIRCRAFT_MODELS.length];
        const regPrefix = i <= 100 ? 'N' : i <= 170 ? 'G-' : i <= 210 ? 'JA' : 'D-';
        const registration = `${regPrefix}${1000 + i}${String.fromCharCode(65 + (i % 26))}`;
        const status = getRandomElement(statuses);
        aircraftRowsToInsert.push([registration, modelObj.model, modelObj.capacity, status]);
      }

      const aircraftInsertQuery = `
        INSERT INTO aircraft (registration, model, capacity, status)
        VALUES ${aircraftRowsToInsert
          .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
          .join(', ')}
        RETURNING id, capacity;
      `;
      const aircraftValues = aircraftRowsToInsert.flat();
      const res = await client.query(aircraftInsertQuery, aircraftValues);
      aircraftMap = res.rows.map((r) => ({ id: r.id, capacity: r.capacity }));
      console.log(`✓ Inserted ${aircraftMap.length} aircraft.`);
    } else {
      const res = await client.query('SELECT id, capacity FROM aircraft;');
      aircraftMap = res.rows.map((r) => ({ id: r.id, capacity: r.capacity }));
      console.log(`✓ Using ${aircraftMap.length} existing aircraft.`);
    }

    // 3. High-Volume Flights Bulk Generator
    console.log(`\n🚀 Generating ${totalFlights.toLocaleString()} flights with chunked batching...`);

    // BATCH_SIZE set to 2,000 to keep parameter counts well below PostgreSQL limits (< 30,000 per query)
    const BATCH_SIZE = 2000;
    const now = new Date();

    let totalFlightsInserted = 0;
    let totalEventsInserted = 0;
    let totalIncidentsInserted = 0;

    for (let offset = 0; offset < totalFlights; offset += BATCH_SIZE) {
      const currentBatchSize = Math.min(BATCH_SIZE, totalFlights - offset);
      const flightParams: any[] = [];
      const flightValueRows: string[] = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const globalIdx = offset + i;
        const airlineCode = getRandomElement(AIRLINES);
        const flightNumber = `${airlineCode}${getRandomInt(100, 9999)}`;
        
        let originAirportId = getRandomElement(airportIds);
        let destinationAirportId = getRandomElement(airportIds);
        while (destinationAirportId === originAirportId) {
          destinationAirportId = getRandomElement(airportIds);
        }

        const aircraftObj = getRandomElement(aircraftMap);

        const daysOffset = (globalIdx % 30) - 25;
        const hourOffset = getRandomInt(0, 23);
        const minOffset = getRandomInt(0, 59);

        const scheduledDeparture = new Date(now.getTime() + daysOffset * 86400000 + hourOffset * 3600000 + minOffset * 60000);
        const flightDurationMins = getRandomInt(90, 720);
        const scheduledArrival = new Date(scheduledDeparture.getTime() + flightDurationMins * 60000);

        let status = 'SCHEDULED';
        let delayMinutes = 0;
        let actualDeparture: Date | null = null;
        let actualArrival: Date | null = null;

        if (scheduledArrival < now) {
          const rand = Math.random();
          if (rand < 0.04) {
            status = 'CANCELLED';
          } else if (rand < 0.18) {
            status = 'DELAYED';
            delayMinutes = getRandomInt(15, 240);
            actualDeparture = new Date(scheduledDeparture.getTime() + delayMinutes * 60000);
            actualArrival = new Date(scheduledArrival.getTime() + delayMinutes * 60000);
          } else {
            status = 'ARRIVED';
            delayMinutes = getRandomInt(-5, 10);
            actualDeparture = new Date(scheduledDeparture.getTime() + (delayMinutes > 0 ? delayMinutes : 0) * 60000);
            actualArrival = new Date(scheduledArrival.getTime() + delayMinutes * 60000);
          }
        } else if (scheduledDeparture <= now && now <= scheduledArrival) {
          const rand = Math.random();
          if (rand < 0.4) {
            status = 'BOARDING';
            actualDeparture = new Date(scheduledDeparture.getTime() + getRandomInt(0, 15) * 60000);
          } else {
            status = 'DEPARTED';
            actualDeparture = new Date(scheduledDeparture.getTime() + getRandomInt(-2, 10) * 60000);
          }
        } else {
          status = Math.random() < 0.05 ? 'CANCELLED' : 'SCHEDULED';
        }

        const gate = getRandomElement(GATES);
        const passengerCount = status === 'CANCELLED' ? 0 : getRandomInt(Math.floor(aircraftObj.capacity * 0.6), aircraftObj.capacity);

        const pIdx = i * 14;
        flightValueRows.push(
          `($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11}, $${pIdx + 12}, $${pIdx + 13}, $${pIdx + 14})`
        );

        flightParams.push(
          flightNumber,
          airlineCode,
          originAirportId,
          destinationAirportId,
          aircraftObj.id,
          scheduledDeparture.toISOString(),
          scheduledArrival.toISOString(),
          actualDeparture ? actualDeparture.toISOString() : null,
          actualArrival ? actualArrival.toISOString() : null,
          gate,
          status,
          delayMinutes,
          passengerCount,
          scheduledDeparture.toISOString()
        );
      }

      // Execute Flights Bulk Insert
      const flightsQuery = `
        INSERT INTO flights (
          flight_number, airline_code, origin_airport_id, destination_airport_id,
          aircraft_id, scheduled_departure, scheduled_arrival, actual_departure,
          actual_arrival, gate, status, delay_minutes, passenger_count, created_at
        )
        VALUES ${flightValueRows.join(', ')}
        RETURNING id, status, scheduled_departure, actual_departure, actual_arrival;
      `;

      const insertRes = await client.query(flightsQuery, flightParams);
      totalFlightsInserted += insertRes.rows.length;

      // Build Events & Incidents Array
      const rawEvents: Array<{ flightId: number; type: string; message: string; time: string }> = [];
      const rawIncidents: Array<{ flightId: number; severity: string; type: string; status: string; description: string; resolvedAt: string | null }> = [];

      for (const row of insertRes.rows) {
        const fId = row.id;
        const fStatus = row.status;
        const schedDep = new Date(row.scheduled_departure);

        rawEvents.push({ flightId: fId, type: 'SCHEDULED', message: 'Flight schedule published in system.', time: schedDep.toISOString() });

        if (fStatus === 'BOARDING' || fStatus === 'DEPARTED' || fStatus === 'ARRIVED') {
          const boardingTime = new Date(schedDep.getTime() - 40 * 60000);
          rawEvents.push({ flightId: fId, type: 'BOARDING_STARTED', message: 'Gate boarding commenced.', time: boardingTime.toISOString() });
        }

        if (fStatus === 'DEPARTED' || fStatus === 'ARRIVED') {
          const depTime = row.actual_departure ? new Date(row.actual_departure) : schedDep;
          rawEvents.push({ flightId: fId, type: 'DEPARTED', message: 'Aircraft pushback and takeoff completed.', time: depTime.toISOString() });
        }

        if (fStatus === 'ARRIVED') {
          const arrTime = row.actual_arrival ? new Date(row.actual_arrival) : new Date(schedDep.getTime() + 120 * 60000);
          rawEvents.push({ flightId: fId, type: 'ARRIVED', message: 'Touchdown and block arrival confirmed at gate.', time: arrTime.toISOString() });
        }

        if (fStatus === 'CANCELLED') {
          rawEvents.push({ flightId: fId, type: 'CANCELLED', message: 'Flight cancelled due to operational constraints.', time: schedDep.toISOString() });
        }

        if (Math.random() < 0.03) {
          const incType = getRandomElement(INCIDENT_TYPES);
          const incSev = getRandomElement(INCIDENT_SEVERITIES);
          const incDesc = getRandomElement(INCIDENT_DESCRIPTIONS[incType]);
          const incStatus = Math.random() < 0.75 ? 'RESOLVED' : 'INVESTIGATING';
          const resolvedAt = incStatus === 'RESOLVED' ? new Date(schedDep.getTime() + 45 * 60000).toISOString() : null;

          rawIncidents.push({ flightId: fId, severity: incSev, type: incType, status: incStatus, description: incDesc, resolvedAt });
        }
      }

      // Chunked Bulk Insert for Flight Events (1,000 rows per query chunk)
      const EVENT_CHUNK_SIZE = 1000;
      for (let eOff = 0; eOff < rawEvents.length; eOff += EVENT_CHUNK_SIZE) {
        const eChunk = rawEvents.slice(eOff, eOff + EVENT_CHUNK_SIZE);
        const eValueRows: string[] = [];
        const eParams: any[] = [];

        eChunk.forEach((ev, idx) => {
          const p = idx * 4;
          eValueRows.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4})`);
          eParams.push(ev.flightId, ev.type, ev.message, ev.time);
        });

        if (eValueRows.length > 0) {
          const q = `INSERT INTO flight_events (flight_id, event_type, message, event_time) VALUES ${eValueRows.join(', ')};`;
          await client.query(q, eParams);
          totalEventsInserted += eChunk.length;
        }
      }

      // Chunked Bulk Insert for Incidents (1,000 rows per query chunk)
      const INCIDENT_CHUNK_SIZE = 1000;
      for (let iOff = 0; iOff < rawIncidents.length; iOff += INCIDENT_CHUNK_SIZE) {
        const iChunk = rawIncidents.slice(iOff, iOff + INCIDENT_CHUNK_SIZE);
        const iValueRows: string[] = [];
        const iParams: any[] = [];

        iChunk.forEach((inc, idx) => {
          const p = idx * 6;
          iValueRows.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6})`);
          iParams.push(inc.flightId, inc.severity, inc.type, inc.status, inc.description, inc.resolvedAt);
        });

        if (iValueRows.length > 0) {
          const q = `INSERT INTO incidents (flight_id, severity, type, status, description, resolved_at) VALUES ${iValueRows.join(', ')};`;
          await client.query(q, iParams);
          totalIncidentsInserted += iChunk.length;
        }
      }

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`   Progress: ${totalFlightsInserted.toLocaleString()} / ${totalFlights.toLocaleString()} flights seeded (${elapsedSec}s)...`);
    }

    const durationSec = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Seeding Complete in ${durationSec} seconds!`);
    console.log(`   ------------------------------------------`);
    console.log(`   Airports Total:  ${airportIds.length.toLocaleString()}`);
    console.log(`   Aircraft Total:  ${aircraftMap.length.toLocaleString()}`);
    console.log(`   Flights Total:   ${totalFlightsInserted.toLocaleString()}`);
    console.log(`   Events Total:    ${totalEventsInserted.toLocaleString()}`);
    console.log(`   Incidents Total: ${totalIncidentsInserted.toLocaleString()}`);
    console.log(`   ------------------------------------------\n`);

  } catch (err) {
    console.error('❌ Seeding failed with error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
