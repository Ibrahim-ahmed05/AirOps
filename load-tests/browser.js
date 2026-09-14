import { browser } from 'k6/browser';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
const completed=new Counter('browser_journeys_completed');
const base=__ENV.WEB_BASE_URL || 'http://localhost:3000';
const out=__ENV.RESULT_DIR || 'results/2026-09-14/browser';
export const options={scenarios:{ui:{executor:'shared-iterations',vus:1,iterations:1,maxDuration:'3m',options:{browser:{type:'chromium'}}}},thresholds:{checks:['rate==1'],browser_journeys_completed:['count==1']}};
const records=[];
export default async function(){
  for(const route of ['/dashboard','/flights']){
    const context=await browser.newContext();
    const page=await context.newPage(); const requests=[]; const responses=[];
    page.on('request',r=>{if(r.url().includes(':4000/'))requests.push({url:r.url(),at:Date.now()});});
    page.on('response',async r=>{if(r.url().includes(':4000/')){try{const body=await r.body();responses.push({url:r.url(),status:r.status(),bytes:body.byteLength});}catch(_){}}});
    try{
      const start=Date.now(); await page.goto(base+route,{waitUntil:'load'});
      if(route==='/flights') await page.locator('tbody tr').first().waitFor({state:'visible'});
      await page.waitForFunction(()=>document.body.innerText.includes('520,000'),{timeout:30000});
      const displayed=Date.now()-start;
      await page.screenshot({path:out+route+'.png',fullPage:true});
      records.push({route,timeToVisibleDataMs:displayed,navigation:await page.evaluate(()=>performance.getEntriesByType('navigation')[0].toJSON()),paint:await page.evaluate(()=>performance.getEntriesByType('paint').map(x=>x.toJSON())),initialRequests:requests.slice(),initialResponses:responses.slice()});
      check(displayed,{'data displayed within 15 seconds':n=>n<15000});
      if(route==='/flights'){
        // Direct fetch control with one request per character vs the actual debounced input.
        const control=await page.evaluate(async()=>{
          const start=performance.now(); const text='AA104';
          const jobs=[];
          for(let i=1;i<=text.length;i++){jobs.push(fetch('http://localhost:4000/api/flights?limit=20&search='+text.slice(0,i)).then(r=>r.status));await new Promise(r=>setTimeout(r,50));}
          return {requests:jobs.length,statuses:await Promise.all(jobs),elapsedMs:performance.now()-start};
        });
        const before=requests.length;
        await page.locator('input[placeholder*="Search flight"]').type('AA104',{delay:50});
        await page.waitForResponse(r=>r.url().includes('search=AA104'),{timeout:15000});
        await page.evaluate(()=>new Promise(r=>setTimeout(r,500)));
        const searchRequests=requests.slice(before).filter(r=>r.url.includes('search='));
        records.push({experiment:'request-per-character control versus actual debounce',control,debouncedSearchRequests:searchRequests});
        check(searchRequests,{'five typed characters produce one search request':r=>r.length===1});
        const airportsBefore=requests.filter(r=>r.url.includes('/api/airports')).length;
        await page.locator('a[href="/dashboard"]').first().click();
        await page.waitForFunction(()=>document.body.innerText.includes('Operations Control Dashboard'));
        await page.locator('a[href="/flights"]').first().click();
        await page.waitForFunction(()=>document.body.innerText.includes('520,000'));
        const airportsAfter=requests.filter(r=>r.url.includes('/api/airports')).length;
        records.push({experiment:'airport session cache across navigation',airportsBefore,airportsAfter});
        check(airportsAfter,{'navigation reuses airport cache':n=>n===airportsBefore});
      }
    }finally{await page.close();await context.close();}
  }
  console.log('BROWSER_EVIDENCE='+JSON.stringify(records));
  completed.add(1);
}
export function handleSummary(data){return {[out+'/browser-summary.json']:JSON.stringify({capturedAt:new Date().toISOString(),records,...data},null,2)};}
