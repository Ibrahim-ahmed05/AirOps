# k6 framework status

The original September 3 file described scripts, not executed results. Its saved smoke run made zero requests. Current execution evidence is linked from [performance-measurements.md](performance-measurements.md).

Repairs include a supported response type, k6-compatible query-string encoding, removal of self-references during options initialization, and removal of arbitrary minimum request-rate thresholds from fixed-user tests. Missing details/failed writes no longer count as successful helper results. Legacy mixed workloads default to reads; writes require an explicit disposable-database opt-in.

`capacity.js` is the canonical measured read workload. `run-evidence.mjs` saves summary JSON, raw k6 samples, console output, database activity samples, source hashes and recovery checks. The older stress/spike/write files are scenario scaffolding unless a dated output explicitly records their execution.
