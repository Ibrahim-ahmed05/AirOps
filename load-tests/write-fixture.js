import http from 'k6/http';
import {check} from 'k6';
const base=__ENV.API_BASE_URL || 'http://127.0.0.1:4000';
export const options={scenarios:{writes:{executor:'shared-iterations',vus:50,iterations:200,maxDuration:'2m'}},thresholds:{http_reqs:['count==200'],checks:['rate==1'],http_req_failed:['rate==0']}};
export function setup(){if(!__ENV.TEST_FLIGHT_ID || !__ENV.TEST_WRITE_TOKEN)throw new Error('Runner-created disposable fixture required');}
export default function(){
  const r=http.patch(`${base}/api/flights/${__ENV.TEST_FLIGHT_ID}/status`,JSON.stringify({status:'DELAYED',delayMinutes:__VU,message:`${__ENV.TEST_WRITE_TOKEN}:${__VU}:${__ITER}`}),{headers:{'Content-Type':'application/json'},timeout:'15s'});
  check(r,{'status update acknowledged':r=>r.status===200});
}
export function handleSummary(data){return {[__ENV.SUMMARY_PATH]:JSON.stringify(data,null,2)};}
