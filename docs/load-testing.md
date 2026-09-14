# Load testing guide

The executed evidence is dated 14 September 2026 and is documented in [`performance-measurements.md`](performance-measurements.md). Re-run the canonical k6 capacity test with:

```powershell
$env:DATABASE_URL='postgres://airops@127.0.0.1:55432/airops_evidence'
node load-tests/run-evidence.mjs --phase=baseline --levels=10,50,100,150,500 --repetitions=2 --duration=60s
```

Raw summaries and request logs are under `results/2026-09-14/`. Scripts in `load-tests/` are reproducible test tools; only dated result files count as executed evidence.
