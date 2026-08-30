const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');
const TEST_PORT=Number(process.env.TEST_PORT||19428);

function req(path,method='GET',data=null){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:TEST_PORT,path,method,headers:{'Content-Type':'application/json'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(s)})}catch(e){reject(e)}})});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function waitJob(job){for(let i=0;i<100;i++){const j=await req(`/api/jobs/${job.id}`);if(j.data.status==='done')return j.data;if(j.data.status==='error')throw new Error(j.data.error);await sleep(30);}throw new Error('job timeout');}
async function runMock(track, fn){
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...process.env,PORT:String(TEST_PORT),MOCK_NCM:'1',MOCK_TRACK:track}});
  child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));
  try{
    for(let i=0;i<30;i++){try{await req('/api/health');break}catch{await sleep(70)}}
    await fn();
  } finally { child.kill('SIGTERM'); await sleep(180); }
}

(async()=>{
  await runMock('Dom andra',async()=>{
    const h=await req('/api/health');const st=await req('/api/state');const startedAt=Date.now();const p=await req('/api/session/start','POST',{radius:35,stateWords:'冷 克制 北欧，不要华语',excludes:''});
    assert.equal(p.status,202);assert(Date.now()-startedAt<500,'start endpoint must respond immediately');
    const job=await waitJob(p.data);const plan=job.result;
    assert(h.data.ok);assert(st.data.track);assert(plan.queue?.length);
    assert(job.history.some(x=>x.stage==='understand'));assert(job.history.some(x=>x.stage==='recall'));assert(job.history.some(x=>x.stage==='rank'));
    assert(plan.upcoming.length>=3,'session runway too short');
    assert.equal(plan.queue.length,plan.upcoming.length,'initial queue view should equal upcoming runway');
    console.log('✓ Kent async session',plan.queue.map(x=>`${x.artist} — ${x.title}`).join(' | '));
  });
  await runMock('Dirty Paws',async()=>{
    const p=await req('/api/session/start','POST',{radius:35,stateWords:'保持人声，不要纯音乐',excludes:''});
    const plan=(await waitJob(p.data)).result;
    assert(plan.upcoming?.length>=3,'Dirty Paws should produce at least a usable 3-track runway');
    const labels=plan.queue.map(x=>`${x.artist} ${x.title}`);
    assert(!labels.some(x=>/Guitar Tribute Players|tribute/i.test(x)),'tribute leaked into plan');
    assert(!plan.queue.some(x=>x.artist==='Klaas'),'coarse local world-break Klaas leaked at radius 35');
    const nonAnchor=plan.queue.filter(x=>x.artist!=='Of Monsters and Men').map(x=>x.artist.toLowerCase());
    assert.equal(nonAnchor.length,new Set(nonAnchor).size,'non-anchor artist duplicated');
    const tracks=plan.queue.map(x=>`${x.artist.toLowerCase()}::${x.title.toLowerCase()}`);
    assert.equal(tracks.length,new Set(tracks).size,'same track duplicated');
    console.log('✓ Dirty Paws local bad-case guard',plan.queue.map(x=>`${x.artist} — ${x.title}`).join(' | '));
  });
})().catch(e=>{console.error(e);process.exitCode=1;});
