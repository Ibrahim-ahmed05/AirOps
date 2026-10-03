# Performance measurements (14 September 2026)

This is the current evidence report. All capacity figures below come from executed, dated test runs whose raw outputs are stored under `results/2026-09-14/`.

## Test setup

- AirOps API build running locally on port 4000, Next.js production build on port 3000.
- PostgreSQL 16.15 disposable test instance on `127.0.0.1:55432`.
- Dataset: **520,000 flights**, **1,603,491 events**, **15,500 incidents**, 40 airports and 250 aircraft.
- k6 **2.2.0**; each capacity level was run twice for 60 seconds with constant VUs. Results include real requests, latency, HTTP 503s and timeouts.

## API and browser measurements

| Endpoint / journey | Mean | P95 | Payload | Result |
|---|---:|---:|---:|---|
| `/health` | 2.5 ms | 3.2 ms | 150 B | 20/20 passed |
| `/api/airports` | 2.2 ms | 3.0 ms | 4.8 KB | 20/20 passed |
| `/api/dashboard` | 135.1 ms | 158.7 ms | 294 B | 20/20 passed |
| `/api/flights?limit=20` | 329.2 ms | 362.9 ms | 6.8 KB | 20/20 passed |
| `/api/flights?search=AA&limit=20` | 1,107.2 ms | 1,603.7 ms | 6.8 KB | 20/20 passed |
| Dashboard data visible | — | — | — | 816 ms |
| Flights data visible | — | — | — | 1,024 ms |

The browser journey made 2 API calls on the dashboard and 3 on the flights page. Typing five search characters produced **1** debounced search request (the un-debounced control produced 5). Airport data stayed at **1** request after navigating away and back, confirming the session cache.

## Concurrent-user results

The full table is in [`results/2026-09-14/capacity-table.md`](../results/2026-09-14/capacity-table.md). The measured conclusion is clear: the current single API process is already unstable at 10 VUs under this mixed workload, and failure rates rise sharply at 50, 100, 150 and 500 VUs. At 500 VUs the two runs produced **98.10%** and **98.53%** failed requests, with **2,088–3,483 HTTP 503s**. These are measurements from the isolated local environment, not production capacity claims.

Adding the performance indexes in `load-tests/index-experiment.sql` produced a useful before/after signal: the 10-VU indexed run reached **754.7 ms P95 with 0% errors**, while the matching baseline runs were 4,620.6–6,126.1 ms P95. At 50 VUs, indexes helped but the service remained unstable (6,918.4 ms P95, 0.49% errors in the indexed run).

## Failure and write checks

- Functional API checks: **11/11 passed**, including pagination limits, invalid query rejection, filtering, sorting, empty results, 404 handling and dashboard totals.
- Write contention: **50 VUs / 200 writes** to a disposable fixture; 200 events persisted with 200 unique messages and the final status was consistent. This verifies transaction/event persistence, not optimistic-lock conflict detection.
- The browser failure/recovery runner was attempted but Chrome exited unexpectedly in this workstation environment; no recovery success is claimed from that run. The implemented loading, error, retry and empty states remain covered by code review and normal browser evidence.

## Reproduce

```powershell
$env:DATABASE_URL='postgres://airops@127.0.0.1:55432/airops_evidence'
node load-tests/api-measurements.mjs
node load-tests/functional.mjs
node load-tests/write-evidence.mjs
node load-tests/run-evidence.mjs --phase=baseline --levels=10,50,100,150,500 --repetitions=2 --duration=60s
```
