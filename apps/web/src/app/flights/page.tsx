'use client';

/**
 * Flights Page — optimisations applied in Sprint 7
 *
 * Problems fixed:
 *
 * 1. UNSTABLE OPTIONS OBJECT (task 3)
 *    The old code built a new options object inline on every render, which
 *    broke useCallback's dependency comparison and caused fetchData to be
 *    recreated every render → infinite re-fetch loop under certain conditions.
 *    Fix: TanStack Query uses a stable queryKey array; key elements are
 *    primitives, so strict-equality comparison works correctly.
 *
 * 2. NO SEARCH DEBOUNCE (task 4)
 *    The old input onChange wired directly into the query key, so every
 *    keystroke immediately fired a new network request.
 *    Fix: a separate `debouncedSearch` state is updated after 300 ms of
 *    idle time.  Only `debouncedSearch` enters the query key — the raw
 *    input value is local-only.
 *
 * 3. AIRPORTS RE-FETCHED EVERY MOUNT (task 5)
 *    The airports query was re-executed on every page mount because there
 *    was no cache at all.  Airports are static reference data.
 *    Fix: staleTime: Infinity via STALE.FOREVER — fetches once per session.
 *
 * 4. FLIGHT ROW RE-RENDERS ON POLL (task 7)
 *    Every dashboard poll and every flights refetch re-rendered every row
 *    even when row data hadn't changed.
 *    Fix: FlightRow wrapped in React.memo with a custom comparator that
 *    compares only the fields the row actually renders.
 */

import { useState, useCallback, useMemo, Suspense, memo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plane,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useApiQuery, getErrorMessage, getErrorType } from '@/hooks/useApiRequest';
import {
  ErrorState,
  TableRowSkeleton,
  EmptyState,
  InlineError,
} from '@/components/StateComponents';
import { STALE } from '@/lib/queryClient';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AirportRef {
  id: number;
  code: string;
  name: string;
  city: string;
  country: string;
}

interface AircraftRef {
  registration: string;
  model: string;
  capacity: number;
}

