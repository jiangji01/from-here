const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');
const {isolatedBridge}=require('./test-helpers');
let ACTIVE_PORT=0;
function req(path,method='GET',data=null){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:ACTIVE_PORT,path,method,headers:{'Content-Type':'application/json'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(s)})}catch(e){reject(e)}})});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitJob(job){for(let i=0;i<200;i++){const j=await req(`/api/jobs/${job.id}`);if(j.data.status==='done')return j.data;if(j.data.status==='error')throw new Error(j.data.error);await sleep(30);}throw new Error('job timeout');}
(async()=>{
  const ctx=isolatedBridge({MOCK_NCM:'1',MOCK_TRACK:'Dom andra'}); ACTIVE_PORT=ctx.port;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:ctx.env});
  try{
    for(let i=0;i<40;i++){try{await req('/api/health');break}catch{await sleep(60)}}
    const start=await req('/api/session/start','POST',{radius:35,stateWords:'冷、克制'});
    const initial=(await waitJob(start.data)).result;
    assert(initial.upcoming.length>=4,'initial rolling window should have several tracks');
    for(let i=0;i<4;i++){
      await req('/api/player/next','POST');
      await sleep(2100); // let Bridge-owned media monitor observe the transition
    }
    let sess=(await req('/api/session')).data;
    for(let i=0;i<30 && (sess.refillJobId || sess.upcoming.length<=1);i++){
      await sleep(250);
      sess=(await req('/api/session')).data;
    }
    assert(sess.currentRecommendation,'monitor should know current planned song without Side Panel driving it');
    assert(sess.upcoming.length>=2 || sess.refillJobId,'autopilot should replenish before the session runs dry');
    console.log('✓ autopilot refill: Bridge monitor keeps session alive without per-song user actions');
  } finally { child.kill('SIGTERM'); await sleep(150); ctx.cleanup(); }
})().catch(e=>{console.error(e);process.exitCode=1});
