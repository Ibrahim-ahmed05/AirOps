/**
 * Stress Test Scenario
 * Progressive load increase to identify system breaking point
 * 
 * Gradually increases concurrent users to find where system starts to degrade
 * and eventually breaks. Helps identify scalability limits.
 * 
 * Usage:
 *   k6 run load-tests/stress.js                    # Progressive ramp to 250 VUs
 *   STRESS_TARGET=500 k6 run load-tests/stress.js # Ramp to 500 VUs
 *   STRESS_TARGET=1000 k6 run load-tests/stress.js # HIGH RISK - Ramp to 1000 VUs
 */

import { check, group } from 'k6';
import { logTestStart, logTestComplete } from './config.js';
import {
  executeRealisticMixedWorkload,
  sleepThinkTime,
} from './helpers.js';

// Configuration
const STRESS_TARGET = __ENV.STRESS_TARGET ? parseInt(__ENV.STRESS_TARGET) : 250;
const STEP_DURATION = '1m'; // How long each load level lasts
const STEP_SIZE = 25; // Increase VUs by this amount each step

if (STRESS_TARGET > 500) {
  console.warn(`
⚠️  WARNING: High stress target of ${STRESS_TARGET} VUs configured!
This could impact your development environment significantly.
Make sure database, API, and infrastructure are properly monitored.
  `);
}

export const options = {
  stages: (() => {
    const stages = [];
    // Generate stages: 0 -> STEP_SIZE -> 2*STEP_SIZE -> ... -> STRESS_TARGET
    for (let vus = 0; vus <= STRESS_TARGET; vus += STEP_SIZE) {
      stages.push({ duration: STEP_DURATION, target: vus });
    }
    // Hold at max for final duration
    stages.push({ duration: '2m', target: STRESS_TARGET });
    // Cool down
    stages.push({ duration: '1m', target: 0 });
    return stages;
  })(),

  thresholds: {
    // Response time - allow increasing latency as load ramps up
    http_req_duration: [
      'p(50)<1000', // Median can go up to 1s
      'p(95)<5000', // 95th percentile up to 5s as we stress
      'p(99)<10000', // 99th percentile up to 10s
    ],

    // Error rate - allow moderate errors during stress test
    http_req_failed: ['rate<0.05'], // Up to 5% errors

    // Minimum request rate should be maintained
    'http_reqs': ['rate>50'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

/**
 * Setup phase
 */
export function setup() {
  console.log('\n');
  logTestStart('STRESS TEST (PROGRESSIVE RAMP)', {
    vus: `0 → ${STRESS_TARGET}`,
    duration: `${STRESS_TARGET / STEP_SIZE * 1} min + cooldown`,
  });

  console.log(`
Progressive Load Ramp Configuration:
  - Starting VUs: 0
  - Target VUs: ${STRESS_TARGET}
  - Step Size: ${STEP_SIZE} VUs per minute
  - Total Ramp Time: ~${Math.ceil(STRESS_TARGET / STEP_SIZE)} minutes
  - Hold Time at Max: 2 minutes
  - Cool Down: 1 minute

Stages:
  `);

  let vus = 0;
  let stageNum = 1;
  while (vus <= STRESS_TARGET) {
    console.log(`  Stage ${stageNum}: ${vus} → ${Math.min(vus + STEP_SIZE, STRESS_TARGET)} VUs`);
    vus += STEP_SIZE;
    stageNum++;
  }
  console.log(`  Final Hold: ${STRESS_TARGET} VUs for 2 minutes`);
  console.log(`  Cool Down: ${STRESS_TARGET} → 0 VUs for 1 minute\n`);

  return {};
}

/**
 * Main test function - VU execution
 */
export default function (data) {
  group('Stress_Test_Mixed_Workload', () => {
    // Execute realistic mixed workload
    executeRealisticMixedWorkload();
  });

  sleepThinkTime('quick');
}

/**
 * Teardown phase
 */
export function teardown(data) {
  console.log('\n');
  logTestComplete('STRESS TEST');
  console.log(`
Stress Test Analysis Guide:
  
Look at the metrics above to identify breaking points:

1. RAMP PHASE (Progressive Load Increase):
   - Latency increasing linearly? → Good scalability
   - Latency increasing exponentially? → Bottleneck identified
   - Error rate increasing? → System struggling with load
   - At what VU count did errors start appearing?

2. PLATEAU PHASE (Sustained at ${STRESS_TARGET} VUs):
   - Did latency stabilize? → System adapted to load
   - Did latency continue climbing? → Degradation phase
   - Error rate stable/increasing? → System stability
   - Throughput maintained/declining? → Capacity limits

3. COOL DOWN PHASE:
   - Did latency return to baseline? → Good recovery
   - Latency remained high? → Possible resource leaks
   - Errors continued? → Cascading failures

FINDINGS to document:
  - Breaking point: VU count where errors exceed 5% or p95 > 3s
  - Throughput peak: Maximum requests/sec achieved
  - Resource saturation: Where did system start rejecting requests
  - Recovery capability: Did system recover after cooldown

Next Steps:
  - Compare with baseline (if available)
  - Identify which endpoints are bottlenecks
  - Profile database and API server
  - Optimize before next stress test iteration
  `);
}
