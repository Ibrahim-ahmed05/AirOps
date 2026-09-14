// Actual HTTP traffic. No mock responses or estimated output.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const base = __ENV.API_BASE_URL || 'http://127.0.0.1:4000';
const vus = Number(__ENV.TEST_VUS || 10);
const duration = __ENV.TEST_DURATION || '60s';
const failed = new Counter('failed_requests');
const timeouts = new Counter('timeout_requests');
const responses503 = new Counter('responses_503');
const payload = new Trend('response_body_bytes');
const byEndpoint = {};
for (const name of ['list', 'search', 'dashboard', 'health']) byEndpoint[name] = new Trend(`latency_${name}`, true);
export const options = {
  scenarios: { capacity: { executor: 'constant-vus', vus, duration, gracefulStop: '15s' } },
  thresholds: { http_reqs: ['count>0'], http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'], checks: ['rate==1'] },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max', 'count'],
};
export function setup() {
  const r = http.get(`${base}/api/flights?limit=1`, { timeout: '30s' });
  if (r.status !== 200 || r.json('pagination.total') < 500000) throw new Error('Requires a reachable database with at least 500,000 flights');
  return { totalFlights: r.json('pagination.total'), startedAt: new Date().toISOString() };
}
export default function () {
  // Rotate users through ten slots; requested mix is deterministic, achieved counts are saved.
  const slot = (__VU + __ITER) % 10;
  const name = slot < 6 ? 'list' : slot < 8 ? 'search' : slot === 8 ? 'dashboard' : 'health';
  const path = name === 'list' ? `/api/flights?limit=20&page=${1 + (__ITER % 50)}`
    : name === 'search' ? `/api/flights?limit=20&search=${['AA', 'DL', 'UA', 'EK'][__ITER % 4]}`
    : name === 'dashboard' ? '/api/dashboard' : '/health';
  const r = http.get(base + path, { timeout: '10s', tags: { name, endpoint: name } });
  let valid = false;
  try {
    const body = r.json();
    valid = r.status === 200 && (name === 'health' ? body.database.status === 'connected'
      : name === 'dashboard' ? body.data.totalFlights >= 500000
      : Array.isArray(body.data) && body.data.length <= 20 && body.pagination.total >= 0);
  } catch (_) { /* malformed and timed-out responses fail the check */ }
  check(r, { '200 and valid body': () => valid });
  failed.add(valid ? 0 : 1);
  timeouts.add(r.status === 0 ? 1 : 0);
  responses503.add(r.status === 503 ? 1 : 0);
  byEndpoint[name].add(r.timings.duration);
  payload.add((r.body || '').length);
  sleep(0.75);
}
export function handleSummary(data) {
  return { [__ENV.SUMMARY_PATH || 'capacity-summary.json']: JSON.stringify({
    capturedAt: new Date().toISOString(), configuration: { vus, duration, thinkTimeMs: 750, requestTimeoutMs: 10000, workload: '60% list / 20% search / 10% dashboard / 10% health (rotating slots)' }, ...data,
  }, null, 2) };
}
