/**
 * AirOps Sprint 4 — Baseline API Benchmark Script
 *
 * Measures raw API response times, payload sizes, and structural behavior
 * for all major endpoints. Runs multiple samples and reports p50/p95/avg.
 *
 * Usage: node apps/api/scripts/benchmark.mjs [--runs=N]
 */

import http from 'http';
import { performance } from 'perf_hooks';

const API_BASE = 'http://localhost:4000';
const DEFAULT_RUNS = 10;

const args = process.argv.slice(2);
const runsArg = args.find((a) => a.startsWith('--runs='));
const RUNS = runsArg ? parseInt(runsArg.split('=')[1], 10) : DEFAULT_RUNS;

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        const durationMs = performance.now() - start;
        const byteSize = Buffer.byteLength(raw, 'utf8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) {}
        resolve({ statusCode: res.statusCode, durationMs, byteSize, data: parsed, raw });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ─── Stats Helper ─────────────────────────────────────────────────────────────

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  return {
    min: sorted[0].toFixed(1),
    avg: avg.toFixed(1),
    p50: percentile(sorted, 50).toFixed(1),
    p95: percentile(sorted, 95).toFixed(1),
    max: sorted[sorted.length - 1].toFixed(1),
  };
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ─── Endpoint Definitions ─────────────────────────────────────────────────────

const endpoints = [
  {
    name: 'GET /health',
    url: `${API_BASE}/health`,
  },
  {
    name: 'GET /api/airports',
    url: `${API_BASE}/api/airports`,
  },
  {
    name: 'GET /api/dashboard',
    url: `${API_BASE}/api/dashboard`,
  },
  {
    name: 'GET /api/flights (page=1 limit=20)',
    url: `${API_BASE}/api/flights?page=1&limit=20`,
  },
  {
    name: 'GET /api/flights (page=1 limit=50)',
    url: `${API_BASE}/api/flights?page=1&limit=50`,
  },
  {
    name: 'GET /api/flights (page=50 limit=20) — deep offset',
    url: `${API_BASE}/api/flights?page=50&limit=20`,
  },
  {
    name: 'GET /api/flights (status=DELAYED)',
    url: `${API_BASE}/api/flights?status=DELAYED&limit=20`,
  },
  {
    name: 'GET /api/flights (search=AA)',
    url: `${API_BASE}/api/flights?search=AA&limit=20`,
  },
];

// ─── Main Runner ─────────────────────────────────────────────────────────────

async function run() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  AirOps — Sprint 4 Baseline API Benchmark');
  console.log(`  Runs per endpoint: ${RUNS}`);
  console.log(`  Target:            ${API_BASE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Warm up the API (first request often hits cold pool)
  console.log('⏳ Warming up connection pool (3 warm-up requests)...');
  for (let i = 0; i < 3; i++) {
    await httpGet(`${API_BASE}/api/dashboard`).catch(() => {});
  }
  console.log('✓ Warm-up complete.\n');

  const results = [];

  for (const ep of endpoints) {
    process.stdout.write(`  Benchmarking: ${ep.name} ...`);
    const times = [];
    let lastResult = null;

    for (let i = 0; i < RUNS; i++) {
      try {
        const res = await httpGet(ep.url);
        times.push(res.durationMs);
        lastResult = res;
      } catch (err) {
        times.push(9999);
      }
    }

    const s = stats(times);
    const byteSize = lastResult?.byteSize ?? 0;
    const status = lastResult?.statusCode ?? '?';

    // Extra structural info
    let rowCount = null;
    let paginationTotal = null;
    if (lastResult?.data?.data && Array.isArray(lastResult.data.data)) {
      rowCount = lastResult.data.data.length;
    }
    if (lastResult?.data?.pagination?.total !== undefined) {
      paginationTotal = lastResult.data.pagination.total;
    }

    results.push({ name: ep.name, status, s, byteSize, rowCount, paginationTotal });
    console.log(` done [HTTP ${status}]`);
  }

  // ─── Single Flight Detail ─────────────────────────────────────────────────
  let flightId = 1;
  try {
    const firstFlight = await httpGet(`${API_BASE}/api/flights?page=1&limit=1`);
    flightId = firstFlight.data?.data?.[0]?.id ?? 1;
  } catch (_) {}

  process.stdout.write(`  Benchmarking: GET /api/flights/${flightId} (detail) ...`);
  const detailTimes = [];
  let detailResult = null;
  for (let i = 0; i < RUNS; i++) {
    try {
      const res = await httpGet(`${API_BASE}/api/flights/${flightId}`);
      detailTimes.push(res.durationMs);
      detailResult = res;
    } catch (_) {
      detailTimes.push(9999);
    }
  }
  const ds = stats(detailTimes);
  results.push({
    name: `GET /api/flights/${flightId} (detail)`,
    status: detailResult?.statusCode ?? '?',
    s: ds,
    byteSize: detailResult?.byteSize ?? 0,
    rowCount: null,
    paginationTotal: null,
  });
  console.log(` done [HTTP ${detailResult?.statusCode ?? '?'}]`);

  // ─── Report ───────────────────────────────────────────────────────────────

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Table header
  const COL_NAME = 42;
  const COL = 8;
  const header = [
    'Endpoint'.padEnd(COL_NAME),
    'HTTP'.padStart(4),
    'Payload'.padStart(COL + 2),
    'Min ms'.padStart(COL),
    'Avg ms'.padStart(COL),
    'p50 ms'.padStart(COL),
    'p95 ms'.padStart(COL),
    'Max ms'.padStart(COL),
    'Rows'.padStart(6),
    'Total'.padStart(8),
  ].join('  ');

  console.log(header);
  console.log('─'.repeat(header.length));

  for (const r of results) {
    const line = [
      r.name.padEnd(COL_NAME).slice(0, COL_NAME),
      String(r.status).padStart(4),
      kb(r.byteSize).padStart(COL + 2),
      r.s.min.padStart(COL),
      r.s.avg.padStart(COL),
      r.s.p50.padStart(COL),
      r.s.p95.padStart(COL),
      r.s.max.padStart(COL),
      (r.rowCount !== null ? String(r.rowCount) : '—').padStart(6),
      (r.paginationTotal !== null ? r.paginationTotal.toLocaleString() : '—').padStart(8),
    ].join('  ');
    console.log(line);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Naive Behavior Observations\n');
  console.log('  1. GET /api/flights performs TWO sequential queries per call:');
  console.log('     - COUNT(*) query (full table scan with joins) for pagination total');
  console.log('     - SELECT query (data + 3-way JOIN: airports x2, aircraft)');
  console.log('     Both queries run on EVERY request with no caching.');
  console.log();
  console.log('  2. GET /api/dashboard issues TWO sequential queries:');
  console.log('     - Aggregate query: full table scan across entire flights table');
  console.log('     - Incidents query: second full table scan across incidents');
  console.log('     Result is never cached. Every /dashboard page load recomputes.');
  console.log();
  console.log('  3. GET /api/flights response includes full nested objects for');
  console.log('     originAirport, destinationAirport, and aircraft per row.');
  console.log('     Each flight row carries ~350–400 bytes of JSON overhead.');
  console.log();
  console.log('  4. Searches use ILIKE with leading wildcard (%term%) — prevents');
  console.log('     index usage even when string indexes exist.');
  console.log();
  console.log('  5. Pagination offset scales linearly: page 50 with limit 20');
  console.log('     causes PostgreSQL to read and discard 980 rows before returning 20.');
  console.log();
  console.log('  6. Navigation bar component polls GET /health every 8–10s from');
  console.log('     every page. Each page independently issues the same health check.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Output raw JSON for docs
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    runs: RUNS,
    results: results.map((r) => ({
      endpoint: r.name,
      status: r.status,
      payloadBytes: r.byteSize,
      payloadKb: parseFloat(kb(r.byteSize)),
      timingMs: r.s,
      rows: r.rowCount,
      totalRecords: r.paginationTotal,
    })),
  };

  console.log('  JSON Output (for docs):\n');
  console.log(JSON.stringify(jsonOutput, null, 2));
  console.log();
}

run().catch((err) => {
  console.error('\n❌ Benchmark failed:', err.message);
  process.exit(1);
});
