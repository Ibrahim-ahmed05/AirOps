/**
 * TanStack Query - QueryClient configuration
 *
 * Cache policy rationale:
 *
 *  staleTime:       How long before a cached response is considered stale and
 *                   eligible for a background refetch on the next mount/focus.
 *                   "0" means "always stale" (fetch on every mount) — too
 *                   aggressive for most routes here.
 *
 *  gcTime:          How long an *unused* cache entry sits in memory before
 *                   garbage collection.  Defaults to 5 min in TQ v5.
 *
 * Per-resource decisions:
 *
 *  Flights list     staleTime: 15s — real-time-ish data but tolerate a short
 *                   window so rapid filter changes hit cache, not the network.
 *
 *  Flight detail    staleTime: 30s — detail page loads are typically
 *                   user-initiated; 30s avoids redundant fetches when a user
 *                   navigates back and forward quickly.
 *
 *  Dashboard        staleTime: 10s — matches the previous manual poll interval.
 *                   TQ will background-refresh when the window regains focus.
 *
 *  Airports         staleTime: Infinity — airports are static reference data.
 *                   Fetch once per session, never again unless manually
 *                   invalidated.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 15 seconds default stale time — tighter resources override this
      staleTime: 15_000,
      // Keep unused cache for 5 minutes (TQ v5 default)
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once before surfacing the error
      retry: 1,
      // Do not refetch just because the window re-gains focus in this app;
      // operators keep dashboards open all day and mid-keystroke refetches
      // are disruptive.
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Named stale-time constants used in individual query calls.
 * Centralised here so they are easy to audit and adjust.
 */
export const STALE = {
  /** Never re-fetch — reference / static data */
  FOREVER: Infinity,
  /** Dashboard metrics poll cadence */
  DASHBOARD: 10_000,
  /** Flight list — tolerate small staleness to absorb rapid filter changes */
  FLIGHTS_LIST: 15_000,
  /** Flight detail page */
  FLIGHT_DETAIL: 30_000,
} as const;
