const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');
const {isolatedBridge}=require('./test-helpers');
let ACTIVE_PORT=0;
function req(path,method='GET',data=null){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:ACTIVE_PORT,path,method,headers:{'Content-Type':'application/json'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(s)})}catch(e){reject(e)}})});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitJob(job){for(let i=0;i<180;i++){const j=await req(`/api/jobs/${job.id}`);if(j.data.status==='done')return j.data;if(j.data.status==='error')throw new Error(j.data.error);await sleep(30);}throw new Error('job timeout');}
(async()=>{
  const ctx=isolatedBridge({MOCK_NCM:'1',MOCK_TRACK:'Dirty Paws'}); ACTIVE_PORT=ctx.port;
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:ctx.env});
  try{
    for(let i=0;i<40;i++){try{await req('/api/health');break}catch{await sleep(60)}}
    const start=await req('/api/session/start','POST',{radius:35,stateWords:'保持人声，不要纯音乐'});
    const started=(await waitJob(start.data)).result;
    assert(started.upcoming.length>=3,'session should create usable runway, not a single song');
    assert(started.upcoming.every(t=>String(t.reason||'').trim()),'every recommended track must have a recommendation reason');
    assert(started.upcoming.every(t=>!/网易云|召回|重排|候选池|模型|AI/i.test(String(t.reason||''))),'recommendation reasons must use listener language, not engineering provenance');
    const anchor=(await req('/api/state')).data.track;
    const far=await req('/api/session/feedback','POST',{type:'far'});
    const adjusted=(await waitJob(far.data)).result;
    const afterFeedback=(await req('/api/state')).data.track;
    assert.equal(afterFeedback.title,anchor.title,'feedback must not skip the current song');
    assert.equal(afterFeedback.artist,anchor.artist,'feedback must not change playback');
    assert(adjusted.radius<started.radius,'closer feedback should tighten future radius');
    assert(adjusted.upcoming.length>=2,'feedback should prepare future tracks');

    const expectedNext=adjusted.upcoming[0];
    await req('/api/player/next','POST');
    await sleep(2200);
    const live=(await req('/api/state')).data.track;
    const sess=(await req('/api/session')).data;
    assert.equal(live.title,expectedNext.title,'player transition should be reflected in live state');
    assert(sess.currentRecommendation,'session should know which recommendation is actually playing');
    assert.equal(sess.currentRecommendation.title,live.title);
    assert(sess.currentRelation?.reason,'current track should keep its relationship to the anchor');
    assert.equal(sess.autoplay,true,'session should continue without per-song confirmation');


    // Move to an unrelated external track and verify “继续原来的” is a
    // Bridge-owned decision, not a one-frame client hide that flashes back.
    await req('/api/mock/play','POST',{title:'First Girl On The Moon'});
    await sleep(80);
    const signaled=(await req('/api/session')).data;
    assert.equal(signaled.signal,true,'an external track should be surfaced as a possible new origin');
    const kept=(await req('/api/session/keep','POST')).data;
    assert.equal(kept.signal,false,'keep-original should dismiss the current signal');
    for(let i=0;i<3;i++){
      await sleep(30);
      const stable=(await req('/api/session')).data;
      assert.equal(stable.signal,false,'dismissed signal must not flash back on subsequent polls');
    }

    const ended=(await req('/api/session/end','POST')).data;
    assert.equal(ended.active,false,'ending a round should deactivate the Session');
    assert(ended.currentTrack?.title,'ending a round must keep the actual playing track visible');
    assert(ended.lastEndedAt,'ending a round should expose a stable ended state');
    console.log('✓ continuous session: feedback does not skip + current track sync + stable end-of-round state');
  } finally { child.kill('SIGTERM'); await sleep(150); ctx.cleanup(); }
})().catch(e=>{console.error(e);process.exitCode=1});
