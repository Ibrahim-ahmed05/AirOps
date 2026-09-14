// Run from repository root: node load-tests/run-evidence.mjs --phase=baseline
// Existing API must be running. JSON, raw points, logs and recovery checks are retained.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const arg = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.split('=').slice(1).join('=') || fallback;
const phase = arg('phase', 'baseline');
if (!/^[a-z0-9-]+$/.test(phase)) throw new Error('Invalid phase');
const dir = path.resolve('results', new Date().toISOString().slice(0, 10), phase);
fs.mkdirSync(dir, { recursive: true });
const k6 = process.env.K6_BINARY || path.resolve('.tools/k6/k6-v2.2.0-windows-amd64/k6.exe');
const levels = arg('levels', '10,50,100,150,500').split(',').map(Number);
const repetitions = Number(arg('repetitions', '2'));
const duration = arg('duration', '60s');
const base = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 3000, query_timeout: 10000 });
const save = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2));
const counts = async () => (await db.query(`SELECT (SELECT count(*) FROM flights)::int flights, (SELECT count(*) FROM flight_events)::int events, (SELECT count(*) FROM incidents)::int incidents, (SELECT count(*) FROM airports)::int airports, (SELECT count(*) FROM aircraft)::int aircraft`)).rows[0];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceFiles = ['apps/api/dist/server.js', 'load-tests/capacity.js', 'load-tests/run-evidence.mjs'];
const manifest = { startedAt: new Date().toISOString(), phase, levels, repetitions, duration, node: process.version,
  k6: spawnSync(k6, ['version'], { encoding: 'utf8' }).stdout.trim(),
  gitCommit: spawnSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).stdout.trim(),
  sourceHashes: Object.fromEntries(sourceFiles.map(f => [f, hash(f)])),
  host: { platform: os.platform(), release: os.release(), cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model, memoryGiB: +(os.totalmem()/1024**3).toFixed(2) },
  database: (await db.query('SELECT version()')).rows[0], countsBefore: await counts(),
  limits: 'Single local machine; k6 and API share resources. HTTP VUs do not represent open browsers. Two 60-second runs are not a soak or production certificate.', runs: [] };
save('manifest.json', manifest);
const delay = ms => new Promise(r => setTimeout(r, ms));
async function recovery() {
  const started = Date.now(); const attempts = [];
  while (Date.now()-started < 120000) {
    try {
      const t = performance.now();
      const r = await fetch(`${base}/api/flights?limit=1`, { signal: AbortSignal.timeout(10000) });
      const body = await r.json();
      const ok = r.status === 200 && body.pagination?.total >= 500000;
      attempts.push({status:r.status, ms:performance.now()-t, ok});
      if (ok) return { recovered:true, elapsedMs:Date.now()-started, attempts };
    } catch(e) { attempts.push({error:e.message}); }
    await delay(2000);
  }
  return { recovered:false, elapsedMs:Date.now()-started, attempts };
}
try {
  for (const vus of levels) for(let repeat=1; repeat<=repetitions; repeat++) {
    const name = `vu-${vus}-run-${repeat}`;
    const ready = await recovery();
    if (!ready.recovered) throw new Error('API failed recovery before '+name);
    console.log(`Starting ${phase}/${name} for ${duration}`);
    const log = fs.openSync(path.join(dir, `${name}.txt`), 'w');
    const monitor = []; let monitoring=false;
    const timer = setInterval(async()=>{
      if(monitoring) return; monitoring=true;
      try { monitor.push({at:new Date().toISOString(), ...(await db.query("SELECT count(*)::int connections, count(*) FILTER (WHERE state='active')::int active, count(*) FILTER (WHERE wait_event_type='Lock')::int lock_waits FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()" )).rows[0]}); }
      catch(e) { monitor.push({at:new Date().toISOString(), error:e.message}); }
      finally { monitoring=false; }
    },2000);
    const started=Date.now();
    const child = spawn(k6, ['run','--quiet','--out',`json=${path.join(dir,name+'.ndjson')}`,'load-tests/capacity.js'], {
      env: {...process.env, API_BASE_URL:base, TEST_VUS:String(vus), TEST_DURATION:duration, SUMMARY_PATH:path.join(dir,name+'.json')},
      stdio:['ignore',log,log], windowsHide:true,
    });
    const exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
    clearInterval(timer); fs.closeSync(log);
    while(monitoring) await delay(50);
    save(name+'-monitor.json',monitor);
    const recoveryResult=await recovery();
    const run={name,vus,repeat,exitCode,elapsedMs:Date.now()-started,recovery:recoveryResult};
    manifest.runs.push(run); save('manifest.json',manifest);
    if(!fs.existsSync(path.join(dir,name+'.json'))) throw new Error('Missing k6 summary: '+name);
    console.log(`Finished ${name}: exit=${exitCode}, recovered=${recoveryResult.recovered}`);
    if(!recoveryResult.recovered) throw new Error('Stop: service did not recover');
    await delay(3000);
  }
  manifest.countsAfter=await counts(); manifest.completedAt=new Date().toISOString();
  manifest.readOnlyCountsUnchanged=JSON.stringify(manifest.countsBefore)===JSON.stringify(manifest.countsAfter);
} catch(e) { manifest.error=e.message; throw e; }
finally { save('manifest.json',manifest); await db.end(); }
