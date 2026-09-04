/**
 * Failure Injection System
 *
 * DEVELOPMENT ONLY - Safe mechanism for simulating backend problems
 *
 * SECURITY NOTES:
 * - This module is DISABLED by default
 * - Must be explicitly ENABLED via environment variable or sessionStorage
 * - Cannot be used in production builds
 * - All failures are logged to console for debugging
 * - Safe activation method requires browser console access
 *
 * ACTIVATION:
 * 1. In browser console: sessionStorage.setItem('DEBUG_FAILURES', 'true')
 * 2. Then set configuration: window.__failureInjection?.setConfig({...})
 * 3. Or use environment: NEXT_PUBLIC_DEBUG_FAILURES=true (dev only)
 *
 * CONFIGURATION:
 * - latency: Add milliseconds delay to requests
 * - httpErrorCode: Force HTTP 500, 503, etc.
 * - timeout: Simulate request timeout
 * - randomFailureRate: Percentage of requests that fail (0-100)
 * - targetEndpoints: Filter which endpoints are affected (empty = all)
 */

export interface FailureConfig {
  /** Add artificial latency (milliseconds) */
  latency?: number;

  /** Force specific HTTP error code (400, 500, 503, etc.) */
  httpErrorCode?: number;

  /** Simulate timeout - request hangs for this duration (milliseconds) */
  timeout?: number;

  /** Percentage of requests to fail (0-100) */
  randomFailureRate?: number;

  /** Only affect these endpoints (empty = all endpoints) */
  targetEndpoints?: string[];

  /** Log failures to console */
  verbose?: boolean;
}

interface FailureState {
  enabled: boolean;
  config: FailureConfig;
  requestCount: number;
  failureCount: number;
}

// Global state
const state: FailureState = {
  enabled: false,
  config: {},
  requestCount: 0,
  failureCount: 0,
};

/**
 * Check if failure injection is enabled and safe to use
 */
function isEnabled(): boolean {
  // Never enabled in production builds
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEBUG_FAILURES !== 'true') {
    return false;
  }

  // Check sessionStorage (requires explicit activation)
  if (typeof window !== 'undefined') {
    const sessionEnabled = sessionStorage.getItem('DEBUG_FAILURES') === 'true';
    const envEnabled = process.env.NEXT_PUBLIC_DEBUG_FAILURES === 'true';
    return sessionEnabled || envEnabled;
  }

  return false;
}

/**
 * Check if a specific endpoint should be affected
 */
function shouldAffectEndpoint(url: string): boolean {
  const config = state.config;
  if (!config.targetEndpoints || config.targetEndpoints.length === 0) {
    return true; // Affect all endpoints if no filter
  }
  return config.targetEndpoints.some((endpoint) => url.includes(endpoint));
}

/**
 * Check if this request should fail based on random failure rate
 */
function shouldFail(): boolean {
  if (!state.config.randomFailureRate || state.config.randomFailureRate <= 0) {
    return false;
  }
  return Math.random() * 100 < state.config.randomFailureRate;
}

/**
 * Simulate a failed response
 */
