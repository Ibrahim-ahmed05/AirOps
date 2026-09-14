import fs from 'node:fs';
import path from 'node:path';
const base=process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const out=process.env.RESULT_DIR || 'results/2026-09-14/baseline';
fs.mkdirSync(out,{recursive:true});
const paths=['/health','/api/airports','/api/dashboard','/api/flights?limit=20','/api/flights?limit=50','/api/flights?limit=100','/api/flights?page=50&limit=20','/api/flights?status=DELAYED&limit=20','/api/flights?search=AA&limit=20'];
const first=await fetch(base+'/api/flights?limit=1').then(r=>r.json());
paths.push('/api/flights/'+first.data[0].id);
const result={capturedAt:new Date().toISOString(),runsPerEndpoint:20,warmupsPerEndpoint:3,results:[]};
for(const endpoint of paths){
  for(let i=0;i<3;i++) await fetch(base+endpoint).then(r=>r.arrayBuffer());
  const samples=[];
  for(let i=0;i<20;i++){
    const start=performance.now();
    try{const r=await fetch(base+endpoint,{signal:AbortSignal.timeout(15000)});const body=await r.arrayBuffer();samples.push({ms:performance.now()-start,status:r.status,bytes:body.byteLength});}
    catch(e){samples.push({ms:performance.now()-start,status:0,error:e.message});}
  }
  const times=samples.map(s=>s.ms).sort((a,b)=>a-b);
  result.results.push({endpoint,samples,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.ceil(times.length*.95)-1],failures:samples.filter(s=>s.status!==200).length});
  console.log(endpoint, result.results.at(-1).meanMs.toFixed(1)+'ms');
}
fs.writeFileSync(path.join(out,'api-measurements.json'),JSON.stringify(result,null,2));
if(result.results.some(r=>r.failures)) process.exitCode=1;
