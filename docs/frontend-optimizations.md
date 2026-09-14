# Frontend optimizations: implementation and measured evidence

Current implementation:

- Server pagination defaults to 20 rows and caps responses at 100 rows.
- Search input waits 300 ms after typing; stale requests are cancelled.
- TanStack Query caches and deduplicates requests using stable keys.
- Airport reference data is reused for the browser session.
- The flight-list API returns only fields used by the table.
- Rows and metric cards are memoized; mutation success invalidates relevant caches.
- Routes are split by Next.js. The table is paginated, not virtualized.

September 14 browser evidence is in `results/2026-09-14/browser/console.txt`, its k6 summary and screenshots. A controlled five-character request-per-keystroke experiment is compared with the actual page's debounced input. This is a measured control comparison, not an old application build. Airport caching is checked by navigating away and back in the same context.

See [performance-measurements.md](performance-measurements.md) for actual timings and counts. Previous 50% CPU, 50% payload and 40–50% total-session improvement claims are withdrawn: an implementation rationale does not establish those percentages. Memoization savings require a dedicated profiler comparison. Exact old-build before/after measurements remain unavailable.
