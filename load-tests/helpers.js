/**
 * K6 Load Testing Helpers
 * Utility functions for realistic user behavior simulation and request execution
 * NOTE: Written for K6 compatibility - no optional chaining (?.) or spread operators (...)
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { API_BASE_URL, THINK_TIMES, HTTP_REQUEST_OPTIONS, FLIGHT_DATA } from './config.js';

/**
 * Sleep for a random duration within a range (in milliseconds)
 * Simulates realistic user thinking time
 */
export function sleepRandom(minMs, maxMs) {
  const duration = Math.random() * (maxMs - minMs) + minMs;
  sleep(duration / 1000);
}

/**
 * Sleep with predefined think time categories
 */
export function sleepThinkTime(category) {
  category = category || 'normal';
  const ms = THINK_TIMES[category] || THINK_TIMES.normal;
  sleepRandom(ms * 0.5, ms * 1.5);
}

/**
 * Get a random integer within a range (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random element from an array
 */
export function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a random flight ID based on configured range
 */
export function getRandomFlightId() {
  return randomInt(FLIGHT_DATA.flightIdRange.min, FLIGHT_DATA.flightIdRange.max);
}

/**
 * Get a random airport code
 */
export function getRandomAirportCode() {
  return randomElement(FLIGHT_DATA.airportCodes);
}

/**
 * Get a random flight status
 */
export function getRandomStatus() {
  return randomElement(FLIGHT_DATA.statuses);
}

/**
 * Get a random page limit
 */
export function getRandomPageLimit() {
  return randomElement(FLIGHT_DATA.pageLimits);
}

/**
 * Execute a GET request and return parsed response
 */
export function apiGet(url, params) {
  params = params || {};
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const options = Object.assign({}, HTTP_REQUEST_OPTIONS, params);

  const response = http.get(fullUrl, options);
  let body = null;
  try {
    body = response.json();
  } catch (e) {
    // JSON parse failed
  }

  return {
    status: response.status,
    body: body,
    body_raw: response.body,
    headers: response.headers,
  };
}

/**
 * Execute a PATCH request and return parsed response
 */
export function apiPatch(url, payload, params) {
  params = params || {};
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const options = Object.assign({}, HTTP_REQUEST_OPTIONS, params);

  const response = http.patch(fullUrl, JSON.stringify(payload), options);
  let body = null;
  try {
    body = response.json();
  } catch (e) {
    // JSON parse failed
  }

  return {
    status: response.status,
    body: body,
    body_raw: response.body,
    headers: response.headers,
  };
}

/**
 * Execute a POST request and return parsed response
 */
export function apiPost(url, payload, params) {
  params = params || {};
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const options = Object.assign({}, HTTP_REQUEST_OPTIONS, params);

  const response = http.post(fullUrl, JSON.stringify(payload), options);
  let body = null;
  try {
    body = response.json();
  } catch (e) {
    // JSON parse failed
  }

  return {
    status: response.status,
    body: body,
    body_raw: response.body,
    headers: response.headers,
  };
}

/**
 * Health check - verify API is accessible
 */
export function healthCheck() {
  const response = apiGet('/health');
  return response.status === 200 && response.body && response.body.database && response.body.database.status === 'connected';
}

/**
 * Browse flights - GET /api/flights with pagination and optional filters
 */
export function browseFlights(filters) {
  filters = filters || {};
  const params = {
    page: filters.page || 1,
    limit: filters.limit || getRandomPageLimit(),
  };

  for (const key in filters) {
    if (key !== 'page' && key !== 'limit') {
      params[key] = filters[key];
    }
  }

  const queryString = Object.keys(params).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
  const response = apiGet(`/api/flights?${queryString}`);

  let total = 0;
  let flightCount = 0;
  if (response.body && response.body.pagination) {
    total = response.body.pagination.total;
  }
  if (response.body && response.body.data) {
    flightCount = response.body.data.length;
  }

  return {
    status: response.status,
    total: total,
    flightCount: flightCount,
    isSuccess: response.status === 200,
  };
}

/**
 * Search flights - GET /api/flights with search and filters
 */
export function searchFlights(searchTerm, filters) {
  searchTerm = searchTerm || '';
  filters = filters || {};

  const params = {
    page: 1,
    limit: 20,
  };

  if (searchTerm) {
    params.search = searchTerm;
  }

  for (const key in filters) {
    params[key] = filters[key];
  }

  const queryString = Object.keys(params).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
  const response = apiGet(`/api/flights?${queryString}`);

  let resultCount = 0;
  if (response.body && response.body.data) {
    resultCount = response.body.data.length;
  }

  return {
    status: response.status,
    resultCount: resultCount,
    isSuccess: response.status === 200,
  };
}

/**
 * Get flight details - GET /api/flights/:id
 */
