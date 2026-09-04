import http from 'node:http';
import { performance } from 'node:perf_hooks';

const baseUrl = 'http://localhost:4000';
const args = process.argv.slice(2);
const levelsArg = args.find((value) => value.startsWith('--levels='));
const thinkArg = args.find((value) => value.startsWith('--think='));
const durationArg = args.find((value) => value.startsWith('--duration='));
const levels = levelsArg
  ? levelsArg.split('=')[1].split(',').map(Number).filter((value) => value > 0)
  : [10, 50, 100, 150];
const thinkTimeMs = thinkArg ? Number(thinkArg.split('=')[1]) : 0;
const durationMs = durationArg ? Number(durationArg.split('=')[1]) : 10_000;
const requestTimeoutMs = 10_000;

const mixes = [
  { weight: 0.60, path: '/api/flights?page=1&limit=20', name: 'flights' },
  { weight: 0.20, path: '/api/flights?page=1&limit=20&search=AA', name: 'search' },
  { weight: 0.10, path: '/api/dashboard', name: 'dashboard' },
  { weight: 0.10, path: '/health', name: 'health' },
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function chooseEndpoint() {
  const n = Math.random();
  let cumulative = 0;
  for (const item of mixes) {
    cumulative += item.weight;
    if (n <= cumulative) return item;
  }
  return mixes[0];
}

function request(path, agent) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.get(`${baseUrl}${path}`, { agent, timeout: requestTimeoutMs }, (res) => {
      res.resume();
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, ms: performance.now() - start }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (error) => resolve({ ok: false, status: 0, ms: performance.now() - start, error: error.message }));
  });
}

async function runLevel(vus) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: vus });
  const deadline = performance.now() + durationMs;
  const results = [];
  const byEndpoint = Object.fromEntries(mixes.map((item) => [item.name, []]));

  async function worker() {
    while (performance.now() < deadline) {
      const endpoint = chooseEndpoint();
      const result = await request(endpoint.path, agent);
      results.push(result);
      byEndpoint[endpoint.name].push(result);
      if (thinkTimeMs > 0 && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, thinkTimeMs));
      }
    }
  }

  const started = performance.now();
  await Promise.all(Array.from({ length: vus }, () => worker()));
  const elapsed = (performance.now() - started) / 1000;
  agent.destroy();

  const durations = results.map((item) => item.ms);
  const failures = results.filter((item) => !item.ok);
  const endpointSummary = {};
  for (const [name, values] of Object.entries(byEndpoint)) {
    const times = values.map((item) => item.ms);
    endpointSummary[name] = {
      requests: values.length,
      p95Ms: Number(percentile(times, 95).toFixed(1)),
      failures: values.filter((item) => !item.ok).length,
    };
  }

  return {
    vus,
    durationSeconds: Number(elapsed.toFixed(1)),
    thinkTimeMs,
    requests: results.length,
    requestsPerSecond: Number((results.length / elapsed).toFixed(1)),
    averageMs: Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1)),
    p50Ms: Number(percentile(durations, 50).toFixed(1)),
    p95Ms: Number(percentile(durations, 95).toFixed(1)),
    p99Ms: Number(percentile(durations, 99).toFixed(1)),
    maxMs: Number(Math.max(...durations).toFixed(1)),
    failures: failures.length,
    errorRatePercent: Number(((failures.length / results.length) * 100).toFixed(2)),
    endpoints: endpointSummary,
  };
}

const output = [];
for (const vus of levels) {
  const result = await runLevel(vus);
  output.push(result);
  console.log(JSON.stringify(result));
  await new Promise((resolve) => setTimeout(resolve, 3_000));
}
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: thinkTimeMs > 0
    ? `${durationMs / 1000}-second read-only local probe with ${thinkTimeMs}ms think time`
    : `${durationMs / 1000}-second closed-loop read-only local break probe`,
  results: output,
}, null, 2));
