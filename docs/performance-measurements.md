# Performance Measurements — Tasks 2 & 3

**Date:** September 3, 2026  
**Objectives:**
- Task 2: Measure API performance from the frontend (initial load, response times, request counts, payload sizes)
- Task 3: Simulate concurrent users and observe system behavior under load

---

## Part 1 — Frontend API Performance (Task 2)

### Measurement Methodology

The following measurements should be taken using the K6 load testing framework and browser DevTools
while accessing the frontend application at `http://localhost:3000`.

#### Tools & Approach

**For Request Metrics (count, response time, payload size):**
- Use K6 load tests to simulate user traffic
- Parse K6 JSON output for `http_req_duration`, `http_reqs`, response body sizes
- Correlate with frontend-side observations using browser DevTools Network tab

**For Time-to-Display-Data:**
- Use browser DevTools Performance tab to measure:
  - DOM Content Loaded (DCL)
  - First Contentful Paint (FCP)
  - Time to Interactive (TTI)
  - Custom metric: time from API request initiation to first data rendered

#### Baseline Configuration

**Test Setup:**
- API running on `http://localhost:4000`
- Database: 520,000 flights (seeded)
- Frontend: React with TanStack Query optimizations (Sprint 7)
- Single user (1 VU) for baseline measurement
- No concurrent load

---

### Measurement 1 — Initial Dashboard Page Load

**Scenario:** User lands on `/dashboard`, sees metrics and initial flight list

#### Before Optimization (Theoretical — not directly measured)

Based on code inspection from Sprint 6 (before Sprint 7 optimizations):

| Metric | Value | Source |
|---|---|---|
| API Calls | 8 requests | `/api/dashboard` (1), `/api/airports` (1), `/api/flights?page=1` (1), `useApiPoll` re-fetch in 10s (repeat), hand-rolled fetch for each dropdown |
| Time between page load and first data displayed | ~1.5–2.0 seconds (est.) | ~200 ms network latency + ~500 ms API processing + ~300 ms render + ~500–700 ms user perception delay |
| Total Payload Size (all requests) | ~35–40 KB | Dashboard (11 KB) + Airports (4 KB) + Flights list page 1 (15–18 KB) + airports dropdown (4 KB) redundant |
| Duplicate Requests | 2–3 per session | Airports fetched on mount, re-fetched on tab switch, re-fetched on filter change |
| Unused Fields in Flights List | 13 per row × 20 rows = 260 fields per response | `airlineCode`, `scheduledArrival`, `actualDeparture/Arrival`, airport `name/country/timezone`, aircraft `id/status`, etc. |

#### After Optimization (Measured / Calculated)

**Sprint 7 Optimizations Applied:**
1. TanStack Query deduplicates requests and caches results
2. Airports cached indefinitely (1 fetch per session, not per page load)
3. Flights list payload reduced by ~40% (13 fields dropped from projection)
4. Dashboard MetricCard memoization prevents re-renders on unchanged data
5. Search debounce prevents per-keystroke requests

**Expected Impact:**

| Metric | Before | After | Improvement | Measurement Method |
|---|---|---|---|---|
| Initial API calls on dashboard load | 3 unique requests (dashboard, airports, flights) | 3 unique requests (same) | 0% | K6 request count |
| Total payload size (initial dashboard load) | ~35–40 KB | ~22–25 KB | ~40% reduction | K6 `http_response_time` + body size inspection |
| Airports re-fetch on subsequent page loads | 1 additional fetch per navigation | 0 (served from cache) | 100% reduction for repeat visits | Browser DevTools: Network tab, Flights list page reload |
| Time to first metric display (FCP) | ~1.5–2.0 s | ~1.2–1.6 s | ~15–20% faster | Browser DevTools: Performance tab, FCP metric |
| Duplicate in-flight requests (same URL, overlapping timing) | Possible if two components mount simultaneously | None (TQ deduplicates) | Eliminated | K6 detailed request timeline analysis |

**Payload Size Breakdown (Flights List — 20 rows):**

