# K6 Load Testing Framework - AirOps

## Overview

This document describes the K6 load-testing suite built for AirOps. The suite simulates realistic traffic patterns and helps identify when the system becomes degraded or unstable.

**IMPORTANT:** Do NOT optimize the application based on these tests. This sprint is purely for establishing baseline performance metrics and identifying bottlenecks.

## Architecture

The load-testing framework consists of:

1. **config.js** - Centralized configuration, load levels, and performance thresholds
2. **helpers.js** - Reusable functions for realistic user behavior simulation
3. **smoke.js** - Quick sanity check scenario
4. **load.js** - Sustained load with mixed realistic workload
5. **stress.js** - Progressive ramp to breaking point
6. **spike.js** - Sudden traffic spike resilience test
7. **write-contention.js** - Concurrent write operations under contention

## Prerequisites

### Install K6

K6 is a modern load testing framework. Installation options:

**Option 1: Homebrew (macOS/Linux)**
```bash
brew install k6
```

**Option 2: Chocolatey (Windows)**
```bash
choco install k6
```

**Option 3: Direct Download**
Visit https://k6.io/docs/getting-started/installation/

**Verify Installation:**
```bash
k6 version
```

### Ensure API and Database are Running

The test suite requires:
- PostgreSQL database on port 5432
- Fastify API on port 4000 (default)
- Network connectivity between test runner and API

```bash
# From workspace root
docker-compose up -d

# Verify API is running
curl http://localhost:4000/api/health
```

### Seed Database with Flight Data

Tests require sufficient flight records to avoid contention on limited dataset.

```bash
# Seed 10,000 flights (default, recommended for initial testing)
npm run seed -- 10000

# For stress/spike tests with high VU counts, consider larger datasets
npm run seed -- 100000
```

## Configuration

### Environment Variables

All test scenarios support environment variable overrides:

```bash
# Set API base URL (default: http://localhost:4000)
API_BASE_URL=http://api.example.com k6 run load-tests/smoke.js

# Set load level (smoke, light, moderate, heavy, intense, extreme, crushing, breaking)
LOAD_LEVEL=heavy k6 run load-tests/load.js

# Override VU count
K6_VUS=100 k6 run load-tests/smoke.js

# Override duration
K6_DURATION=10m k6 run load-tests/load.js

# Set stress test target
STRESS_TARGET=500 k6 run load-tests/stress.js

# Set spike target
SPIKE_TARGET=250 k6 run load-tests/spike.js

# Combine multiple overrides
K6_VUS=150 K6_DURATION=10m API_BASE_URL=http://localhost:4000 k6 run load-tests/load.js
```

### Load Levels (Preset Configurations)

Available load levels in `config.js`:

| Level | VUs | Duration | Use Case |
|-------|-----|----------|----------|
| **smoke** | 1 | 30s | Quick sanity check |
| **light** | 10 | 2m | Minimal load test |
| **moderate** | 50 | 5m | Default load test |
| **heavy** | 100 | 5m | Significant load |
| **intense** | 150 | 5m | High concurrency |
| **extreme** | 250 | 5m | Very high load |
| **crushing** | 500 | 3m | Extreme load |
| **breaking** | 1000 | 2m | Breaking point (HIGH RISK) |

## Test Scenarios

### 1. Smoke Test (smoke.js)

**Purpose:** Quick sanity check to verify API is responsive and basic endpoints work.

**When to use:** 
- Before other tests (verify API is healthy)
- After deploying code changes
- Daily baseline check

**What it tests:**
- Health check endpoint
- Airport listing
- Flight browsing
- Flight search
- Flight details
- Dashboard metrics
- One complete mixed workload cycle

**Execution:**
```bash
# Default: 1 VU for 30s
k6 run load-tests/smoke.js

# With different load level
LOAD_LEVEL=light k6 run load-tests/smoke.js
```

**Expected output:**
- All checks should pass (100% success rate)
- Latency typically <500ms for all endpoints
- 0% error rate
- ~30-50 total requests

