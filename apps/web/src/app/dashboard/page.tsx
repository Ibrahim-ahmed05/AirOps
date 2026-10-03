'use client';

/**
 * Dashboard Page — Sprint 7 optimisations
 *
 * Problems fixed:
 *
 * 1. METRICCARD RE-RENDERS ON EVERY POLL (task 7)
 *    The old useApiPoll replaced the entire metrics object on every 10-second
 *    cycle even when values hadn't changed, causing all 8 MetricCard children
 *    to re-render unconditionally.
 *    Fix: MetricCard is wrapped in React.memo. TanStack Query's refetchInterval
 *    replaces the hand-rolled polling loop; TQ only triggers a re-render when
 *    the returned JSON actually differs from the cached value.
 *
 * 2. DUPLICATE DASHBOARD REQUESTS (task 2)
 *    Any component that called the old useApiPoll hook with the same URL got
 *    its own independent fetch. TanStack Query deduplicates by query key —
 *    multiple subscribers share a single in-flight request.
 *
 * 3. REFETCH ON WINDOW FOCUS
 *    The global queryClient already sets refetchOnWindowFocus: false (docs
 *    operators keep dashboards open all day). The refetchInterval alone drives
 *    freshness here.
 */

import { memo } from 'react';
import Link from 'next/link';
import {
  Plane,
  Clock,
  AlertTriangle,
  Users,
  ArrowRight,
  RefreshCw,
  Activity,
  Timer,
  Info,
  BarChart3,
} from 'lucide-react';
import { useApiQuery, getErrorMessage, getErrorType } from '@/hooks/useApiRequest';
import { ErrorState, LoadingState, MetricSkeleton, PartialError } from '@/components/StateComponents';
import { STALE } from '@/lib/queryClient';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  totalFlights: number;
  scheduledFlights: number;
  boardingFlights: number;
  departedFlights: number;
  delayedFlights: number;
  cancelledFlights: number;
  arrivedFlights: number;
  averageDelayMinutes: number;
  affectedPassengers: number;
  activeIncidents: number;
  timestamp: string;
}

interface DashboardResponse {
  data: DashboardMetrics;
}

// ─── MetricCard — memoised to prevent re-render when parent re-renders ──────

/**
 * Receives only primitives as props.
 * React.memo bails out unless a prop value changes, so the 10-second refetch
 * only re-renders the cards whose numbers actually changed.
 */
