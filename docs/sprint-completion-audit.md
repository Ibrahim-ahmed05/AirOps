# Sprint completion audit (current)

## Completed with evidence

- High-volume frontend: paginated flights table, search, filtering, sorting, dashboard metrics and loading/error/empty/retry states.
- API measurements: repeated endpoint timings, status checks and payload sizes are stored in `results/2026-09-14/baseline/api-measurements.json`.
- Concurrent users: k6 runs executed at **10, 50, 100, 150 and 500 VUs**, twice each, with raw ndjson and summaries under `results/2026-09-14/capacity/`.
- Failure handling: invalid requests, empty results, 404s and 503 behavior were exercised; functional checks passed **11/11**.
- Write safety: disposable 50-VU contention test passed with 200 persisted events.
- Optimisation: debounced search, session caching, response projection and memoization are implemented; index experiment is recorded in the performance report.

## Current bottleneck

The local single-process API/Database path saturates quickly under the mixed read workload. Search is the slowest normal endpoint (1,107 ms mean, 1,604 ms P95), and 50+ VUs cause timeouts and 503s. The next step is query/index tuning, connection pooling, caching/aggregates, load shedding and horizontally scaled API workers, followed by production-scale validation.

## Important qualification

The numbers above are real executions on the dated isolated environment. They are not a claim that production supports the same capacity. The browser recovery automation needs a rerun on a stable Chrome/k6-browser host before that scenario can be marked passed.
