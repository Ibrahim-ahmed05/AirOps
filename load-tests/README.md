# AirOps Load Testing Suite (k6)

## Reproduce the current evidence

Install k6 from https://grafana.com/docs/k6/latest/set-up/install-k6/ and set `K6_BINARY` to its executable if it is not at the runner's local `.tools` path. Start the production API against a test database with at least 500,000 flights.

```powershell
$env:DATABASE_URL = 'YOUR_TEST_DATABASE_URL'
$env:API_BASE_URL = 'http://127.0.0.1:4000'
node load-tests/capture-db.mjs
node load-tests/api-measurements.mjs
node load-tests/run-evidence.mjs --phase=baseline --duration=60s --repetitions=2
```

The default levels are 10, 50, 100, 150 and 500 VUs. `--levels=50,100` selects a subset. Run measurements sequentially without unrelated load. Use a new phase name for a new experiment so earlier evidence is retained.

`capacity.js` is the canonical read-only test. It uses a 750 ms think time and 10 s request timeout. The runner saves raw samples (`.ndjson`), summaries, logs, manifests with source hashes, PostgreSQL activity and recovery checks. Exit 99 means a performance threshold failed: it is a measured failure, not a reason to discard the result. Missing summaries or zero requests invalidate the run.

Browser measurements: create a result directory, set `RESULT_DIR` and `K6_BROWSER_EXECUTABLE_PATH` if Chrome is not auto-detected, then run `k6 run load-tests/browser.js`. Its console contains `BROWSER_EVIDENCE` observations; the summary contains metrics and completion checks. Run this separately from API-only baselines.

Read [the current report](../docs/performance-measurements.md) for exact results and limitations. The legacy scenarios below are available scripts, not proof of execution.

This directory is reserved for performance load testing scripts using **[k6](https://k6.io/)**.

## Load Testing Target Thresholds

As defined in the project roadmap, AirOps will be progressively load-tested against the following concurrent user load tiers:

- **Tier 1:** 50 concurrent users
- **Tier 2:** 100 concurrent users
- **Tier 3:** 150 concurrent users
- **Tier 4:** 250 concurrent users
- **Tier 5:** 500 concurrent users
- **Tier 6:** 1,000 concurrent users

Dataset scale tests will run across:
- 10,000 flights
- 100,000 flights
- 500,000 flights
- 1,000,000 flights

## Principles

1. **No Synthetic / Fabricated Benchmarks:** All reported metrics (latency, p95, p99, throughput req/s, error rate) must come from real k6 test execution logs.
2. **Build → Measure → Break → Identify Bottleneck → Optimize → Measure Again:** No premature optimizations (no Redis, no caching, no microservices) until bottlenecks are empirically identified under load.