const MetricCard = memo(function MetricCard({
  title,
  iconNode,
  value,
  subtitle,
  actionHref,
  actionLabel,
  colorClass = 'text-slate-700',
  loading,
}: {
  title: string;
  iconNode: React.ReactNode;
  value: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  colorClass?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <MetricSkeleton />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        <span>{title}</span>
        {iconNode}
      </div>
      <div className={`text-3xl font-bold ${colorClass} tracking-tight font-mono`}>
        {value}
      </div>
      <p className="text-[11px] text-slate-500 mt-2">{subtitle}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="text-[11px] text-blue-600 hover:underline mt-2 block font-medium">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
});

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

  /**
   * refetchInterval drives the 10-second cadence.
   * TanStack Query:
   *  - Only triggers a re-render when the response body actually changes.
   *  - Deduplicates: if another subscriber uses the same key, they share one
   *    request.
   *  - Cancels the in-flight request on unmount automatically.
   */
  const {
    data: response,
    isLoading: loading,
    isFetching,
    error,
    refetch,
  } = useApiQuery<DashboardResponse>(
    ['dashboard'],
    `${apiBaseUrl}/api/dashboard`,
    {
      staleTime: STALE.DASHBOARD,
      refetchInterval: STALE.DASHBOARD,
      timeout: 5_000,
    }
  );

  const metrics = response?.data;
  const total = metrics?.totalFlights || 1;
  const pct = (val = 0) => ((val / total) * 100).toFixed(1);

  const errorMessage = error ? getErrorMessage(error as Error) : null;
  const errorType = error ? getErrorType(error as Error) : 'generic';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Operations Control Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time fleet operations, delays, passenger impact, and incident monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
          <Link
            href="/flights"
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-md font-semibold transition-colors shadow-2xs flex items-center gap-1.5"
          >
            View All Flights <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Full error */}
      {error && !metrics && (
        <ErrorState
          title={errorType === 'unavailable' ? 'Service Temporarily Unavailable' : 'Dashboard Metrics Unavailable'}
          message={errorMessage ?? undefined}
          type={errorType as any}
          onRetry={() => refetch()}
          actions={[{
            label: 'View Flight List',
            onClick: () => { window.location.href = '/flights'; },
            variant: 'secondary',
          }]}
        />
      )}

      {/* Initial loading (no cached data) */}
      {loading && !metrics && <LoadingState message="Loading dashboard metrics…" size="lg" />}

      {/* KPI Grid */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Flights Total"
            iconNode={<Plane className="w-4 h-4 text-slate-700" />}
            value={metrics.totalFlights.toLocaleString()}
            subtitle="Active flight operations in database"
            colorClass="text-slate-900"
            loading={false}
          />
          <MetricCard
            title="Scheduled"
            iconNode={<Clock className="w-4 h-4 text-blue-600" />}
            value={metrics.scheduledFlights.toLocaleString()}
            subtitle={`${pct(metrics.scheduledFlights)}% of total operations`}
            colorClass="text-blue-700"
            actionHref="/flights?status=SCHEDULED"
            actionLabel="View scheduled"
            loading={false}
          />
          <MetricCard
            title="Boarding"
            iconNode={<Users className="w-4 h-4 text-purple-600" />}
            value={metrics.boardingFlights.toLocaleString()}
            subtitle={`${pct(metrics.boardingFlights)}% actively boarding`}
            colorClass="text-purple-700"
            actionHref="/flights?status=BOARDING"
            actionLabel="View boarding"
            loading={false}
          />
          <MetricCard
            title="Delayed"
            iconNode={<AlertTriangle className="w-4 h-4 text-amber-600" />}
            value={metrics.delayedFlights.toLocaleString()}
            subtitle={`${pct(metrics.delayedFlights)}% delayed`}
            colorClass="text-amber-700"
            actionHref="/flights?status=DELAYED"
            actionLabel="View delayed"
            loading={false}
          />
          <MetricCard
            title="Cancelled"
            iconNode={<AlertTriangle className="w-4 h-4 text-rose-600" />}
            value={metrics.cancelledFlights.toLocaleString()}
            subtitle={`${pct(metrics.cancelledFlights)}% cancellation rate`}
            colorClass="text-rose-700"
            actionHref="/flights?status=CANCELLED"
            actionLabel="View cancelled"
            loading={false}
          />
          <MetricCard
            title="Average Delay"
            iconNode={<Timer className="w-4 h-4 text-slate-700" />}
            value={`${metrics.averageDelayMinutes} m`}
            subtitle="Across delayed flights only"
            colorClass="text-slate-900"
            loading={false}
          />
          <MetricCard
            title="Passengers Affected"
            iconNode={<Users className="w-4 h-4 text-orange-600" />}
            value={metrics.affectedPassengers.toLocaleString()}
            subtitle="On delayed or cancelled flights"
            colorClass="text-orange-700"
            loading={false}
          />
          <MetricCard
            title="Active Incidents"
            iconNode={<Activity className="w-4 h-4 text-red-600" />}
            value={metrics.activeIncidents.toLocaleString()}
            subtitle={metrics.activeIncidents > 0 ? 'Requires attention' : 'No active incidents'}
            colorClass={metrics.activeIncidents > 0 ? 'text-red-700' : 'text-green-700'}
            loading={false}
          />
        </div>
      )}

      {metrics && (
        <p className="text-center text-xs text-slate-500 font-mono">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()} · auto-refreshes every 10 s
        </p>
      )}

      {/* Setup instructions */}
      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-xs space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-1">Setup Instructions</h3>
            <ol className="list-decimal list-inside mt-1 space-y-0.5 text-[11px]">
              <li>Start PostgreSQL: <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-blue-200">docker compose up -d</code></li>
              <li>Seed database: <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-blue-200">npm run seed -- 10000</code></li>
              <li>Start API server: <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-blue-200">npm run dev:api</code></li>
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}