**Interpretation:**
- ✓ All checks pass → API is healthy, safe to run other tests
- ✗ Some checks fail → API is unhealthy, diagnose before proceeding

---

### 2. Load Test (load.js)

**Purpose:** Realistic sustained load with mixed workload distribution to test normal operating conditions.

**When to use:**
- Establish baseline performance metrics
- Validate SLA targets
- Test realistic user behavior patterns
- Regular performance monitoring

**What it tests:**
- Mixed workload: 60% browsing, 20% searching, 10% dashboard, 10% status updates
- Pagination and filtering
- Database query performance under load
- Multi-user concurrent access

**Workload Distribution:**
- **60% Browsing** - Users listing and paginating through flights
- **20% Searching** - Users filtering by status, airport, dates
- **10% Dashboard** - Operators viewing real-time metrics
- **10% Status Updates** - Operators updating flight statuses

**Execution:**
```bash
# Default: 50 VUs for 5 minutes with ramp-up and cool-down
k6 run load-tests/load.js

# Custom load level
LOAD_LEVEL=heavy k6 run load-tests/load.js

# Custom VUs and duration
K6_VUS=75 K6_DURATION=10m k6 run load-tests/load.js
```

**Expected stages:**
1. Ramp-up (2 min) - Gradually increase to target VUs
2. Sustained (3 min) - Hold at target load
3. Cool-down (1 min) - Gradually return to 0

**Key metrics to watch:**
- P95 latency (target: <1.5s for Stable)
- Error rate (target: <2%)
- Request throughput (should maintain ~100+ req/s)

**Interpretation:**
See Performance Classification section below.

---

### 3. Stress Test (stress.js)

**Purpose:** Progressive load increase to identify system breaking point and scalability limits.

**When to use:**
- Determine maximum safe VU count
- Identify capacity limits
- Find where system degrades
- Understand resource bottlenecks

**What it tests:**
- System behavior under increasing load
- At what point errors start appearing
- Scalability characteristics (linear vs exponential)
- Resource saturation points

**Load Profile:**
- Ramps from 0 to target VUs (default: 250) in steps
- Each step increases VUs by 25 every minute
- Holds at peak for 2 minutes
- Cool down over 1 minute

**Execution:**
```bash
# Default: Ramp 0 → 250 VUs
k6 run load-tests/stress.js

# Higher stress target
STRESS_TARGET=500 k6 run load-tests/stress.js

# Maximum stress (HIGH RISK - may crash system)
STRESS_TARGET=1000 k6 run load-tests/stress.js
```

**Key metrics to watch:**
- At what VU count did errors exceed 5%?
- Peak p95 latency and at which load level?
- Did system recover during cool-down?
- Throughput peak (max requests/sec)?

**Interpretation:**
- **Good scalability:** Latency increases linearly, errors stay <5% until peak
- **Moderate degradation:** Latency increases exponentially, errors appear at 100-150 VUs
- **Poor scalability:** Errors >5% before 100 VUs, exponential latency growth

---

### 4. Spike Test (spike.js)

**Purpose:** Sudden traffic spike to test resilience and recovery capabilities.

**When to use:**
- Test handling of unexpected traffic surges
- Verify graceful degradation
- Evaluate recovery mechanisms
- Simulate viral moments or breaking news

**What it tests:**
- System response to sudden load increase
- Error handling under spike conditions
- Recovery time to baseline
- For cascading failures or circuit breaking

**Load Profile:**
1. Normal baseline (10 VUs for 1 min) - Establish baseline
2. Spike onset (10s ramp to target) - Sudden jump
3. Spike plateau (30s hold) - Peak load
4. Recovery (1 min gradual return) - Graceful decline
5. Post-spike monitoring (1 min) - Verify recovery
6. Cool down (30s) - Return to 0