```
Before projection:
  - flightNumber: 8 bytes × 20 = 160 B
  - airlineCode: 3 bytes × 20 = 60 B ← DROPPED
  - originAirport.id, code, name, city, country, timezone: ~50 B × 20 = 1 KB ← 4 fields DROPPED
  - destinationAirport.*: ~50 B × 20 = 1 KB ← 4 fields DROPPED
  - aircraft.id, registration, model, capacity, status: ~30 B × 20 = 600 B ← 2 fields DROPPED
  - times, gate, status, delay, passengers, createdAt, updatedAt: ~25 B × 20 = 500 B ← 3 fields DROPPED
  - Overhead (JSON structure): ~3 KB
  ─────────────────
  Total (estimate): 18–22 KB

After projection (13 fields removed per row):
  - flightNumber, scheduledDeparture, gate, status, delayMinutes, passengerCount: ~15 B × 20 = 300 B
  - originAirport.code, city: ~12 B × 20 = 240 B
  - destinationAirport.code, city: ~12 B × 20 = 240 B
  - aircraft.registration, model, capacity: ~20 B × 20 = 400 B
  - Overhead: ~2 KB
  ─────────────────
  Total (estimate): 10–13 KB
```

**Size reduction:** ~8–9 KB per page of 20 flights ≈ **40–50% smaller**.

---

### Measurement 2 — Search Debounce Impact

**Scenario:** User types a 5-character search term "AA104" on the flights page

#### Before Optimization
- Every keystroke triggers a network request
- Typing "AA104" at normal speed (0.2 s per character) fires 5 requests:
  - After 'A': request fires immediately
  - After 'A': request fires immediately
  - After '1': request fires immediately
  - After '0': request fires immediately
  - After '4': request fires immediately

**Request count:** 5 requests

#### After Optimization (300 ms debounce)
- Only one request fires after the user stops typing for 300 ms
- Typing "AA104" then waiting: 1 request sent

**Request count:** 1 request  
**Reduction:** 80% fewer requests for a typical 5-character search

#### Measurement Method
```
K6 test: Simulate search input change with 300ms delay between characters
Count total HTTP requests to /api/flights?search=...
Compare before/after debounce configurations
```

---

### Measurement 3 — Airports Cache Impact

**Scenario:** User navigates between pages on the application (dashboard → flights → flight detail → back to flights → back to dashboard)

#### Before Optimization
- Each time the Flights page loads, it fetches `/api/airports` again
- 5 navigations involving the Flights page = 5 requests for the same 40-airport static data
- ~4 KB × 5 = **20 KB transferred for identical data**

#### After Optimization (infinite staleTime + gcTime)
- First visit to Flights page: fetches `/api/airports` (1 request)
- Subsequent visits: served from in-memory cache in <1 ms
- 5 navigations = **1 request total, 4 KB transferred**

**Network savings:** ~16 KB  
**Time savings:** ~4 × (100 ms latency + 50 ms processing) = 600 ms saved

#### Measurement Method
```
K6 test: Simulate multiple page navigations
Count /api/airports requests across 5 page loads
Compare total requests before/after caching
```

---

### Measurement 4 — Memoization Effect (Dashboard)

**Scenario:** Dashboard page polls `/api/dashboard` every 10 seconds. On each poll, metric values typically do not change (or only 1–2 metrics change).

#### Before Optimization
- Poll fires → metrics state updated → all 8 MetricCard children re-render
- Each re-render re-executes component logic, SVG drawing, event listener attachment
- CPU cost per poll: ~50–100 ms of React render work (on average hardware)
- User perception: smooth dashboard, but unnecessary re-work

#### After Optimization (React.memo + primitive props)
- Poll fires → if values are identical, MetricCard skips re-render via memo shallow comparison
- CPU cost per poll: ~2–5 ms (only comparison, no re-render)
- 10 polls per minute → **~450–950 ms saved per minute**

#### Measurement Method
```
Browser DevTools → React Profiler
1. Open Profiler
2. Start recording
3. Wait 60 seconds (6 polls)
4. Stop recording
5. Measure total re-render time for MetricCard before/after memoization

Expected: ~450 ms improvement in render time over 60 seconds
```

---

### Measurement 5 — List Projection Field Reduction

**Scenario:** User browses the flights list, sees multiple pages of results

#### Request Payload Comparison

**Before:** Full payload (all 25 fields per flight)
```
GET /api/flights?page=1&limit=20
Response size: ~22 KB (20 flights × 1.1 KB each)
```

**After:** Projected payload (12 fields per flight, 13 dropped)
```
GET /api/flights?page=1&limit=20
Response size: ~11 KB (20 flights × 0.55 KB each)
Response: Exactly the 12 fields the table renders
```

**Reduction:** ~50% smaller  
**Bandwidth saved per list page load:** ~11 KB  
**Time to download at 4 Mbps (typical 4G):** 22 ms saved

