/**
 * Spike Test Scenario
 * Sudden traffic spike to test system resilience and recovery
 * 
 * Simulates unexpected traffic spikes (e.g., breaking news, viral moment)
 * Tests if system can handle sudden load and recover gracefully.
 * 
 * Usage:
 *   k6 run load-tests/spike.js                     # Default: spike to 100 VUs
 *   SPIKE_TARGET=500 k6 run load-tests/spike.js   # Spike to 500 VUs
 *   SPIKE_TARGET=1000 k6 run load-tests/spike.js  # Spike to 1000 VUs (HIGH RISK)
 */

import { check, group } from 'k6';
import { logTestStart, logTestComplete } from './config.js';
import {
  executeRealisticMixedWorkload,
  sleepThinkTime,
} from './helpers.js';

// Configuration
const NORMAL_LOAD = 10; // Normal concurrent users
const SPIKE_TARGET = __ENV.SPIKE_TARGET ? parseInt(__ENV.SPIKE_TARGET) : 100;
const SPIKE_DURATION = '30s'; // How long the spike lasts
const RECOVERY_TIME = '2m'; // Time to recover before returning to normal

console.log(`
Spike Test Configuration:
  - Normal Load: ${NORMAL_LOAD} VUs
  - Spike Target: ${SPIKE_TARGET} VUs
  - Spike Duration: ${SPIKE_DURATION}
  - Recovery Window: ${RECOVERY_TIME}
`);

export const options = {
  stages: [
    // Normal baseline
    { duration: '1m', target: NORMAL_LOAD },
    // SPIKE! Sudden jump to peak
    { duration: '10s', target: SPIKE_TARGET },
    // Hold spike for a bit
    { duration: SPIKE_DURATION, target: SPIKE_TARGET },
    // Recovery: gradual reduction
    { duration: '1m', target: NORMAL_LOAD },
    // Monitor recovery state
    { duration: '1m', target: NORMAL_LOAD },
    // Return to zero
    { duration: '30s', target: 0 },
  ],

  thresholds: {
    // Response time - expect degradation during spike
    http_req_duration: [
      'p(50)<2000', // Allow higher latency during spike
      'p(95)<5000',
      'p(99)<10000',
    ],

    // Error rate - monitor for cascading failures
    http_req_failed: ['rate<0.1'], // Allow up to 10% errors during spike

    // Track throughput changes
    'http_reqs': ['rate>10'],
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

/**
 * Setup phase
 */
export function setup() {
  console.log('\n');
  logTestStart('SPIKE TEST', {
    vus: `${NORMAL_LOAD} → ${SPIKE_TARGET} → ${NORMAL_LOAD}`,
    duration: `~${SPIKE_DURATION}`,
  });

  console.log(`
Spike Test Execution Plan:
  
  Phase 1 [0-1m]:
    - Establish baseline: ${NORMAL_LOAD} VUs
    - Measure normal behavior
    
  Phase 2 [1m-1m10s]:
    - SPIKE ONSET: Jump to ${SPIKE_TARGET} VUs in 10 seconds
    - Monitor system response to sudden load increase
    - Expected: Request queuing, latency increase, possible timeouts
    
  Phase 3 [1m10s-${parseInt(SPIKE_DURATION.match(/\\d+/)[0]) + 70}s]:
    - SPIKE PLATEAU: Hold at ${SPIKE_TARGET} VUs
    - Measure peak latency, error rates, throughput
    - Check for cascading failures or circuit breaking
    
  Phase 4 [+1m]:
    - RECOVERY: Gradual reduction back to ${NORMAL_LOAD} VUs
    - Monitor latency and error rate decline
    - Check if system recovers gracefully
    
  Phase 5 [+1m]:
    - POST-SPIKE MONITORING: Observe ${NORMAL_LOAD} VUs
    - Verify system returned to normal baseline
    - Check for lingering effects or memory leaks
    
  Phase 6 [+30s]:
    - COOL DOWN: Return to 0 VUs
    - Final metrics collection

Key Metrics to Monitor:
  - At what point do errors start appearing?
  - Peak latency during spike (p95, p99)
  - Time to recover (when did p95 return to baseline?)
  - Any cascading failures or circuit breaker activations?
  - Requests dropped vs successful completions
  `);

  return {};
}

/**
 * Main test function - VU execution
 */
export default function (data) {
  group('Spike_Test_Mixed_Workload', () => {
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
  logTestComplete('SPIKE TEST');
  console.log(`
Spike Test Results Analysis:
  
1. BASELINE PHASE (0-1m, ${NORMAL_LOAD} VUs):
   - Establish these as "normal" metrics for comparison
   - Note p50, p95, p99 latencies
   - Error rate should be near 0%

2. SPIKE ONSET IMPACT (1m-1m10s):
   - Sudden latency increase → How quickly does system saturate?
   - Error rate spike → Early circuit breaking or graceful degradation?
   - Throughput response → Do requests get queued or rejected?
   
   Expected pattern:
     ✓ GOOD: Latency spikes, then stabilizes; errors <5%
     ✗ BAD: Latency keeps climbing; errors >10%; timeouts
     ✗ CRITICAL: All requests fail; cascading failures

3. SPIKE PLATEAU (1m10s-${parseInt(SPIKE_DURATION.match(/\\d+/)[0]) + 70}s, ${SPIKE_TARGET} VUs):
   - Peak p95 latency at this stage?
   - Peak error rate?
   - Did system reach steady state or continue degrading?

4. RECOVERY PHASE (+1m, gradual → ${NORMAL_LOAD} VUs):
   - How quickly did latency recover as load decreased?
   - Did errors drop immediately or linger?
   - Smooth recovery or step changes?

5. POST-SPIKE MONITORING (+1m, ${NORMAL_LOAD} VUs):
   - Did baseline metrics return to Phase 1 levels?
   - Any anomalies or memory growth?
   - System fully recovered?

CLASSIFICATION:
  
  RESILIENT:
    ✓ Error rate stayed <5% throughout
    ✓ P95 latency increased but capped <5s during spike
    ✓ Quick recovery: latency back to baseline within 30s of spike end
    ✓ No cascading failures or lingering errors
    
  ACCEPTABLE:
    ~ Error rate 5-10% during peak spike only
    ~ P95 latency 5-10s during spike
    ~ Recovered within 1 minute
    ~ System remained usable despite degradation
    
  AT-RISK:
    ✗ Error rate >10% or stayed high after spike ended
    ✗ P95 latency >10s or didn't recover
    ✗ Cascading failures observed
    ✗ Slow recovery (>2 minutes)
    ✗ System still degraded after recovery phase

Recommended Next Steps:
  - Compare spike behavior across load levels (50, 100, 250 VUs)
  - Analyze which endpoints were affected most
  - Review application logs for error patterns
  - Check database connection pool utilization
  - Evaluate circuit breaker / retry strategies
  `);
}
