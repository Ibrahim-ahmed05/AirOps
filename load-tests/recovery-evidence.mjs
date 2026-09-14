// Stop the previous local API first: this runner owns its API process and restarts it.
import {spawn} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';import dotenv from 'dotenv';
dotenv.config();const dir=path.resolve('results/2026-09-14/recovery');fs.mkdirSync(dir,{recursive:true});
const apiLog=fs.openSync(path.join(dir,'api.ndjson'),'w');const browserLog=fs.createWriteStream(path.join(dir,'console.txt'));
const evidence={startedAt:new Date().toISOString(),events:[]};
const stamp=event=>{evidence.events.push({event,at:new Date().toISOString()});};
function startAPI(){const p=spawn(process.execPath,['apps/api/dist/server.js'],{env:{...process.env,NODE_ENV:'production',CORS_ORIGIN:'http://localhost:3000'},stdio:['ignore',apiLog,apiLog],windowsHide:true});stamp('api-start');return p;}
let api=startAPI();let restarted=false;
try{
  for(let i=0;i<30;i++){try{if((await fetch('http://localhost:4000/health')).ok)break;}catch(_){}await new Promise(r=>setTimeout(r,500));}
  const k6=process.env.K6_BINARY || path.resolve('.tools/k6/k6-v2.2.0-windows-amd64/k6.exe');
  const b=spawn(k6,['run','--quiet','load-tests/recovery-browser.js'],{env:{...process.env,RESULT_DIR:dir.replaceAll('\\','/'),K6_BROWSER_EXECUTABLE_PATH:process.env.K6_BROWSER_EXECUTABLE_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let buffer='';
  const onData=chunk=>{browserLog.write(chunk);buffer+=chunk.toString();const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){
    if(line.includes('RECOVERY_READY')){stamp('browser-ready');api.kill('SIGTERM');stamp('api-stop');}
    if(line.includes('RECOVERY_OFFLINE_OBSERVED')&&!restarted){stamp('browser-offline');restarted=true;api=startAPI();}
    if(line.includes('RECOVERY_ONLINE_OBSERVED'))stamp('browser-recovered');
  }};b.stdout.on('data',onData);b.stderr.on('data',onData);
  evidence.exitCode=await new Promise((resolve,reject)=>{b.on('exit',resolve);b.on('error',reject);});
  evidence.passed=evidence.exitCode===0&&evidence.events.some(e=>e.event==='browser-recovered');
  if(!evidence.passed)process.exitCode=1;
}finally{api.kill('SIGTERM');browserLog.end();fs.closeSync(apiLog);fs.writeFileSync(path.join(dir,'timeline.json'),JSON.stringify(evidence,null,2));console.log(evidence);}
