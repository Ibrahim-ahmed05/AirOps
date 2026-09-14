import fs from 'node:fs';const base=process.env.API_BASE_URL || 'http://localhost:4000';const results=[];
async function test(name,url,predicate){const start=performance.now();const r=await fetch(base+url,{signal:AbortSignal.timeout(15000)});const body=await r.json();const passed=predicate(r.status,body);results.push({name,status:r.status,ms:performance.now()-start,passed});if(!passed)process.exitCode=1;return body;}
await test('DB connected','/health',(s,b)=>s===200&&b.database.status==='connected');
await test('20 rows and exact 520k total','/api/flights?limit=20',(s,b)=>s===200&&b.data.length===20&&b.pagination.total===520000);
await test('100-row cap','/api/flights?limit=100',(s,b)=>s===200&&b.data.length===100);
await test('Oversized page rejected','/api/flights?limit=101',s=>s===400);
await test('Invalid page rejected','/api/flights?page=0',s=>s===400);
await test('Invalid sort rejected','/api/flights?sortBy=unknown',s=>s===400);
await test('Empty search result','/api/flights?search=ZZZZ-NO-MATCH',(s,b)=>s===200&&b.data.length===0&&b.pagination.total===0);
await test('Status filter','/api/flights?status=DELAYED',(s,b)=>s===200&&b.data.length>0&&b.data.every(f=>f.status==='DELAYED'));
await test('Ascending sort','/api/flights?sortOrder=asc',(s,b)=>s===200&&b.data.every((f,i,a)=>!i||Date.parse(a[i-1].scheduledDeparture)<=Date.parse(f.scheduledDeparture)));
await test('Nonexistent detail','/api/flights/2147483647',s=>s===404);
await test('Dashboard matches dataset','/api/dashboard',(s,b)=>s===200&&b.data.totalFlights===520000);
fs.writeFileSync('results/2026-09-14/functional.json',JSON.stringify({at:new Date().toISOString(),results},null,2));console.log(results);
