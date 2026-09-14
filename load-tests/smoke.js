/**
 * Smoke Test Scenario
 * Quick sanity check to verify API is responsive and basic endpoints work
 * 
 * Usage:
 *   k6 run load-tests/smoke.js
 *   K6_VUS=5 K6_DURATION=1m k6 run load-tests/smoke.js
 *   API_BASE_URL=http://api.example.com k6 run load-tests/smoke.js
 */

import { check, group, sleep } from 'k6';
import { getLoadConfig, logTestStart, logTestComplete } from './config.js';
import {
  healthCheck,
  browseFlights,
  searchFlights,
  getFlightDetails,
  getDashboardMetrics,
  listAirports,
  executeRealisticMixedWorkload,
  sleepThinkTime,
} from './helpers.js';

// Get load configuration - allow override via environment variables
const loadLevel = __ENV.LOAD_LEVEL || 'smoke';
const config = getLoadConfig(loadLevel);

export const options = {
  vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : config.vus,
  duration: __ENV.K6_DURATION || config.duration,

  thresholds: {
    // HTTP request duration thresholds
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],

    // Custom metric thresholds
    'http_reqs': ['rate>0'], // At least some requests should succeed
  },

  // Summaries to include in output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)', 'count'],
};

/**
 * Setup phase - runs once before test execution
 */
export function setup() {
  console.log('\n');
  logTestStart('SMOKE TEST', {
    vus: options.vus,
    duration: options.duration,
  });

  // Verify API is reachable
  const apiHealthy = healthCheck();
  if (!apiHealthy) {
    throw new Error('API health check failed - cannot proceed with smoke test');
  }

  console.log('✓ Smoke test setup complete\n');
  return {};
}

/**
 * Main test function - VU execution
 */
export default function (data) {
  group('01_Health & Connectivity', () => {
    check(healthCheck(), {
      'health check endpoint returns true': (result) => result === true,
    });
    sleepThinkTime('quick');
  });

  group('02_Read Airports', () => {
    const result = listAirports();
    check(result, {
      'airports endpoint returns 200': (r) => r.status === 200,
      'at least some airports returned': (r) => r.airportCount > 0,
    });
    sleepThinkTime('normal');
  });

  group('03_Browse Flights', () => {
    const result = browseFlights({ page: 1, limit: 20 });
    check(result, {
      'browse flights returns 200': (r) => r.status === 200,
      'flights list is not empty': (r) => r.flightCount > 0,
      'pagination total is reasonable': (r) => r.total > 0,
    });
    sleepThinkTime('browsing');
  });

  group('04_Search Flights', () => {
    const result = searchFlights('AA', { status: 'SCHEDULED' });
    check(result, {
      'search flights returns 200': (r) => r.status === 200,
      'search returns results': (r) => r.resultCount >= 0, // 0 is acceptable if no matches
    });
    sleepThinkTime('normal');
  });

  group('05_Get Flight Details', () => {
    const result = getFlightDetails();
    check(result, {
      'flight details endpoint responds': (r) => r.status === 200,
      'flight data has required fields': (r) => r.flightNumber !== null,
    });
    sleepThinkTime('browsing');
  });

  group('06_Dashboard Metrics', () => {
    const result = getDashboardMetrics();
    check(result, {
      'dashboard endpoint returns 200': (r) => r.status === 200,
      'dashboard has total flights': (r) => r.totalFlights > 0,
      'dashboard has active incidents': (r) => r.activeIncidents >= 0,
    });
    sleepThinkTime('normal');
  });

  group('07_Mixed Workload Sample', () => {
    // Execute one realistic mixed workload session
    executeRealisticMixedWorkload();
  });
}

/**
 * Teardown phase - runs once after test execution
 */
export function teardown(data) {
  console.log('\n');
  logTestComplete('SMOKE TEST');
  console.log('Smoke test finished. Use checks, thresholds and exit code to determine success.\n');
}