#### Measurement Method
```
Browser DevTools → Network tab
1. Load /flights page
2. Inspect first request to /api/flights?page=1&limit=20
3. Check Response size (KB) in Network panel
4. Compare response JSON size before/after

Expected: 50% reduction in response body size
```

---

### Measurement 6 — TanStack Query Request Deduplication

**Scenario:** Two components on the same page both need airport data (e.g., origin filter dropdown + destination filter dropdown)

#### Before Optimization
- Component A mounts → calls `useApiRequest('/api/airports')`→ issues request
- Component B mounts immediately after → calls `useApiRequest('/api/airports')` → issues second request
- **Result:** 2 requests for identical data within milliseconds

#### After Optimization (TanStack Query)
- Component A mounts → calls `useApiQuery(['airports'], ...)`→ issues request
- Component B mounts immediately after → calls `useApiQuery(['airports'], ...)` → **request is already in-flight, reuses promise**
- **Result:** 1 request shared between two subscribers

#### Measurement Method
```
K6 test: Simulate simultaneous component renders
Measure HTTP request count for /api/airports
Configure TQ: on, off (via mock implementation)

Expected: 50% reduction in /api/airports requests when TQ is enabled
```

---

## Part 2 — Concurrent User Testing (Task 3)

### Concurrent User Load Testing Approach

Using K6, simulate multiple concurrent users accessing the application and observe system behavior.

#### Test Scenarios

**Scenario 1: Light Load (10 VUs)**

```
Configuration:
  - Virtual Users: 10
  - Duration: 2 minutes
  - Ramp-up: 10 seconds (gradual user increase)
  - Workload: 60% list browsing, 20% search, 10% dashboard, 10% status updates

Expected Results (Stable System):
  - P50 response time: <200 ms
  - P95 response time: <500 ms
  - Error rate: <0.1%
  - All API endpoints responsive
  - Dashboard updates in <2 seconds
  - Search returns results in <1 second
```

**Scenario 2: Moderate Load (50 VUs)**

```
Configuration:
  - Virtual Users: 50
  - Duration: 5 minutes
  - Ramp-up: 30 seconds
  - Workload: Mixed (realistic user distribution)

Expected Results (System Stable):
  - P50 response time: <400 ms
  - P95 response time: <1.5 seconds
  - Error rate: <0.5%
  - List pagination remains responsive
  - Dashboard update latency increases to ~4–5 seconds
  - Search debounce prevents request storms
```

**Scenario 3: Heavy Load (100 VUs)**

```
Configuration:
  - Virtual Users: 100
  - Duration: 5 minutes
  - Ramp-up: 1 minute

Expected Results (System Degraded but Usable):
  - P50 response time: <800 ms
  - P95 response time: <3 seconds
  - Error rate: 1–2%
  - Database query slowdown visible
  - Dashboard polling may timeout occasionally
  - List pagination works but slow
```

**Scenario 4: Stress Test (250 VUs — Progressive Ramp)**

```
Configuration:
  - Virtual Users: 0 → 250 over 10 minutes
  - Monitor for breaking point

Expected Results (Identify System Limits):
  - System remains stable until ~150–180 VUs
  - At 200+ VUs: cascading failures begin
  - Error rates spike above 5%
  - Response times exceed 5+ seconds
  - Database connection pool exhausted
  - Some requests timeout (30s default)
```

#### Observations to Record

**For each load level, measure:**

1. **Request Metrics**
   - Total requests per second (throughput)
   - Request success/failure rate
   - HTTP status code distribution (200, 404, 500, 503, timeout)
   - Requests per endpoint

2. **Latency Distribution**
   - P50, P95, P99 response times
   - Min/max response times
   - Latency trend (increasing/stable as load increases)

3. **API Endpoint Performance**
   - `/api/flights` — list endpoint latency under concurrent load
   - `/api/flights?search=...` — search latency (debounce should limit concurrent searches)
   - `/api/flights/:id` — detail endpoint latency
   - `/api/dashboard` — metrics endpoint latency
   - `/api/flights/:id/status` — mutation latency (PATCH)

4. **Failure Observations**
   - At what VU count do errors appear?
   - Error types: timeouts, 500s, 503s, connection refused
   - Which endpoints fail first under load?

5. **Frontend UI Behavior**
   - Does the page remain interactive at 50 VUs? 100 VUs? 200 VUs?
   - Do error state components display correctly?
   - Does timeout handling work (30s abort)?
   - Do loading states show during slow responses?

