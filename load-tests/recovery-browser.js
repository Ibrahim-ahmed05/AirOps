import {browser} from 'k6/browser';import {check} from 'k6';import {Counter} from 'k6/metrics';
const completed=new Counter('recovery_journeys_completed');
const out=__ENV.RESULT_DIR || 'results/2026-09-14/recovery';
export const options={scenarios:{ui:{executor:'shared-iterations',vus:1,iterations:1,maxDuration:'90s',options:{browser:{type:'chromium'}}}},thresholds:{checks:['rate==1'],recovery_journeys_completed:['count==1']}};
export default async function(){
  const context=await browser.newContext();const page=await context.newPage();
  try{
    await page.goto('http://localhost:3000/diagnostics');
    await page.waitForFunction(()=>document.body.innerText.includes('Reachable'),{timeout:20000});
    console.log('RECOVERY_READY');
    await page.waitForFunction(()=>document.body.innerText.includes('Failed to fetch'),{timeout:30000});
    check(await page.locator('a[href="/flights"]').count(),{'navigation remains present while API down':n=>n>0});
    await page.screenshot({path:out+'/offline.png',fullPage:true});console.log('RECOVERY_OFFLINE_OBSERVED');
    await page.waitForFunction(()=>document.body.innerText.includes('Reachable')&&!document.body.innerText.includes('Unreachable'),{timeout:40000});
    await page.screenshot({path:out+'/recovered.png',fullPage:true});console.log('RECOVERY_ONLINE_OBSERVED');completed.add(1);
  }finally{await page.close();await context.close();}
}
export function handleSummary(data){return {[out+'/summary.json']:JSON.stringify(data,null,2)};}
