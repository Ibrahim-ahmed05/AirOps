import pg from 'pg';import dotenv from 'dotenv';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {randomUUID} from 'node:crypto';
dotenv.config();
const dir=path.resolve('results/2026-09-14/writes');fs.mkdirSync(dir,{recursive:true});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL});
const token='evidence-'+randomUUID();let id;
try{
  const row=(await db.query("INSERT INTO flights(flight_number,airline_code,origin_airport_id,destination_airport_id,aircraft_id,scheduled_departure,scheduled_arrival,status,passenger_count) SELECT 'TESTWRITE',airline_code,origin_airport_id,destination_airport_id,aircraft_id,scheduled_departure,scheduled_arrival,'SCHEDULED',0 FROM flights ORDER BY id LIMIT 1 RETURNING id")).rows[0];id=row.id;
  const log=fs.openSync(path.join(dir,'console.txt'),'w');
  const k6=process.env.K6_BINARY || path.resolve('.tools/k6/k6-v2.2.0-windows-amd64/k6.exe');
  const child=spawn(k6,['run','--quiet','--out',`json=${path.join(dir,'raw.ndjson')}`,'load-tests/write-fixture.js'],{env:{...process.env,TEST_FLIGHT_ID:String(id),TEST_WRITE_TOKEN:token,SUMMARY_PATH:path.join(dir,'summary.json')},stdio:['ignore',log,log],windowsHide:true});
  const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});fs.closeSync(log);
  const events=(await db.query('SELECT count(*)::int count,count(DISTINCT message)::int unique_messages FROM flight_events WHERE flight_id=$1 AND message LIKE $2',[id,token+'%'])).rows[0];
  const flight=(await db.query('SELECT status,delay_minutes FROM flights WHERE id=$1',[id])).rows[0];
  const result={at:new Date().toISOString(),fixtureId:id,exitCode,events,flight,passed:exitCode===0&&events.count===200&&events.unique_messages===200&&flight.status==='DELAYED',scope:'50 VUs / 200 writes to one disposable row. Verifies acknowledged event persistence and no partial status/event transaction; does not prove optimistic conflict detection. Current API uses last-writer-wins.'};
  fs.writeFileSync(path.join(dir,'integrity.json'),JSON.stringify(result,null,2));console.log(result);if(!result.passed)process.exitCode=1;
}finally{
  // Delete only the fixture created above; foreign-key cascade removes its test events.
  if(id)await db.query("DELETE FROM flights WHERE id=$1 AND flight_number='TESTWRITE'",[id]);
  await db.end();
}