export function getFlightDetails(flightId) {
  const id = flightId || getRandomFlightId();
  const response = apiGet(`/api/flights/${id}`);

  let flightNumber = null;
  let hasEvents = false;
  let hasIncidents = false;

  if (response.body && response.body.data) {
    flightNumber = response.body.data.flightNumber;
    if (response.body.data.events && response.body.data.events.length > 0) {
      hasEvents = true;
    }
    if (response.body.data.incidents && response.body.data.incidents.length > 0) {
      hasIncidents = true;
    }
  }

  return {
    status: response.status,
    flightNumber: flightNumber,
    hasEvents: hasEvents,
    hasIncidents: hasIncidents,
    isSuccess: response.status === 200,
  };
}

/**
 * Get dashboard metrics - GET /api/dashboard
 */
export function getDashboardMetrics() {
  const response = apiGet('/api/dashboard');

  let totalFlights = 0;
  let delayedFlights = 0;
  let activeIncidents = 0;

  if (response.body && response.body.data) {
    totalFlights = response.body.data.totalFlights || 0;
    delayedFlights = response.body.data.delayedFlights || 0;
    activeIncidents = response.body.data.activeIncidents || 0;
  }

  return {
    status: response.status,
    totalFlights: totalFlights,
    delayedFlights: delayedFlights,
    activeIncidents: activeIncidents,
    isSuccess: response.status === 200,
  };
}

/**
 * Update flight status - PATCH /api/flights/:id/status
 */
export function updateFlightStatus(flightId, newStatus) {
  const id = flightId || getRandomFlightId();
  const status = newStatus || getRandomStatus();
  const delayMinutes = status === 'DELAYED' ? randomInt(5, 120) : 0;

  const payload = {
    status: status,
    message: `Updated by k6 load test at ${new Date().toISOString()}`,
  };

  if (delayMinutes > 0) {
    payload.delayMinutes = delayMinutes;
  }

  const response = apiPatch(`/api/flights/${id}/status`, payload);

  return {
    status: response.status,
    flightId: id,
    newStatus: status,
    isSuccess: response.status === 200,
    isError: response.status >= 400,
  };
}

/**
 * List all airports - GET /api/airports
 */
export function listAirports() {
  const response = apiGet('/api/airports');

  let airportCount = 0;
  if (response.body && response.body.data) {
    airportCount = response.body.data.length;
  }

  return {
    status: response.status,
    airportCount: airportCount,
    isSuccess: response.status === 200,
  };
}

/**
 * Realistic user session: Browsing
 */
export function sessionBrowse() {
  browseFlights({ page: 1, limit: 20 });
  sleepThinkTime('browsing');

  browseFlights({ page: 2, limit: 20 });
  sleepThinkTime('browsing');

  getFlightDetails();
  sleepThinkTime('browsing');
}

/**
 * Realistic user session: Searching/Filtering
 */
export function sessionSearch() {
  const status = getRandomStatus();
  searchFlights('', { status: status });
  sleepThinkTime('searching');

  const origin = getRandomAirportCode();
  searchFlights('', { origin: origin });
  sleepThinkTime('searching');

  searchFlights('AA', { status: 'SCHEDULED' });
  sleepThinkTime('normal');
}

/**
 * Realistic user session: Dashboard viewing
 */
export function sessionDashboard() {
  getDashboardMetrics();
  sleepThinkTime('browsing');

  if (Math.random() > 0.5) {
    getFlightDetails();
    sleepThinkTime('browsing');
  }
}

/**
 * Realistic user session: Status updates (operators)
 */
export function sessionStatusUpdate() {
  getFlightDetails();
  sleepThinkTime('normal');

  updateFlightStatus();
  sleepThinkTime('quick');

  getFlightDetails();
  sleepThinkTime('normal');

  if (Math.random() > 0.7) {
    updateFlightStatus();
    sleepThinkTime('quick');
  }
}

/**
 * Execute a mixed workload distribution
 */
export function executeRealisticMixedWorkload() {
  const rand = Math.random();

  if (rand < 0.6) {
    sessionBrowse();
  } else if (rand < 0.8) {
    sessionSearch();
  } else if (rand < 0.9) {
    sessionDashboard();
  } else {
    // Writes must be explicitly enabled against a disposable database.
    if (__ENV.ALLOW_WRITES === 'true') sessionStatusUpdate();
    else getFlightDetails();
  }
}

/**
 * Verify API health before starting test
 */
export function verifyApiHealth() {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      if (healthCheck()) {
        console.log('Health check passed');
        return true;
      }
    } catch (e) {
      console.log(`Health check attempt ${attempts + 1} failed`);
    }
    attempts++;
    sleep(1);
  }

  console.log('API failed health check after 3 attempts');
  return false;
}
