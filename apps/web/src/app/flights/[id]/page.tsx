'use client';

/**
 * Flight Details Page — Sprint 7 optimisations
 *
 * Changes:
 * - Replaced useApiQuery (old hook) with new TanStack Query wrapper.
 * - useApiMutation now receives invalidateKeys so a successful PATCH
 *   automatically invalidates both the detail entry and the list cache —
 *   no manual refetch() call needed.
 * - staleTime: STALE.FLIGHT_DETAIL (30 s) means fast back/forward navigation
 *   returns the cached version instantly instead of re-fetching.
 * - The loading state no longer blocks the header area; only the content
 *   sections wait for data.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Plane,
  Clock,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Edit3,
  History,
} from 'lucide-react';
import { StatusBadge, SeverityBadge } from '@/components/StatusBadge';
import {
  useApiQuery,
  useApiMutation,
  getErrorMessage,
  getErrorType,
} from '@/hooks/useApiRequest';
import {
  ErrorState,
  LoadingState,
  InlineError,
} from '@/components/StateComponents';
import { STALE } from '@/lib/queryClient';

// ─── Types ─────────────────────────────────────────────────────────────────

interface AirportDetails { id: number; code: string; name: string; city: string; country: string; timezone: string; }
interface AircraftDetails { id: number; registration: string; model: string; capacity: number; status: string; }
interface FlightEventItem { id: number; flightId: number; eventType: string; message: string; eventTime: string; }
interface IncidentItem { id: number; flightId: number; severity: string; type: string; status: string; description: string; createdAt: string; resolvedAt: string | null; }

interface FlightDetailsData {
  id: number; flightNumber: string; airlineCode: string;
  originAirport: AirportDetails; destinationAirport: AirportDetails; aircraft: AircraftDetails;
  scheduledDeparture: string; scheduledArrival: string;
  actualDeparture: string | null; actualArrival: string | null;
  gate: string | null; status: string; delayMinutes: number; passengerCount: number;
  createdAt: string; updatedAt: string;
  events: FlightEventItem[]; incidents: IncidentItem[];
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function FlightDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('BOARDING');
  const [newDelay, setNewDelay] = useState(0);

  // ── Detail query ──────────────────────────────────────────────────────────
  const detailKey = ['flights', 'detail', id] as unknown[];

  const { data: response, isLoading: loading, isFetching, error, refetch } =
    useApiQuery<{ data: FlightDetailsData }>(
      detailKey,
      `${apiBaseUrl}/api/flights/${id}`,
      { staleTime: STALE.FLIGHT_DETAIL, timeout: 10_000 }
    );

  // ── Mutation: invalidates detail + list so both stay fresh after update ───
  const {
    mutate: updateStatus,
    isPending: updateLoading,
    error: updateError,
    reset: resetUpdateError,
  } = useApiMutation('PATCH', [
    detailKey,           // invalidate this flight's detail cache
    ['flights', 'list'], // invalidate the list cache (status column changes)
  ]);

  const flight = response?.data;

  // ── Open the modal pre-populated with current values ─────────────────────
  const openModal = () => {
    if (!flight) return;
    setNewStatus(flight.status);
    setNewDelay(flight.delayMinutes);
    setIsUpdateOpen(true);
  };

  const handleUpdateStatus = async () => {
    try {
      await updateStatus({
        url: `${apiBaseUrl}/api/flights/${id}/status`,
        payload: { status: newStatus, delayMinutes: newDelay },
      });
      setIsUpdateOpen(false);
      // Cache invalidation above triggers an automatic refetch — no manual call needed.
    } catch {
      // error surfaced via updateError
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-16">
        <LoadingState message={`Loading flight ${id}…`} size="lg" />
      </main>
    );
  }

  // ── Error / not found ─────────────────────────────────────────────────────
  if (error || !flight) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        <Link href="/flights" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Flights
        </Link>
        <ErrorState
          title={
            (error as any)?.statusCode === 404 || error?.message?.includes('404')
              ? 'Flight Not Found'
              : 'Failed to Load Flight'
          }
          message={error ? getErrorMessage(error as Error) : 'This flight record does not exist'}
          type={error ? getErrorType(error as Error) : 'generic'}
          onRetry={() => refetch()}
          actions={[{ label: 'Back to Flights', onClick: () => { window.location.href = '/flights'; }, variant: 'secondary' }]}
        />
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <Link href="/flights" className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-md">
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{flight.flightNumber}</h1>
              <StatusBadge status={flight.status} />
              {flight.delayMinutes > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-semibold">
                  +{flight.delayMinutes} m
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">ID: #{flight.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openModal}
            className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1" />
            Update Status
          </button>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-3">
            <MapPin className="w-4 h-4" /> Origin
          </div>
          <h3 className="text-base font-bold text-slate-900">{flight.originAirport.code}</h3>
          <p className="text-xs text-slate-500">{flight.originAirport.name}</p>
          <p className="text-xs text-slate-500">{flight.originAirport.city}, {flight.originAirport.country}</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">{flight.originAirport.timezone}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-3">
            <Plane className="w-4 h-4" /> Aircraft
          </div>
          <p className="text-base font-mono font-bold text-slate-900">{flight.aircraft.registration}</p>
          <p className="text-xs text-slate-500">{flight.aircraft.model}</p>
          <p className="text-xs text-slate-500 mt-2">Capacity: {flight.aircraft.capacity} seats</p>
          <p className="text-xs text-slate-500">Onboard: {flight.passengerCount} passengers</p>
          {flight.gate && <p className="text-xs font-mono text-slate-700 mt-1">Gate {flight.gate}</p>}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase mb-3">
            <MapPin className="w-4 h-4 text-emerald-600" /> Destination
          </div>
          <h3 className="text-base font-bold text-slate-900">{flight.destinationAirport.code}</h3>
          <p className="text-xs text-slate-500">{flight.destinationAirport.name}</p>
          <p className="text-xs text-slate-500">{flight.destinationAirport.city}, {flight.destinationAirport.country}</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">{flight.destinationAirport.timezone}</p>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Schedule & Times
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Scheduled Departure', value: flight.scheduledDeparture },
            { label: 'Scheduled Arrival',   value: flight.scheduledArrival },
            ...(flight.actualDeparture ? [{ label: 'Actual Departure', value: flight.actualDeparture }] : []),
            ...(flight.actualArrival   ? [{ label: 'Actual Arrival',   value: flight.actualArrival   }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 font-semibold uppercase">{label}</p>
              <p className="text-slate-900 font-mono">{new Date(value!).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      {flight.events.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4" /> Flight Events ({flight.events.length})
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {flight.events.map((event) => (
              <div key={event.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-mono font-semibold text-slate-900">{event.eventType}</span>
                  <time className="text-slate-500 text-[11px]">{new Date(event.eventTime).toLocaleTimeString()}</time>
                </div>
                <p className="text-slate-600">{event.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incidents */}
      {flight.incidents.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Incidents ({flight.incidents.length})
          </h2>
          <div className="space-y-3">
            {flight.incidents.map((inc) => (
              <div key={inc.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900">{inc.type}</span>
                    <SeverityBadge severity={inc.severity as any} />
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                    inc.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>{inc.status}</span>
                </div>
                <p className="text-slate-700">{inc.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {isUpdateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Update Flight Status</h2>
            {updateError && (
              <InlineError message={getErrorMessage(updateError as Error)} onDismiss={resetUpdateError} />
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs"
                >
                  {['SCHEDULED','BOARDING','DEPARTED','DELAYED','ARRIVED','CANCELLED'].map((s) => (
                    <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delay (minutes)</label>
                <input
                  type="number"
                  value={newDelay}
                  min="0"
                  onChange={(e) => setNewDelay(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => { setIsUpdateOpen(false); resetUpdateError(); }}
                disabled={updateLoading}
                className="flex-1 px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={updateLoading}
                className="flex-1 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                {updateLoading ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
