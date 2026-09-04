# AirOps Load Testing Suite (k6)

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