function createFailureResponse(httpErrorCode: number): Response {
  const status = httpErrorCode || 500;
  const statusText =
    status === 503 ? 'Service Unavailable' : status === 500 ? 'Internal Server Error' : `HTTP ${status}`;

  return new Response(
    JSON.stringify({
      error: {
        message: `[FAILURE INJECTION] Simulated ${statusText}`,
        statusCode: status,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status,
      statusText,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Apply latency to a fetch operation
 */
async function applyLatency(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap fetch to inject failures
 * This is called by the request utilities
 */
export async function fetchWithFailureInjection(
  url: string,
  options?: RequestInit
): Promise<Response> {
  if (!isEnabled() || !shouldAffectEndpoint(url)) {
    // Normal fetch - no injection
    return fetch(url, options);
  }

  state.requestCount++;
  const config = state.config;

  if (config.verbose) {
    console.log(`[Failure Injection] Request #${state.requestCount} to ${url}`);
  }

  try {
    // Simulate timeout - return a rejected promise that never resolves
    if (config.timeout && config.timeout > 0) {
      if (config.verbose) {
        console.warn(`[Failure Injection] Simulating timeout (${config.timeout}ms) for ${url}`);
      }
      state.failureCount++;

      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout (simulated by failure injection)'));
        }, config.timeout);
      });
    }

    // Apply artificial latency
    if (config.latency && config.latency > 0) {
      if (config.verbose) {
        console.log(`[Failure Injection] Adding latency (${config.latency}ms) for ${url}`);
      }
      await applyLatency(config.latency);
    }

    // Simulate random failures
    if (shouldFail()) {
      state.failureCount++;
      const errorCode = config.httpErrorCode || 500;
      if (config.verbose) {
        console.warn(`[Failure Injection] Simulating HTTP ${errorCode} for ${url}`);
      }
      return createFailureResponse(errorCode);
    }

    // Simulate specific HTTP error
    if (config.httpErrorCode && config.httpErrorCode > 0) {
      state.failureCount++;
      if (config.verbose) {
        console.warn(`[Failure Injection] Simulating HTTP ${config.httpErrorCode} for ${url}`);
      }
      return createFailureResponse(config.httpErrorCode);
    }

    // Normal request - no injection needed
    if (config.verbose) {
      console.log(`[Failure Injection] Allowing normal request to ${url}`);
    }
    return fetch(url, options);
  } catch (error) {
    // Re-throw network errors, timeouts, etc.
    throw error;
  }
}

/**
 * Configuration interface exposed to window
 */
export const failureInjectionConfig = {
  /**
   * Enable failure injection (requires browser console)
   * Usage: window.__failureInjection?.enable()
   */
  enable: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('DEBUG_FAILURES', 'true');
      console.log('%c✓ Failure Injection ENABLED', 'color: orange; font-weight: bold');
      console.log('Use: window.__failureInjection?.setConfig({...}) to configure');
    }
  },

  /**
   * Disable failure injection
   * Usage: window.__failureInjection?.disable()
   */
  disable: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('DEBUG_FAILURES');
      state.enabled = false;
      console.log('%c✗ Failure Injection DISABLED', 'color: green; font-weight: bold');
    }
  },

  /**
   * Set failure injection configuration
   * Usage: window.__failureInjection?.setConfig({latency: 2000, randomFailureRate: 20})
   */
  setConfig: (config: FailureConfig) => {
    if (!isEnabled()) {
      console.warn('[Failure Injection] Not enabled - use enable() first');
      return;
    }
    state.config = { ...state.config, ...config };
    console.log('%c⚙ Failure Injection Config Updated', 'color: orange; font-weight: bold');
    console.table({
      latency: `${state.config.latency || 0}ms`,
      httpErrorCode: state.config.httpErrorCode || 'none',
      timeout: state.config.timeout ? `${state.config.timeout}ms` : 'none',
      randomFailureRate: `${state.config.randomFailureRate || 0}%`,
      targetEndpoints: state.config.targetEndpoints?.join(', ') || 'all',
      verbose: state.config.verbose ? 'yes' : 'no',
    });
  },

  /**
   * Get current statistics
   * Usage: window.__failureInjection?.getStats()
   */
  getStats: () => {
    return {
      enabled: isEnabled(),
      totalRequests: state.requestCount,
      failedRequests: state.failureCount,
      failureRate: state.requestCount > 0 ? ((state.failureCount / state.requestCount) * 100).toFixed(2) + '%' : 'N/A',
      currentConfig: state.config,
    };
  },

  /**
   * Reset statistics
   * Usage: window.__failureInjection?.resetStats()
   */
  resetStats: () => {
    state.requestCount = 0;
    state.failureCount = 0;
    console.log('%c↻ Failure Injection Stats Reset', 'color: blue; font-weight: bold');
  },

  /**
   * Print example configurations
   */
  examples: () => {
    console.log('%cFailure Injection Examples', 'color: cyan; font-weight: bold; font-size: 14px');

    console.log('%cLatency Test (2 second delay)', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({latency: 2000})');

    console.log('%cHTTP 500 Error', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({httpErrorCode: 500})');

    console.log('%cHTTP 503 Service Unavailable', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({httpErrorCode: 503})');

    console.log('%cTimeout Simulation', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({timeout: 5000})');

    console.log('%cRandom 20% Failure Rate', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({randomFailureRate: 20})');

    console.log('%cSpecific Endpoint Only (/flights)', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({latency: 2000, targetEndpoints: ["/flights"]})');

    console.log('%cVerbose Logging', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.setConfig({latency: 1000, verbose: true})');

    console.log('%cDisable', 'color: cyan; font-weight: bold');
    console.log('window.__failureInjection?.disable()');
  },
};

// Expose to window in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__failureInjection = failureInjectionConfig;
  console.log('%cℹ Failure Injection Ready (dev-only)', 'color: gray; font-size: 12px');
  console.log('%cEnable: sessionStorage.setItem("DEBUG_FAILURES", "true")', 'color: gray; font-size: 12px');
  console.log('%cExamples: window.__failureInjection?.examples()', 'color: gray; font-size: 12px');
}

export default failureInjectionConfig;
