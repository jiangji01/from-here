const { spawn }=require('child_process');
const http=require('http');
const assert=require('assert');
const {isolatedBridge}=require('./test-helpers');
let PORT=0;
function req(path,method='GET',data=null){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:PORT,path,method,headers:{'Content-Type':'application/json'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(s)})}catch(e){reject(e)}})});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitJob(job){for(let i=0;i<160;i++){const j=await req(`/api/jobs/${job.id}`);if(j.data.status==='done')return j.data;if(j.data.status==='error')throw new Error(j.data.error);await sleep(30);}throw new Error('job timeout');}
(async()=>{
  const ctx=isolatedBridge({MOCK_NCM:'1',MOCK_TRACK:'Little Talks',MOCK_ANCHOR_UNPLAYABLE:'1'},20); PORT=ctx.port;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:ctx.env});
  child.stdout.on('data',d=>process.stdout.write(d)); child.stderr.on('data',d=>process.stderr.write(d));
  try{
    for(let i=0;i<50;i++){try{await req('/api/health');break}catch{await sleep(50)}}
    const p=await req('/api/session/start','POST',{radius:35,stateWords:'保持人声',excludes:''});
    assert.equal(p.status,202);
    const done=await waitJob(p.data); const s=done.result;
    assert.equal(s.active,true,'session must start even when anchor catalog entry is marked non-playable');
    assert.equal(s.anchor.title,'Little Talks');
    assert.equal(s.anchor.catalogResolved,true,'anchor identity should still resolve from catalog metadata');
    assert.equal(s.anchor.catalogPlayable,false,'anchor playability flag should remain false without blocking session');
    assert(s.upcoming.length>=2,'playable future candidates should still be queued');
    assert(!s.upcoming.some(t=>t.title==='Little Talks'),'anchor must not be requeued');
    console.log('✓ anchor identity is decoupled from candidate playability');
  } finally {child.kill('SIGTERM'); await sleep(100); ctx.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