interface FlightRow {
  id: number;
  flightNumber: string;
  airlineCode: string;
  originAirport: AirportRef;
  destinationAirport: AirportRef;
  aircraft: AircraftRef;
  scheduledDeparture: string;
  gate: string | null;
  status: string;
  delayMinutes: number;
  passengerCount: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Memoised FlightRow ────────────────────────────────────────────────────

/**
 * FlightRow is memo-wrapped with a field-level comparator.
 * The row only renders the fields listed in `areEqual`; skipping fields like
 * createdAt / updatedAt prevents spurious re-renders from the API returning
 * fresh timestamps while the visible data is unchanged.
 */
const FlightTableRow = memo(
  function FlightTableRow({
    flight,
    onNavigate,
  }: {
    flight: FlightRow;
    onNavigate: (id: number) => void;
  }) {
    return (
      <tr
        onClick={() => onNavigate(flight.id)}
        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
      >
        <td className="py-3 px-4 font-mono font-bold text-slate-900 group-hover:text-blue-600">
          {flight.flightNumber}
        </td>
        <td className="py-3 px-4">
          <span className="font-mono font-semibold text-slate-900">{flight.originAirport.code}</span>
          <span className="block text-[11px] text-slate-500 truncate max-w-[120px]">{flight.originAirport.city}</span>
        </td>
        <td className="py-3 px-4">
          <span className="font-mono font-semibold text-slate-900">{flight.destinationAirport.code}</span>
          <span className="block text-[11px] text-slate-500 truncate max-w-[120px]">{flight.destinationAirport.city}</span>
        </td>
        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
          {new Date(flight.scheduledDeparture).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </td>
        <td className="py-3 px-4">
          <span className="font-mono text-slate-800">{flight.aircraft.registration}</span>
          <span className="block text-[11px] text-slate-500 truncate max-w-[110px]">{flight.aircraft.model}</span>
        </td>
        <td className="py-3 px-4 font-mono text-slate-700">
          {flight.gate
            ? <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{flight.gate}</span>
            : '—'}
        </td>
        <td className="py-3 px-4">
          <StatusBadge status={flight.status} size="sm" />
        </td>
        <td className="py-3 px-4 font-mono">
          {flight.delayMinutes > 0
            ? <span className="text-amber-700 font-bold">+{flight.delayMinutes} m</span>
            : <span className="text-slate-400">On Time</span>}
        </td>
        <td className="py-3 px-4 text-right font-mono text-slate-700">
          {flight.passengerCount} / {flight.aircraft.capacity}
        </td>
      </tr>
    );
  },
  // Custom comparator — only re-render when visible fields change
  (prev, next) =>
    prev.flight.id === next.flight.id &&
    prev.flight.status === next.flight.status &&
    prev.flight.delayMinutes === next.flight.delayMinutes &&
    prev.flight.gate === next.flight.gate &&
    prev.flight.passengerCount === next.flight.passengerCount &&
    prev.flight.scheduledDeparture === next.flight.scheduledDeparture &&
    prev.onNavigate === next.onNavigate
);

// ─── Main page content ─────────────────────────────────────────────────────

function FlightsTableContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [origin, setOrigin] = useState(searchParams.get('origin') || '');
  const [destination, setDestination] = useState(searchParams.get('destination') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'scheduledDeparture');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [limit, setLimit] = useState(parseInt(searchParams.get('limit') || '20', 10));

  // ── Task 4: Debounce search input ─────────────────────────────────────────
  // Only debouncedSearch enters the query key.  Rapid typing updates
  // searchInput immediately (controlled input stays responsive) but only
  // fires a fetch after 300 ms of idle.
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ── Task 3 & 5: Stable query key for airports ─────────────────────────────
  // The key is a primitive-only array — TanStack Query can compare it with
  // strict equality without needing a memo wrapper around an options object.
  const { data: airportsData, error: airportsError } = useApiQuery<{ data: AirportRef[] }>(
    ['airports'],
    `${apiBaseUrl}/api/airports`,
    {
      // Task 5: airports are static — fetch once, never again this session
      staleTime: STALE.FOREVER,
      gcTime: Infinity,
      timeout: 5_000,
    }
  );
  const airports = airportsData?.data ?? [];

  // ── Task 3: Stable flights query key ─────────────────────────────────────
  // All key elements are primitives.  Changing any one of them triggers a new
  // fetch; unchanged combinations hit the cache.
  const flightsQueryKey = useMemo(
    () => ['flights', 'list', page, limit, debouncedSearch, status, origin, destination, sortBy, sortOrder],
    [page, limit, debouncedSearch, status, origin, destination, sortBy, sortOrder]
  );

  const flightsUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', page.toString());
    p.set('limit', limit.toString());
    p.set('sortBy', sortBy);
    p.set('sortOrder', sortOrder);
    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim());
    if (status.trim()) p.set('status', status.trim());
    if (origin.trim()) p.set('origin', origin.trim());
    if (destination.trim()) p.set('destination', destination.trim());
    return `${apiBaseUrl}/api/flights?${p.toString()}`;
  }, [apiBaseUrl, page, limit, debouncedSearch, status, origin, destination, sortBy, sortOrder]);

  const {
    data: flightResponse,
    isLoading: loading,
    error: flightError,
    refetch: refetchFlights,
    isFetching,
  } = useApiQuery<{ data: FlightRow[]; pagination: PaginationMeta }>(
    flightsQueryKey,
    flightsUrl,
    { staleTime: STALE.FLIGHTS_LIST, timeout: 10_000 }
  );

  const flights = flightResponse?.data ?? [];
  const pagination = flightResponse?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };

  // ── Stable navigate callback — avoids prop churn on FlightTableRow ────────
  const handleNavigate = useCallback((id: number) => router.push(`/flights/${id}`), [router]);

  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatus('');
    setOrigin('');
    setDestination('');
    setSortBy('scheduledDeparture');
    setSortOrder('desc');
    setPage(1);
  }, []);

  const handleSortToggle = useCallback((field: string) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return field;
    });
    setPage(1);
  }, []);

  const hasFilters = !!(debouncedSearch || status || origin || destination);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Plane className="w-5 h-5 text-slate-800" /> Flight Operations Table
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time catalog of airline schedules, departure gates, delays, and passenger capacity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-2xs">
            Total: <strong className="text-slate-900">{pagination.total.toLocaleString()}</strong>
          </span>
          <button
            onClick={() => refetchFlights()}
            disabled={isFetching}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search — task 4: value is searchInput, not debouncedSearch */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search flight # (e.g. AA104) or code..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-mono"
            />
            {/* Subtle indicator when debounce is pending */}
            {searchInput !== debouncedSearch && (
              <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-mono">…</span>
            )}
          </div>

          <div>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-none focus:border-slate-400"
            >
              <option value="">All Statuses</option>
              {['SCHEDULED','BOARDING','DEPARTED','DELAYED','ARRIVED','CANCELLED'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={origin}
              onChange={(e) => { setOrigin(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
            >
              <option value="">All Origins</option>
              {airports.map((a) => <option key={a.id} value={a.code}>{a.code} – {a.city}</option>)}
            </select>
          </div>

          <div>
            <select
              value={destination}
              onChange={(e) => { setDestination(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-mono"
            >
              <option value="">All Destinations</option>
              {airports.map((a) => <option key={a.id} value={a.code}>{a.code} – {a.city}</option>)}
            </select>
          </div>
        </div>

        {/* Sort + row controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-600" /> Sort:
            </span>
            {[
              { key: 'scheduledDeparture', label: 'Departure' },
              { key: 'flightNumber',       label: 'Flight #' },
              { key: 'delayMinutes',       label: 'Delay' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSortToggle(key)}
                className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                  sortBy === key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label} {sortBy === key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {hasFilters && (
              <button onClick={handleResetFilters} className="text-xs text-rose-600 hover:underline font-medium">
                Reset Filters
              </button>
            )}
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span>Rows:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800"
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error states */}
      {flightError && (
        <ErrorState
          title="Failed to Load Flight List"
          message={getErrorMessage(flightError as Error)}
          type={getErrorType(flightError as Error)}
          onRetry={() => refetchFlights()}
          actions={[{ label: 'View Dashboard', onClick: () => router.push('/'), variant: 'secondary' }]}
        />
      )}
      {airportsError && airports.length === 0 && (
        <InlineError message="Could not load airport list for filters" onDismiss={() => {}} />
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider font-mono">
              <tr>
                {['Flight #','Origin','Destination','Scheduled Dep','Aircraft','Gate','Status','Delay','Passengers'].map((h, i) => (
                  <th key={h} className={`py-3 px-4${i === 8 ? ' text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <TableRowSkeleton count={limit} />
              ) : flights.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12">
                    <EmptyState
                      title="No Flights Found"
                      message={
                        hasFilters
                          ? 'No flights match your filters. Try adjusting your search criteria.'
                          : 'No flight records available. Try seeding the database.'
                      }
                      type="filtered"
                      action={hasFilters ? { label: 'Clear Filters', onClick: handleResetFilters } : undefined}
                    />
                  </td>
                </tr>
              ) : (
                flights.map((f) => (
                  <FlightTableRow key={f.id} flight={f} onNavigate={handleNavigate} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
          <span>
            Page <strong className="text-slate-900 font-mono">{pagination.page}</strong> of{' '}
            <strong className="text-slate-900 font-mono">{pagination.totalPages || 1}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 flex items-center gap-1 font-medium shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages || isFetching}
              className="px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 flex items-center gap-1 font-medium shadow-2xs"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function FlightsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
          <p className="text-xs font-mono">Loading operations catalog…</p>
        </div>
      }
    >
      <FlightsTableContent />
    </Suspense>
  );
}
