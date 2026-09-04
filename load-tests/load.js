/**
 * Load Test Scenario
 * Realistic sustained load with mixed workload distribution
 * 
 * This test simulates realistic user behavior across all endpoints:
 * - 60% browsing/listing flights
 * - 20% search/filter/sort activity
 * - 10% dashboard requests
 * - 10% flight status reads/writes
 * 
 * Usage:
 *   k6 run load-tests/load.js                              # Default: 50 VUs, 5 min
 *   K6_VUS=100 K6_DURATION=10m k6 run load-tests/load.js  # Custom: 100 VUs, 10 min
 *   LOAD_LEVEL=heavy k6 run load-tests/load.js            # Use preset: heavy load (100 VUs)
 */

import { check, group } from 'k6';
import { getLoadConfig, logTestStart, logTestComplete } from './config.js';
import {
  browseFlights,
  searchFlights,
  getFlightDetails,
  getDashboardMetrics,
  updateFlightStatus,
  executeRealisticMixedWorkload,
  sleepThinkTime,
} from './helpers.js';

// Get load configuration - allow override via environment variables
const loadLevel = __ENV.LOAD_LEVEL || 'moderate';
const config = getLoadConfig(loadLevel);

export const options = {
  vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : config.vus,
  duration: __ENV.K6_DURATION || config.duration,

  stages: [
    // Ramp-up: gradually increase load
    { duration: '2m', target: Math.floor(options.vus * 0.5) },
    // Sustained load at full capacity
    { duration: '3m', target: options.vus },
    // Cool-down: gradually decrease load
    { duration: '1m', target: 0 },
  ],

  thresholds: {
    // Response time thresholds
    http_req_duration: [
      'p(50)<500', // Median response under 500ms
      'p(95)<1500', // 95th percentile under 1.5s (Stable threshold is <1s)
      'p(99)<3000', // 99th percentile under 3s
    ],

    // Error rate threshold (allow up to 2% errors during load test)
    http_req_failed: ['rate<0.02'],

    // Request rate
    'http_reqs': ['rate>100'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)', 'count'],
};

/**
 * Setup phase
 */
export function setup() {
  console.log('\n');
  logTestStart('LOAD TEST (MIXED WORKLOAD)', {
    vus: options.vus,
    duration: options.duration,
  });

  console.log('Workload Distribution:');
  console.log('  - 60% Browsing (list flights, pagination)');
  console.log('  - 20% Searching (filters, sorting)');
  console.log('  - 10% Dashboard (metrics view)');
  console.log('  - 10% Status Updates (write operations)\n');

  return {};
}

/**
 * Main test function - VU execution
 */
export default function (data) {
  group('Mixed_Workload_Realistic_Distribution', () => {
    // Execute a realistic mixed workload session
    executeRealisticMixedWorkload();
  });

  // Brief pause before next iteration
  sleepThinkTime('quick');
}

/**
 * Teardown phase
 */
export function teardown(data) {
  console.log('\n');
  logTestComplete('LOAD TEST');
  console.log('Load test completed. Review metrics for performance classification:\n');
  console.log('  STABLE:    p95 < 1.0s, errors < 1%');
  console.log('  DEGRADED:  p95 < 3.0s, errors < 5%');
  console.log('  UNSTABLE:  p95 > 3.0s, errors > 5%\n');
}