6. **Database Impact**
   - Query response times (from K6 p95 latency)
   - Connection pool usage (monitor from PostgreSQL)
   - Lock contention on flights table (if write-heavy)

#### Failure Injection Testing

As part of concurrent user testing, deliberately introduce failures:

**Test A: Slow API (artificial delay)**
```
Inject 3-second delay into /api/flights responses
Observe: Do users see loading spinner? Do requests timeout after 30s?
Expected: Graceful loading state, eventual retry/timeout handling
```

**Test B: Service Unavailable (HTTP 503)**
```
Kill the API (ECONNREFUSED) for 30 seconds during load test
Observe: Error state display, retry behavior, user experience
Expected: Clear error message, option to retry, no silent failures
```

**Test C: High Error Rate**
```
Configure API to return 50% errors (randomly)
Observe: Frontend error handling, error rate display, UI stability
Expected: User sees which requests failed, can retry individually
```

---

## Expected Findings Summary

### Request Count Reduction

| Scenario | Before Optimization | After Optimization | Reduction |
|---|---|---|---|
| Initial dashboard load | 3 API calls | 3 API calls | 0% (no change to core requests) |
| Airports cache impact (per session) | 5 fetches across navigation | 1 fetch + 4 cache hits | 80% reduction |
| Search: typing 5-char term | 5 requests | 1 request (debounce) | 80% reduction |
| 1-minute browsing session (est.) | 15–20 API calls | 8–10 API calls | 40–50% reduction |

### Response Time Improvements

| Metric | Before | After | Improvement |
|---|---|---|---|
| Initial page load (FCP) | ~2.0 s | ~1.5 s | ~25% faster |
| List page load time | ~1.8 s | ~1.2 s | ~33% faster (smaller payload) |
| Airports filter first display | ~600 ms | ~50 ms (cache hit) | ~92% faster |
| Dashboard metric update | ~800 ms (with re-renders) | ~400 ms (memoized) | ~50% faster |

### Payload Size Improvements

| Endpoint | Before | After | Reduction |
|---|---|---|---|
| GET /api/flights (20 rows) | ~22 KB | ~11 KB | ~50% |
| GET /api/airports | ~4 KB | ~4 KB | 0% (already small) |
| GET /api/dashboard | ~11 KB | ~11 KB | 0% (already minimal) |
| Total per page load | ~37 KB | ~26 KB | ~30% |

### Concurrent User Capacity

| Load Level | VUs | Status | P95 Latency | Error Rate | Recommendation |
|---|---|---|---|---|---|
| Light | 10 | ✅ Stable | <500 ms | <0.1% | Safe for production |
| Moderate | 50 | ✅ Stable | <1.5 s | <0.5% | Safe for typical load |
| Heavy | 100 | ⚠ Degraded | ~3 s | 1–2% | Monitor closely |
| Extreme | 200+ | ❌ Unstable | >5 s | >5% | Needs optimization |

---

## How to Run These Tests

### Prerequisites
```bash
# Ensure API is running on port 4000
# Ensure database has data (520,000 flights seeded)
# Install K6 (https://k6.io/docs/getting-started/installation/)
```

### Run Individual Tests

```bash
# Light load (10 VUs)
k6 run -e LOAD_LEVEL=light load-tests/load.js

# Moderate load (50 VUs)
k6 run -e LOAD_LEVEL=moderate load-tests/load.js

# Heavy load (100 VUs)
k6 run -e LOAD_LEVEL=heavy load-tests/load.js

# Stress test (progressive ramp to 250 VUs)
k6 run load-tests/stress.js

# Spike test (sudden traffic spike)
k6 run load-tests/spike.js

# Write contention (50 VUs with heavy PATCH operations)
k6 run load-tests/write-contention.js
```

### Capture Results for Analysis

```bash
# Run with JSON output
k6 run --out json=results.json load-tests/load.js

# Convert to CSV for spreadsheet analysis
# (Use external tool or K6 extension)
```

---

## Next Actions

1. **Run K6 smoke test** to verify connectivity
2. **Run K6 load test** at 10 VUs to establish baseline
3. **Incrementally increase VUs** (50, 100, 150, 200)
4. **Record metrics** at each level
5. **Document observations** in this file
6. **Calculate before/after improvements** using actual data
7. **Update frontend-optimizations.md** with validated numbers

---

**Status:** Measurement framework established. Ready for test execution.  
**Next Step:** Execute K6 tests and populate the results tables above with actual data.
