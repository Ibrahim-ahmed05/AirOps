/**
 * Write Contention Test Scenario
 * Tests system behavior under concurrent write operations
 * 
 * Focuses on testing the PATCH /api/flights/:id/status endpoint
 * with high contention - many VUs attempting to update flight statuses concurrently.
 * 
 * This helps identify:
 * - Lock contention on flight records
 * - Database connection pool exhaustion
 * - Serialization issues
 * - Deadlock scenarios
 * 
 * Usage:
 *   k6 run load-tests/write-contention.js              # 50 VUs writing
 *   K6_VUS=100 k6 run load-tests/write-contention.js  # 100 VUs writing
 *   K6_VUS=250 k6 run load-tests/write-contention.js  # 250 VUs writing (HIGH CONTENTION)
 */

import { check, group } from 'k6';
import { getLoadConfig, logTestStart, logTestComplete } from './config.js';
import {
  updateFlightStatus,
  getFlightDetails,
  sleepThinkTime,
  randomInt,
} from './helpers.js';

// Configuration
const loadLevel = __ENV.LOAD_LEVEL || 'moderate';
const config = getLoadConfig(loadLevel);

export const options = {
  vus: __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : config.vus,
  duration: __ENV.K6_DURATION || '5m',


  thresholds: {
    // Write operations may be slower than reads
    http_req_duration: [
      'p(50)<1000',
      'p(95)<3000', // Allow higher latency for writes
      'p(99)<5000',
    ],

    // Some conflict is expected with writes
    http_req_failed: ['rate<0.05'],

    // Track write throughput
    'http_reqs': ['count>0'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)', 'count'],
};

/**
 * Setup phase
 */
export function setup() {
  if (__ENV.ALLOW_WRITES !== 'true') throw new Error('Set ALLOW_WRITES=true only against a disposable test database.');
  console.log('\n');
  logTestStart('WRITE CONTENTION TEST', {
    vus: options.vus,
    duration: options.duration,
  });

  console.log(`
Write Contention Test Focus:
  - Heavy emphasis on concurrent PATCH /api/flights/:id/status operations
  - Tests database locking behavior
  - Identifies serialization and deadlock scenarios
  - Measures impact of write contention on read operations

Test Mix:
  - 80% Flight status updates (WRITE operations)
  - 20% Flight detail reads (READ operations)
  
Expected Behavior:
  - Write operations will contend for row locks
  - Response times increase due to lock waits
  - Some 409 Conflict errors or timeouts possible
  - System should handle gracefully (no crashes/deadlocks)
  `);

  return {};
}

/**
 * Main test function - VU execution
 */
export default function (data) {
  group('01_Check_Flight_Status', () => {
    // Read the current flight status (20% of operations)
    const flightId = randomInt(1, 10000);
    const result = getFlightDetails(flightId);

    check(result, {
      'read operation successful': (r) => r.status === 200 || r.status === 404,
    });

    sleepThinkTime('quick');
  });

  group('02_Update_Flight_Status', () => {
    // Update flight status - this creates write contention (80% of operations)
    const updateCount = randomInt(2, 4); // Each VU does 2-4 updates per iteration

    for (let i = 0; i < updateCount; i++) {
      const result = updateFlightStatus();

      check(result, {
        'status update successful': (r) => r.isSuccess,
        'no unhandled errors': (r) => !r.isError,
      });

      sleepThinkTime('quick');
    }
  });

  // Light breathing room between iterations
  sleepThinkTime('normal');
}

/**
 * Teardown phase
 */
export function teardown(data) {
  console.log('\n');
  logTestComplete('WRITE CONTENTION TEST');
  console.log(`
Write Contention Test Analysis:
  
1. WRITE OPERATION PERFORMANCE:
   - Baseline write latency (p50, p95, p99)?
   - Did latency increase proportionally with VU count?
   - Signs of lock contention: exponential latency growth?

2. ERROR PATTERNS:
   - What types of errors occurred?
   - 409 Conflicts (optimistic lock violations)?
   - 503 Service Unavailable (connection pool exhaustion)?
   - Timeouts (lock wait timeouts)?
   - 400/500 server errors?

3. READ/WRITE INTERFERENCE:
   - Did read operations (getFlightDetails) get affected?
   - Latency increase for reads under write load?
   - Separate connection pool for reads vs writes?

4. SCALABILITY OBSERVATIONS:
   - Linear scaling: Latency increases linearly with VUs
   - Graceful degradation: System slows but remains operational
   - Cliff effect: System works until VU count threshold, then fails
   - Cascading failures: One bottleneck triggers others

5. RESOURCE INDICATORS:
   - Database connection pool fully utilized?
   - Any connection timeouts?
   - Connection leak indicators?
   - Query queue depth increasing?

RECOMMENDATIONS BASED ON FINDINGS:

If writes are fast even under contention (p95 <1s):
  ✓ Application concurrency handling is good
  ✓ Database locking strategy is efficient
  ✓ Can likely handle moderate write loads

If writes degrade linearly (p95 increases with VUs):
  ~ Normal behavior - lock contention is expected
  ~ Acceptable up to a point (your SLA determines threshold)
  ~ Consider: Partitioning, sharding, or async writes

If writes degrade exponentially or fail:
  ✗ Major bottleneck identified
  ✗ Investigate: Lock strategy, transaction duration, query plans
  ✗ Consider: Optimistic locking, batching, or read-write separation

If reads degrade significantly under write load:
  ✗ Blocking/locking affecting all operations
  ✗ Consider: Separate read replicas, read-only connections
  ✗ Review: Isolation level settings

Next Steps:
  - Profile application during peak contention
  - Review database slow query logs
  - Check lock wait times and deadlock logs
  - Consider implementing circuit breakers for write operations
  - Evaluate read replica strategy
  `);
}