**Execution:**
```bash
# Default: Spike to 100 VUs
k6 run load-tests/spike.js

# Spike to 250 VUs
SPIKE_TARGET=250 k6 run load-tests/spike.js

# Extreme spike (HIGH RISK)
SPIKE_TARGET=500 k6 run load-tests/spike.js
```

**Key metrics to watch:**
- Latency increase during spike onset
- Error rate during spike
- Time to recover to baseline latency
- Any lingering effects after recovery

**Interpretation:**
- **Resilient:** Errors <5%, recovery <30s, metrics return to baseline
- **Acceptable:** Errors 5-10%, recovery <1m, temporary degradation
- **At-risk:** Errors >10%, slow recovery, cascading failures

---

### 5. Write Contention Test (write-contention.js)

**Purpose:** Test concurrent write operations to identify locking and contention issues.

**When to use:**
- Test database lock handling
- Identify serialization issues
- Validate write performance
- Stress test flight status updates

**What it tests:**
- Concurrent PATCH /api/flights/:id/status operations (80%)
- Mixed with flight detail reads (20%)
- Database lock contention
- Connection pool behavior under write load
- Cascading effects of writes on reads

**Execution:**
```bash
# Default: 50 VUs writing for 5 minutes
k6 run load-tests/write-contention.js

# Higher contention
K6_VUS=150 k6 run load-tests/write-contention.js

# Extreme contention (HIGH RISK)
K6_VUS=500 k6 run load-tests/write-contention.js
```

**Key metrics to watch:**
- Write operation latency (PATCH requests)
- Error types (409 Conflicts, 503 Unavailable, timeouts)
- Impact on read operations
- Database connection pool utilization

**Interpretation:**
- **Good:** Write p95 <1s, errors <1%, reads unaffected
- **Acceptable:** Write p95 1-3s, errors 1-5%, minimal read impact
- **Poor:** Write p95 >3s, errors >5%, reads significantly impacted

## Performance Classification

Use these thresholds to classify system performance:

### Stable ✓
- **P95 latency:** < 1 second
- **Error rate:** < 1%
- **User experience:** Fully operational, no noticeable delays
- **Throughput:** Maintains target rate
- **Action:** System performing well at this load level

### Degraded ⚠
- **P95 latency:** 1-3 seconds
- **Error rate:** 1-5%
- **User experience:** Noticeable slowdown, system usable
- **Throughput:** Slight decrease but maintained
- **Action:** Acceptable for non-critical operations; monitor closely

### Unstable ✗
- **P95 latency:** > 3 seconds
- **Error rate:** > 5%
- **User experience:** Broken workflows, major timeouts
- **Throughput:** Significant drops, capacity exceeded
- **Action:** System overloaded; reduce load or optimize

## Metrics Collection

K6 automatically collects the following metrics:

### Request-Level Metrics
- **http_req_duration** - Total request time (ms)
  - Reported: avg, min, med, max, p(50), p(95), p(99), count
- **http_req_failed** - Failed requests (bool)
  - Reported: rate (% of total)
- **http_reqs** - Request count
  - Reported: rate (requests/sec)
- **http_req_receiving** - Time receiving response (ms)
- **http_req_sending** - Time sending request (ms)
- **http_req_waiting** - Time waiting for response (ms, aka "Time to First Byte")

### Custom Metrics (by test scenario)
- Response status code distribution
- Endpoint-specific latency tracking
- Error type categorization

### Output
K6 generates:
1. Console summary with key metrics
2. Threshold pass/fail results
3. Breakdown by endpoint/group
4. JSON export (if configured)

## Running Tests Safely

### Before Running Tests

1. **Verify prerequisites:**
   ```bash
   k6 version                              # K6 installed
   docker-compose ps                       # Services running
   curl http://localhost:4000/api/health  # API healthy
   ```

2. **Seed sufficient data:**
   ```bash
   npm run seed -- 10000  # At minimum for normal tests
   npm run seed -- 100000 # For stress/spike with high VUs
   ```

3. **Monitor system resources:**
   - Open terminal/task manager to watch CPU, memory, connections
   - Have database monitoring available
   - Be ready to stop test if needed

