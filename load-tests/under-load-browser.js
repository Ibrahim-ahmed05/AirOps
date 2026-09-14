import http from 'k6/http';import {browser} from 'k6/browser';import {check} from 'k6';import {Counter} from 'k6/metrics';
const completed=new Counter('under_load_browser_completed');
const out=__ENV.RESULT_DIR || 'results/2026-09-14/browser-under-load';
export const options={scenarios:{traffic:{executor:'constant-vus',vus:50,duration:'35s',gracefulStop:'15s',exec:'httpTraffic'},ui:{executor:'shared-iterations',vus:1,iterations:1,startTime:'5s',maxDuration:'55s',exec:'ui',options:{browser:{type:'chromium'}}}},thresholds:{under_load_browser_completed:['count==1'],checks:['rate==1']}};
export function httpTraffic(){
  const base=__ENV.API_BASE_URL || 'http://localhost:4000';
  const r=http.get(`${base}/api/flights?limit=20`);
  check(r,{'background API request succeeds':x=>x.status===200});
}
export async function ui(){
  const context=await browser.newContext();const page=await context.newPage();
  try{
    await page.goto('http://localhost:3000/flights');
    await page.evaluate(()=>new Promise(r=>setTimeout(r,23000)));
    const text=await page.locator('body').innerText();
    const navigation=await page.locator('a[href="/dashboard"]').count();
    console.log('UNDER_LOAD_UI='+JSON.stringify({at:new Date().toISOString(),navigationPresent:navigation>0,text}));
    await page.screenshot({path:out+'/flights.png',fullPage:true});
    check(navigation,{'navigation remains present under 50 VUs':n=>n>0});completed.add(1);
  }finally{await page.close();await context.close();}
}
export function handleSummary(data){return {[out+'/summary.json']:JSON.stringify(data,null,2)};}
