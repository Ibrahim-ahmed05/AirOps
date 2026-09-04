/**
 * useSearch Hook
 *
 * Handles search with:
 * - Debouncing to prevent race conditions
 * - Request cancellation for stale responses
 * - Request tracking and metrics
 * - Proper error handling
 *
 * RACE CONDITION PROTECTION:
 * - Rapid typing no longer sends request per keystroke
 * - Earlier responses don't overwrite newer ones
 * - Only latest search result is displayed
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// apiFetch is not exported from useApiRequest — we use native fetch here
// because this standalone hook manages its own AbortController lifecycle.
// The hook is available for future use but not currently wired into any page.

export interface SearchMetrics {
  /** Total API requests made */
  totalRequests: number;
  /** Total requests actually sent (after debounce) */
  sentRequests: number;
  /** Number of cancelled requests */
  cancelledRequests: number;
  /** Average debounce delay (ms) */
  averageDebounceDelay: number;
}

export interface SearchState<T> {
  query: string;
  results: T[];
  loading: boolean;
  error: Error | null;
  isEmpty: boolean;
  metrics: SearchMetrics;
}

export function useSearch<T>(
  url: string,
  {
    debounceMs = 300,
    minChars = 1,
    params = (_q: string): Record<string, any> => ({}),
    signal: _externalSignal,
  }: {
    debounceMs?: number;
    minChars?: number;
    params?: (query: string) => Record<string, any>;
    signal?: AbortSignal;
  } = {}
) {
  const [state, setState] = useState<SearchState<T>>({
    query: '',
    results: [],
    loading: false,
    error: null,
    isEmpty: false,
    metrics: {
      totalRequests: 0,
      sentRequests: 0,
      cancelledRequests: 0,
      averageDebounceDelay: 0,
    },
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestTimestampRef = useRef<number>(0);
  const requestTimesRef = useRef<number[]>([]);

  /**
   * Execute the search query
   */
  const executeSearch = useCallback(
    async (query: string) => {
      if (query.length < minChars) {
        setState((prev) => ({
          ...prev,
          query,
          results: [],
          loading: false,
          error: null,
          isEmpty: true,
        }));
        return;
      }

      // Cancel previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestTimestamp = Date.now();
      requestTimestampRef.current = requestTimestamp;

      setState((prev) => ({
        ...prev,
        query,
        loading: true,
        error: null,
        isEmpty: false,
        metrics: {
          ...prev.metrics,
          sentRequests: prev.metrics.sentRequests + 1,
        },
      }));

      try {
        const searchParams = params(query);
        const queryString = new URLSearchParams(searchParams).toString();
        const fullUrl = `${url}?${queryString}`;

        const res = await fetch(fullUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const response: { data: T[] } = await res.json();

        // Only update if this is still the latest request
        if (requestTimestamp === requestTimestampRef.current) {
          const results = response.data || [];
          setState((prev) => ({
            ...prev,
            results,
            loading: false,
            error: null,
            isEmpty: results.length === 0,
          }));
        } else {
          // This response is stale
          setState((prev) => ({
            ...prev,
            metrics: {
              ...prev.metrics,
              cancelledRequests: prev.metrics.cancelledRequests + 1,
            },
          }));
        }
      } catch (error: any) {
        // Don't update state if request was aborted
        if (error?.name === 'AbortError' || error?.message?.includes('abort')) {
          setState((prev) => ({
            ...prev,
            metrics: {
              ...prev.metrics,
              cancelledRequests: prev.metrics.cancelledRequests + 1,
            },
          }));
          return;
        }

        // Only update if this is still the latest request
        if (requestTimestamp === requestTimestampRef.current) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
            isEmpty: false,
          }));
        }
      }
    },
    [url, params, minChars]
  );

  /**
   * Update search query with debouncing
   */
  const setQuery = useCallback(
    (newQuery: string) => {
      setState((prev) => ({
        ...prev,
        query: newQuery,
        metrics: {
          ...prev.metrics,
          totalRequests: prev.metrics.totalRequests + 1,
        },
      }));

      // Clear previous debounce timer
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Skip search if query is empty
      if (newQuery.length === 0) {
        setState((prev) => ({
          ...prev,
          results: [],
          loading: false,
          error: null,
          isEmpty: false,
        }));
        return;
      }

      // Debounce the search
      const debounceStart = Date.now();
      debounceTimeoutRef.current = setTimeout(() => {
        const debounceDelay = Date.now() - debounceStart;

        // Update average debounce delay
        requestTimesRef.current.push(debounceDelay);
        if (requestTimesRef.current.length > 10) {
          requestTimesRef.current.shift(); // Keep last 10
        }
        const avgDelay =
          requestTimesRef.current.reduce((a, b) => a + b, 0) /
          requestTimesRef.current.length;

        setState((prev) => ({
          ...prev,
          metrics: {
            ...prev.metrics,
            averageDebounceDelay: Math.round(avgDelay),
          },
        }));

        executeSearch(newQuery);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    abortControllerRef.current?.abort();
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    setState((prev) => ({
      ...prev,
      query: '',
      results: [],
      loading: false,
      error: null,
      isEmpty: false,
    }));
  }, []);

  /**
   * Get metrics about search performance
   */
  const getMetrics = useCallback(() => {
    return state.metrics;
  }, [state.metrics]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    query: state.query,
    setQuery,
    clearSearch,
    results: state.results,
    loading: state.loading,
    error: state.error,
    isEmpty: state.isEmpty,
    metrics: state.metrics,
    getMetrics,
  };
}

/**
 * Document search metrics for debugging
 *
 * Usage in component:
 * console.log('Search Performance:', logSearchMetrics(metrics))
 */
export function logSearchMetrics(metrics: SearchMetrics): object {
  return {
    totalRequests: metrics.totalRequests,
    sentRequests: metrics.sentRequests,
    preventedRequests: metrics.totalRequests - metrics.sentRequests,
    preventionRate: `${(
      ((metrics.totalRequests - metrics.sentRequests) / metrics.totalRequests) *
      100
    ).toFixed(1)}%`,
    cancelledRequests: metrics.cancelledRequests,
    averageDebounceDelay: `${metrics.averageDebounceDelay}ms`,
  };
}