### Safe Testing Progression

**Day 1: Establish Baseline**
```bash
k6 run load-tests/smoke.js      # 1 VU - verify API works
k6 run load-tests/load.js       # 50 VUs - baseline performance
```

**Day 2: Find Degradation Point**
```bash
LOAD_LEVEL=heavy k6 run load-tests/load.js      # 100 VUs
LOAD_LEVEL=intense k6 run load-tests/load.js    # 150 VUs
```

**Day 3: Test Resilience**
```bash
k6 run load-tests/spike.js                  # Spike to 100 VUs
SPIKE_TARGET=250 k6 run load-tests/spike.js # Spike to 250 VUs
```

**Day 4: Stress Testing (with caution)**
```bash
STRESS_TARGET=250 k6 run load-tests/stress.js  # Safe stress
STRESS_TARGET=500 k6 run load-tests/stress.js  # High risk
```

**Day 5: Write Operations**
```bash
k6 run load-tests/write-contention.js       # 50 VUs writing
K6_VUS=100 k6 run load-tests/write-contention.js  # 100 VUs
```

### Stopping a Test

Press `Ctrl+C` to gracefully stop a running test. K6 will:
1. Stop creating new iterations
2. Allow in-flight requests to complete
3. Display final metrics

If system is in distress:
- Stop the test immediately
- Check API logs: `docker logs <container-name>`
- Monitor database: Resource usage, connections, locks
- Allow system to recover before next test

## Interpreting Results

### Example Output Structure

```
          /\      |‾‾| /‾‾/   /‾‾/   /‾‾|  /‾‾/ 
         /  \     |  |/  /   /  /   /  / | /  /  
        /    \    |     (  /  /   /  /  / / (   
       /      \   |  |\  \(  /  /  /  /  /   \  
      /        \  |__| \__\/  /___/___/___/    \

     execution: local
        script: load-tests/load.js
        output: -

     scenarios: (100.00%) 1 scenario, 50 max VUs, 6m30s max duration (incl. 30s graceful ramp-down)
              ✓ Mixed_Workload_Realistic_Distribution

     ✓ browse flights returns 200: 1234/1234
     ✓ flight list is not empty: 1234/1234

     checks.........................: 99.92% ✓ 12342  ✗ 10
     data_received..................: 89 MB  227 kB/s
     data_sent.......................: 5.6 MB  14 kB/s
     http_req_blocked...............: avg=2.34ms   min=1.23ms   med=2.12ms   max=45.3ms   p(95)=3.45ms  p(99)=12.3ms
     http_req_connecting............: avg=1.23ms   min=0.45ms   med=1.02ms   max=23.1ms   p(95)=1.98ms  p(99)=8.45ms
     http_req_duration..............: avg=342ms    min=45ms     med=215ms    max=8234ms   p(95)=892ms   p(99)=2134ms ✓
     http_req_failed................: 0.81%   ✗
     http_req_receiving.............: avg=12.3ms   min=1.2ms    med=8.1ms    max=234ms    p(95)=34ms    p(99)=89ms
     http_req_sending...............: avg=3.2ms    min=0.5ms    med=2.1ms    max=45ms     p(95)=8.2ms   p(99)=21ms
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s       max=0s       p(95)=0s      p(99)=0s
     http_req_waiting...............: avg=326ms    min=42ms     med=198ms    max=8100ms   p(95)=856ms   p(99)=2045ms
     http_reqs......................: 12352   31.6/s
     iteration_duration.............: avg=6.43s    min=4.12s    med=5.98s    max=45.2s    p(95)=9.23s   p(99)=18.4s
     iterations.....................: 2468    6.3/s
     vus............................: 50      min=50   max=50
     vus_max........................: 50      min=50   max=50

     threshold: ✓ 12 thresholds met (1 thresholds missed)
       ✓ http_req_duration: p(95)<1500 ✓ (892ms < 1500ms)
       ✗ http_req_failed: rate<0.02 ✗ (0.0081 > 0.02)
```

