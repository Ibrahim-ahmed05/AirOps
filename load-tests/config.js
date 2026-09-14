/**
 * K6 Load Testing Configuration
 * Centralized environment and utility configuration for all test scenarios
 */

export const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:4000';

/**
 * Virtual User (VU) Configurations by Load Level
 * These presets make it easy to run tests at different concurrency levels
 */
export const LOAD_LEVELS = {
  smoke: {
    vus: 1,
    duration: '30s',
    description: 'Quick sanity check - 1 VU for 30s',
  },
  light: {
    vus: 10,
    duration: '2m',
    description: 'Light load - 10 VUs for 2 minutes',
  },
  moderate: {
    vus: 50,
    duration: '5m',
    description: 'Moderate load - 50 VUs for 5 minutes',
  },
  heavy: {
    vus: 100,
    duration: '5m',
    description: 'Heavy load - 100 VUs for 5 minutes',
  },
  intense: {
    vus: 150,
    duration: '5m',
    description: 'Intense load - 150 VUs for 5 minutes',
  },
  extreme: {
    vus: 250,
    duration: '5m',
    description: 'Extreme load - 250 VUs for 5 minutes',
  },
  crushing: {
    vus: 500,
    duration: '3m',
    description: 'Crushing load - 500 VUs for 3 minutes',
  },
  breaking: {
    vus: 1000,
    duration: '2m',
    description: 'Breaking point - 1000 VUs for 2 minutes (HIGH RISK)',
  },
};

/**
 * Get load configuration by name or level
 * Usage: getLoadConfig('moderate') -> { vus: 50, duration: '5m' }
 */
export function getLoadConfig(levelName = 'smoke') {
  const config = LOAD_LEVELS[levelName];
  if (!config) {
    throw new Error(
      `Unknown load level: ${levelName}. Available: ${Object.keys(LOAD_LEVELS).join(', ')}`
    );
  }
  return config;
}

/**
 * Performance Thresholds
 * Used to classify system state as Stable, Degraded, or Unstable
 */
export const PERFORMANCE_THRESHOLDS = {
  stable: {
    p95_latency_ms: 1000,
    error_rate_percent: 1,
    description: 'p95 < 1s, errors < 1%, system fully operational',
  },
  degraded: {
    p95_latency_ms: 3000,
    error_rate_percent: 5,
    description: 'p95 between 1-3s, errors < 5%, system usable with slowdown',
  },
  unstable: {
    p95_latency_ms: Infinity,
    error_rate_percent: Infinity,
    description: 'p95 > 3s, errors > 5%, major timeouts and broken workflows',
  },
};

/**
 * Standard HTTP request options for all test scenarios
 * Includes timeouts and headers
 */
export const HTTP_REQUEST_OPTIONS = {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'k6-load-test/1.0',
  },
  timeout: '10s',
  responseType: 'text',
};

/**
 * Flight Data Ranges
 * Used for realistic data sampling in tests
 */
export const FLIGHT_DATA = {
  // Sample flight IDs (adjust based on your seeded data volume)
  flightIdRange: { min: 1, max: 10000 },

  // Common flight statuses for filtering tests
  statuses: ['SCHEDULED', 'BOARDING', 'DEPARTED', 'DELAYED', 'ARRIVED', 'CANCELLED'],

  // Sample airport codes for filtering
  airportCodes: ['LAX', 'JFK', 'ORD', 'DFW', 'DEN', 'ATL', 'SFO', 'SEA', 'MIA', 'BOS'],

  // Pagination defaults
  pageLimits: [10, 20, 50, 100],
};

/**
 * Realistic thinking time between requests (in milliseconds)
 * Simulates user behavior like reading, clicking, etc.
 */
export const THINK_TIMES = {
  quick: 100, // Fast navigation
  normal: 500, // Average user interaction
  browsing: 1000, // User reading and reviewing
  searching: 2000, // User typing and applying filters
};

/**
 * Request tracking for metrics collection
 * Maps request names to their purpose
 */
export const REQUEST_NAMES = {
  // Read operations
  'GET /health': 'health_check',
  'GET /api/airports': 'list_airports',
  'GET /api/flights': 'list_flights',
  'GET /api/flights/:id': 'get_flight_detail',
  'GET /api/dashboard': 'dashboard_metrics',

  // Write operations
  'PATCH /api/flights/:id/status': 'update_flight_status',
};

/**
 * API Endpoints
 */
export const ENDPOINTS = {
  health: '/health',
  airports: '/api/airports',
  flights: '/api/flights',
  flightDetail: '/api/flights/{id}',
  dashboard: '/api/dashboard',
  updateFlightStatus: '/api/flights/{id}/status',
};

/**
 * Logging helper for test scenarios
 */
export function logTestStart(testName, config) {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  K6 LOAD TEST: ${testName.padEnd(30)}   ║
║  VUs: ${config.vus.toString().padEnd(6)} Duration: ${config.duration.padEnd(8)}                  ║
║  API: ${API_BASE_URL.padEnd(40)}║
╚════════════════════════════════════════════════════════╝
  `);
}

export function logTestComplete(testName) {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  TEST COMPLETE: ${testName.padEnd(30)}     ║
╚════════════════════════════════════════════════════════╝
  `);
}
