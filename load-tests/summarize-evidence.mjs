import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2] || 'results/2026-09-14';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const all=[];
for(const phase of ['baseline','indexed']){
  const dir=path.join(root,phase);if(!fs.existsSync(dir))continue;
  for(const name of fs.readdirSync(dir).filter(n=>/^vu-\d+-run-\d+\.json$/.test(n))){
    const s=read(path.join(dir,name));const m=s.metrics;
    if(!m?.http_reqs?.values?.count)throw new Error('No HTTP requests in '+name);
    const requests=m.http_reqs.values.count, errors=m.http_req_failed.values.rate*100, p95=m.http_req_duration.values['p(95)'];
    all.push({phase,file:`${phase}/${name}`,vus:s.configuration.vus,requests,errorsPercent:errors,p50Ms:m.http_req_duration.values.med,p95Ms:p95,p99Ms:m.http_req_duration.values['p(99)'],rps:m.http_reqs.values.rate,
      status:p95<1000&&errors<1?'Stable':p95<3000&&errors<5?'Degraded':'Unstable',timeouts:m.timeout_requests?.values.count||0,responses503:m.responses_503?.values.count||0,
      thresholdsPassed:Object.values(m).every(metric=>!metric.thresholds||Object.values(metric.thresholds).every(t=>t.ok)),
    });
  }
}
all.sort((a,b)=>a.phase.localeCompare(b.phase)||a.vus-b.vus||a.file.localeCompare(b.file));
fs.writeFileSync(path.join(root,'capacity-table.json'),JSON.stringify(all,null,2));
let table='| Phase | VUs | Requests | P50 ms | P95 ms | P99 ms | Errors | HTTP 503 | Timeouts | Classification |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---|\n';
for(const r of all)table+=`| ${r.phase} | ${r.vus} | ${r.requests} | ${r.p50Ms.toFixed(1)} | ${r.p95Ms.toFixed(1)} | ${r.p99Ms.toFixed(1)} | ${r.errorsPercent.toFixed(2)}% | ${r.responses503} | ${r.timeouts} | ${r.status} |\n`;
fs.writeFileSync(path.join(root,'capacity-table.md'),table);
const log=path.join(root,'browser/console.txt');
if(fs.existsSync(log)){
  const line=fs.readFileSync(log,'utf8').split('\n').find(l=>l.includes('BROWSER_EVIDENCE='));
  if(line){const message=JSON.parse(line.match(/msg=(".*") source=console/)[1]);fs.writeFileSync(path.join(root,'browser/observations.json'),JSON.stringify(JSON.parse(message.slice('BROWSER_EVIDENCE='.length)),null,2));}
}
console.log(table);