### Key Metrics to Review

1. **http_req_duration** - Response times
   - Look at p(95) and p(99) values
   - Compare against threshold targets

2. **http_req_failed** - Error rate
   - Percentage of failed requests
   - Should stay <1-2% for normal operations

3. **http_reqs** - Throughput
   - Requests per second
   - Should be consistent across test duration

4. **iterations** - Completed workload cycles
   - Number of full user sessions simulated
   - Higher is better

5. **vus** - Concurrent users
   - Should match expected load
   - Min/max should be close (stable load)

### Checking Thresholds

- ✓ **Threshold met** - Test passed this criteria
- ✗ **Threshold missed** - Test failed this criteria

Failing thresholds don't stop the test but indicate performance issues.

## Troubleshooting

### API Connection Issues

**Problem:** "Connection refused" errors
```
Error: dial tcp 127.0.0.1:4000: connect: connection refused
```

**Solutions:**
```bash
# Verify API is running
docker-compose ps

# Start services if needed
docker-compose up -d

# Verify API endpoint is accessible
curl http://localhost:4000/api/health

# Check firewall or network config
docker logs <api-container-id>
```

### Database Issues

**Problem:** High error rates with "database disconnected" messages

**Solutions:**
```bash
# Check database is running
docker-compose ps | grep postgres

# Verify database connection
psql postgresql://postgres:password@localhost:5432/airops

# Check connection pool
docker logs <postgres-container-id>

# Reduce VU count to reduce connection demand
K6_VUS=10 k6 run load-tests/smoke.js
```

### High Latency

**Problem:** P95 latency exceeds expectations

**Analysis:**
1. Is this expected at this VU count?
2. Check API logs for slow queries
3. Review database query plans
4. Monitor CPU, memory, disk I/O
5. Check network latency between test runner and API

### Out of Memory

**Problem:** Test runner or API runs out of memory

**Solutions:**
- Reduce VU count
- Reduce test duration
- Review memory usage of API process
- Consider running tests on separate machine

### Test Won't Start

**Problem:** "No flights found" or similar data issues

**Solutions:**
```bash
# Reseed database with more data
npm run seed -- 50000

# Verify data was seeded
npm run query -- "SELECT COUNT(*) FROM flights;"
```

## Advanced Usage

### Custom Environment File

Create `.env.k6` for test-specific configuration:
```bash
API_BASE_URL=http://localhost:4000
LOAD_LEVEL=moderate
```

Run with:
```bash
set -a && source .env.k6 && set +a && k6 run load-tests/load.js
```

### JSON Output for Analysis

Export results to JSON for further analysis:
```bash
k6 run --out json=results.json load-tests/load.js

# Analyze with jq or other tools
jq '.metrics' results.json
```

### Cloud Execution (K6 Cloud)

For distributed load testing across regions:
```bash
# Login to k6 cloud
k6 login cloud

# Run on cloud infrastructure
k6 cloud load-tests/load.js
```

## Next Steps After Testing

After completing the load tests:

1. **Document Baseline Metrics:**
   - Record p50, p95, p99 latencies at each load level
   - Note error rates and failure points
   - Save results in `docs/load-testing-results/`

2. **Identify Bottlenecks:**
   - Which endpoints degrade first?
   - Is it CPU, memory, or I/O limited?
   - Database query analysis needed?

3. **Plan Optimizations (Next Sprint):**
   - Database indexing strategy
   - Query optimization opportunities
   - Caching opportunities
   - Connection pool tuning

4. **Set Up Continuous Monitoring:**
   - Regular baseline tests
   - Automated regression detection
   - Performance metrics tracking

## References

- K6 Documentation: https://k6.io/docs/
- HTTP Request API: https://k6.io/docs/javascript-api/k6-http/
- Performance Best Practices: https://k6.io/docs/testing-guides/
- Metrics and Thresholds: https://k6.io/docs/javascript-api/k6-metrics/
