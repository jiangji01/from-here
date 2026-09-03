const http=require('http');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const assert=require('assert');
const {isolatedBridge}=require('./test-helpers');
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
let BRIDGE_PORT=0;
function reqBridge(p,method='GET',data=null){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:BRIDGE_PORT,path:p,method,headers:{'Content-Type':'application/json'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(s)})}catch(e){reject(e)}})});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
async function waitJob(job){for(let i=0;i<120;i++){const j=await reqBridge(`/api/jobs/${job.id}`);if(j.data.status==='done')return j.data;if(j.data.status==='error')throw new Error(j.data.error);await sleep(35);}throw new Error('job timeout');}
function extractCandidates(prompt){
  for(const [marker,endMarker] of [
    ['Real candidates:','\n\nCandidate Judgment：'],
    ['下面是音乐平台返回的真实候选：','\n\nRanking 原则：']
  ]){
    const a=prompt.indexOf(marker);if(a<0)continue;
    const rest=prompt.slice(a+marker.length);const b=rest.indexOf(endMarker);if(b<0)continue;
    try{return JSON.parse(rest.slice(0,b).trim())}catch{}
  }
  return[];
}
(async()=>{
  let child,server,ctx;
  try{
    ctx=isolatedBridge({},10); BRIDGE_PORT=ctx.port;
    server=http.createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      res.setHeader('Content-Type','application/json');
      if(req.url==='/v1/chat/completions'){
        const parsed=JSON.parse(body||'{}');const prompt=parsed.messages?.at(-1)?.content||'';
        let content;
        if(prompt.includes('建立 Anchor 的 Music Fingerprint')){
          content=JSON.stringify({summary:'有人声叙事、原声质感、野性童话感与推进式动态',fingerprint:{vocal_identity:['男女声/群体人声','真声为主','重要人声叙事'],emotional_core:['野性','童话感','自由'],imagery:['森林','荒野'],rhythm_motion:['行进感','逐渐推进'],dynamics:['克制到释放'],instrumentation_texture:['原声','群体打击乐'],melody_harmony:['旋律驱动'],narrative:['故事感'],salience:{vocal:.9,timbre:.78,instrumentation_texture:.82,rhythm_motion:.76,dynamics:.7,melody_harmony:.65,emotional_core:.72,imagery_narrative:.6,language:.35},must_preserve:['IDENTITY[vocal_interplay|0.94] 男女声互动与群体人声构成核心人格','有人声','叙事感','原声质感'],can_drift:['更成熟','更暗']},recall_directions:[{name:'叙事民谣近邻',reason:'保留人声叙事与原声推进',preserve:['有人声','叙事'],drift:['更成熟'],search_artists:['Fleet Foxes','The Lumineers'],search_keywords:[]}],avoid_transforms:['tribute','instrumental cover']});
        }else{
          const candidates=extractCandidates(prompt);
          const ranking=candidates.map((c,i)=>{
            if(c.artist==='Klaas')return {candidate_id:i,score:99,reason:'电子舞曲制作打断了原声人声互动',aesthetic_judgment:'核心人声关系丢失且制作世界断裂',next_song_worthiness:.3,meaningful_difference:.8,surprise_value:.9,obviousness:.1,cliche_risk:.1,journey_role:'turn',transition_logic:'没有保住主导身份，不能作为默认距离下一跳',perceptual_distance:78,distance_from_anchor:'far',confidence:'high',continuity:{vocal:.45,timbre:.3,instrumentation_texture:.12,rhythm_motion:.1,dynamics:.32,melody_harmony:.42,emotional_core:.55,imagery_narrative:.72,language:.8,salience:{vocal:.9,timbre:.78,instrumentation_texture:.82,rhythm_motion:.76,dynamics:.7,melody_harmony:.65,emotional_core:.72,imagery_narrative:.6,language:.35},identity_strength:{vocal_interplay:.94},identity_match:{vocal_interplay:.18}},world_breaks:['acoustic indie folk → four-on-the-floor EDM','organic texture → electronic dance production']};
            return {candidate_id:i,score:90-i,reason:'保留群体人声与原声推进，质感稍微打开',aesthetic_judgment:'人声互动和推进方式仍然成立',next_song_worthiness:.88,meaningful_difference:.45,surprise_value:.35,obviousness:.2,cliche_risk:.08,journey_role:i<2?'hold':'open',transition_logic:'保留人声互动与原声身体，只在成熟度上漂移',perceptual_distance:Math.min(38,20+i*3),distance_from_anchor:'near',confidence:'high',continuity:{vocal:.8,timbre:.7,instrumentation_texture:.75,rhythm_motion:.7,dynamics:.68,melody_harmony:.7,emotional_core:.72,imagery_narrative:.72,language:.8,salience:{vocal:.9,timbre:.78,instrumentation_texture:.82,rhythm_motion:.76,dynamics:.7,melody_harmony:.65,emotional_core:.72,imagery_narrative:.6,language:.35},identity_strength:{vocal_interplay:.94},identity_match:{vocal_interplay:.82}},world_breaks:[]};
          });
          content=JSON.stringify({ranking,sequence:ranking.map(x=>x.candidate_id)});
        }
        return res.end(JSON.stringify({choices:[{message:{content}}]}));
      }
      res.statusCode=404;res.end('{}');
    });});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
    fs.writeFileSync(ctx.configFile,JSON.stringify({port:ctx.port,queueSize:5,ai:{provider:'openai-compatible',baseUrl:`http://127.0.0.1:${port}/v1`,apiKey:'test-key',model:'test-model',modelMode:'custom',autoDiscover:false}},null,2));
    child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...ctx.env,MOCK_NCM:'1',MOCK_TRACK:'Dirty Paws'}});
    for(let i=0;i<30;i++){try{await reqBridge('/api/health');break}catch{await sleep(70)}}
    const p=await reqBridge('/api/session/start','POST',{radius:35,stateWords:'保持人声，不要纯音乐',excludes:''});
    assert.equal(p.status,202);
    const job=await waitJob(p.data);const plan=job.result;
    assert.equal(plan.engine,'ai-session');
    assert(plan.analysis?.fingerprint?.vocal_identity?.length,'fingerprint missing vocal identity');
    assert(plan.analysis?.recallDirections?.length,'recall directions missing');
    assert(!plan.queue.some(x=>/tribute/i.test(`${x.artist} ${x.title}`)),'tribute leaked');
    assert(!plan.queue.some(x=>x.artist==='Klaas'),'world-break candidate Klaas leaked at radius 35');
    const artists=plan.queue.filter(x=>x.artist!=='Of Monsters and Men').map(x=>x.artist.toLowerCase());
    assert.equal(artists.length,new Set(artists).size,'artist diversity failed');
    console.log('✓ AI Session: dominant identity → recall → perceptual continuity → world-break guard');
  }finally{
    if(child)child.kill('SIGTERM');if(server)await new Promise(r=>server.close(r));
    if(ctx)ctx.cleanup();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
