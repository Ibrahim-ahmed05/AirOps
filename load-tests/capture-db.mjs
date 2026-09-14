import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const out=process.env.RESULT_DIR || 'results/2026-09-14/baseline';fs.mkdirSync(out,{recursive:true});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL, max:1});
try{
  const result={at:new Date().toISOString(),version:(await db.query('SELECT version()')).rows,
    settings:(await db.query("SELECT name,setting,unit FROM pg_settings WHERE name IN ('max_connections','shared_buffers','work_mem','effective_cache_size','max_parallel_workers_per_gather','statement_timeout')")).rows,
    counts:(await db.query('SELECT (SELECT count(*) FROM flights)::int flights,(SELECT count(*) FROM flight_events)::int events,(SELECT count(*) FROM incidents)::int incidents,(SELECT count(*) FROM airports)::int airports,(SELECT count(*) FROM aircraft)::int aircraft')).rows[0],
    indexes:(await db.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows,
    plans:[]};
  const queries={count:'SELECT count(*) FROM flights',list:'SELECT f.id FROM flights f JOIN airports o ON o.id=f.origin_airport_id JOIN airports d ON d.id=f.destination_airport_id JOIN aircraft a ON a.id=f.aircraft_id ORDER BY scheduled_departure DESC LIMIT 20',search:"SELECT f.id FROM flights f JOIN airports o ON o.id=f.origin_airport_id JOIN airports d ON d.id=f.destination_airport_id WHERE f.flight_number ILIKE '%AA%' OR f.airline_code ILIKE '%AA%' OR o.code ILIKE '%AA%' OR d.code ILIKE '%AA%' ORDER BY scheduled_departure DESC LIMIT 20",events:'SELECT * FROM flight_events WHERE flight_id=1 ORDER BY event_time DESC'};
  for(const [name,sql] of Object.entries(queries))result.plans.push({name,sql,plan:(await db.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql)).rows[0]['QUERY PLAN']});
  fs.writeFileSync(out+'/database.json',JSON.stringify(result,null,2));console.log(result.counts);
}finally{await db.end();}
