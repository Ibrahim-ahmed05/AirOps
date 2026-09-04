/**
 * useApiRequest — TanStack Query wrappers
 *
 * This file is the sole data-fetching abstraction for the app.
 * All pages import from here; nothing imports from apiClient directly.
 *
 * What TanStack Query gives us over the old hand-rolled hooks:
 *  - Deduplication: simultaneous calls for the same key share one in-flight request.
 *  - Background refetch: stale data is refreshed without blocking the UI.
 *  - Cache: query results survive navigation; no re-fetch on back/forward.
 *  - Retries: configurable, with exponential back-off out of the box.
 *  - Stable identities: no object-recreation-triggered infinite re-fetch loops.
 *
 * The old hand-rolled polling (useApiPoll), stale-request tracker, and
 * manual AbortController management are removed — TanStack Query handles
 * all of that internally.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { fetchWithFailureInjection } from '@/lib/failureInjection';

// ─── Error classes (unchanged — used by error state components) ────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class TimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RequestCancelledError extends Error {
  constructor() {
    super('Request was cancelled');
    this.name = 'RequestCancelledError';
  }
}

// ─── Core fetch helper ─────────────────────────────────────────────────────

/**
 * Thin fetch wrapper used by every query/mutation.
 * TanStack Query passes its own AbortSignal via `options.signal`.
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const { timeout = 30_000, signal: userSignal, ...rest } = options;

  // Combine the caller's signal with a timeout signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

  // Merge signals: abort if either fires
  const mergedController = new AbortController();
  const onAbort = () => mergedController.abort();
  timeoutController.signal.addEventListener('abort', onAbort, { once: true });
  if (userSignal) {
    userSignal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const response = await fetchWithFailureInjection(url, {
      ...rest,
      signal: mergedController.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        body?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return (await response.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;

    if (
      err?.name === 'AbortError' ||
      mergedController.signal.aborted
    ) {
      // Distinguish timeout from user-initiated cancellation
      if (timeoutController.signal.aborted) {
        throw new TimeoutError(timeout);
      }
      throw new RequestCancelledError();
    }

    throw new NetworkError(err?.message ?? 'Unknown network error');
  } finally {
    clearTimeout(timeoutId);
    timeoutController.signal.removeEventListener('abort', onAbort);
  }
}

// ─── useApiQuery ───────────────────────────────────────────────────────────

export interface UseApiQueryOptions<T>
  extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  timeout?: number;
}

/**
 * Typed GET query backed by TanStack Query.
 *
 * @param queryKey  Array key — changing any element triggers a new fetch.
 *                  Use semantically: ['flights', { page, limit, search, ... }]
 * @param url       Full URL to fetch.
 * @param options   TanStack Query options + optional timeout.
 */
export function useApiQuery<T>(
  queryKey: readonly unknown[],
  url: string,
  options: UseApiQueryOptions<T> = {}
) {
  const { timeout, ...queryOptions } = options;

  return useQuery<T>({
    queryKey,
    queryFn: ({ signal }) => apiFetch<T>(url, { signal, timeout }),
    ...queryOptions,
  });
}

// ─── useApiMutation ────────────────────────────────────────────────────────

export function useApiMutation<TData = unknown, TResult = unknown>(
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST',
  /** Optional query keys to invalidate on success */
  invalidateKeys?: readonly unknown[][]
) {
  const qc = useQueryClient();

  return useMutation<TResult, Error, { url: string; payload?: TData }>({
    mutationFn: ({ url, payload }) =>
      apiFetch<TResult>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload !== undefined ? JSON.stringify(payload) : undefined,
      }),

    onSuccess: () => {
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      }
    },
  });
}

// ─── Error helpers (used by StateComponents) ──────────────────────────────

export function getErrorMessage(error: Error | null): string {
  if (!error) return '';
  if (error instanceof TimeoutError)
    return `Request timed out (${error.timeoutMs}ms). Please try again.`;
  if (error instanceof NetworkError)
    return 'Network error. Please check your connection.';
  if (error instanceof RequestCancelledError)
    return 'Request was cancelled.';
  if (error instanceof ApiError) {
    if (error.statusCode === 503)
      return 'Service is temporarily unavailable. Please try again in a moment.';
    if (error.statusCode === 500)
      return 'Server error. Please try again later.';
    if (error.statusCode === 404)
      return 'Not found. The requested resource does not exist.';
    if (error.statusCode >= 400 && error.statusCode < 500)
      return `Request error: ${error.message}`;
    return error.message;
  }
  return error.message || 'An unexpected error occurred';
}

export function getErrorType(
  error: Error | null
): 'server' | 'timeout' | 'network' | 'unavailable' | 'generic' {
  if (!error) return 'generic';
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof NetworkError) return 'network';
  if (error instanceof ApiError) {
    if (error.statusCode === 503) return 'unavailable';
    if (error.statusCode >= 500) return 'server';
  }
  return 'generic';
}
