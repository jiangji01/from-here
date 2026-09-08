const http=require('http');
const fs=require('fs');
const path=require('path');
const {spawn}=require('child_process');
const assert=require('assert');
const {isolatedBridge}=require('./test-helpers');
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
let BRIDGE_PORT=0;
function reqBridge(p,method='GET',data=null){return new Promise((resolve,reject)=>{const r=http.request({host:'127.0.0.1',port:BRIDGE_PORT,path:p,method,headers:{'Content-Type':'application/json'}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{resolve({status:res.statusCode,data:JSON.parse(s)})}catch(e){reject(e)}})});r.on('error',reject);if(data)r.write(JSON.stringify(data));r.end();});}
async function waitJob(job){for(let i=0;i<150;i++){const j=await reqBridge(`/api/jobs/${job.id}`);if(j.data.status==='done')return j.data;if(j.data.status==='error')throw new Error(j.data.error);await sleep(35);}throw new Error('job timeout');}
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
    ctx=isolatedBridge({},11); BRIDGE_PORT=ctx.port;
    server=http.createServer((req,res)=>{let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      res.setHeader('Content-Type','application/json');
      if(req.url==='/v1/chat/completions'){
        const parsed=JSON.parse(body||'{}');const prompt=parsed.messages?.at(-1)?.content||'';
        let content;
        if(prompt.includes('Music Fingerprint')){
          content=JSON.stringify({
            summary:'粗粝但不攻击，年轻而真诚，热度里带一点克制',
            anchor_language:{code:'zh',confidence:'high',reason:'中文演唱'},
            aesthetic:{why_it_stops_you:'不是因为摇滚标签，而是热度与脆弱同时存在',human_state:['年轻','真诚'],tension:['粗粝 vs 温柔','热烈 vs 克制'],world:'拥挤城市里仍想往外跑的青年感',unspoken:'还能走向更开阔但不失真的表达',avoid_reductions:['华语摇滚=继续华语摇滚'],surprise_axes:['换语言但保留青年感','制作变冷但保留真诚']},
            fingerprint:{vocal_identity:['男声','真声','略粗粝'],emotional_core:['青春感','真诚','热度'],imagery:['城市','向外'],rhythm_motion:['向前'],dynamics:['克制到打开'],instrumentation_texture:['乐队','吉他','有颗粒'],melody_harmony:['旋律驱动'],narrative:['独白'],salience:{vocal:.86,timbre:.82,instrumentation_texture:.8,rhythm_motion:.78,dynamics:.72,melody_harmony:.65,emotional_core:.74,imagery_narrative:.55,language:.42},must_preserve:['IDENTITY[band_energy|0.91] 鼓吉他与略粗粝人声共同形成向前的青年乐队身体','年轻的真诚','向前运动','粗粝中的温柔'],can_drift:['语言','制作冷暖']},
            recall_directions:[{name:'跨语言青年乐队',reason:'保留热度和真诚',aesthetic_bridge:'换语言但不换掉年轻、向前和略粗粝的表达',preserve:['青年感','运动'],drift:['语言'],search_artists:['The Killers','RADWIMPS','Phoenix'],search_keywords:[],target_language:'mixed'}],
            avoid_transforms:['tribute']
          });
        }else{
          const candidates=extractCandidates(prompt);
          const ranking=candidates.map((c,i)=>{
            const same=c.artist==='回春丹';
            const role=c.artist==='The Killers'?'deepen':c.artist==='RADWIMPS'?'open':c.artist==='Phoenix'?'turn':'land';
            return {
              candidate_id:i,score:same?100:92-i,reason:same?'同艺人但这首乐队推进感弱，不能只靠目录关系':'保留乐队推进和略粗粝人声，只改变语言与冷暖',aesthetic_judgment:same?'艺人相同不等于这首具体歌曲守住主导身份':'它把起点没说完的向外感继续了',
              next_song_worthiness:same?.55:.92,meaningful_difference:same?.18:.64,surprise_value:same?.08:.52,obviousness:same?.9:.18,cliche_risk:same?.6:.08,journey_role:same?'hold':role,transition_logic:same?'人声熟悉，但 band energy 明显变弱':'保留向前运动与真诚的人声表达，语言发生漂移',
              perceptual_distance:same?22:28+i,distance_from_anchor:'near',confidence:'high',language:same?'zh':(c.artist==='RADWIMPS'?'ja':'en'),language_confidence:'high',
              continuity:{vocal:same?.8:.82,timbre:same?.76:.74,instrumentation_texture:same?.55:.78,rhythm_motion:same?.48:.8,dynamics:same?.55:.72,melody_harmony:.7,emotional_core:.82,imagery_narrative:.75,language:same?1:.55,salience:{vocal:.86,timbre:.82,instrumentation_texture:.8,rhythm_motion:.78,dynamics:.72,melody_harmony:.65,emotional_core:.74,imagery_narrative:.55,language:.42},identity_strength:{band_energy:.91},identity_match:{band_energy:same?.42:.84}},world_breaks:[]
            };
          });
          // Deliberately put the same-artist low-identity candidate first. Deterministic
          // judgment must correct the model for the musical reason, not merely because
          // the artist is the same.
          const sameIndex=candidates.findIndex(c=>c.artist==='回春丹');
          const preferred=candidates.map((_,i)=>i).filter(i=>i!==sameIndex);
          content=JSON.stringify({ranking,sequence:[sameIndex,...preferred].filter(i=>i>=0)});
        }
        return res.end(JSON.stringify({choices:[{message:{content}}]}));
      }
      res.statusCode=404;res.end('{}');
    });});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
    fs.writeFileSync(ctx.configFile,JSON.stringify({port:ctx.port,queueSize:5,ai:{provider:'openai-compatible',baseUrl:`http://127.0.0.1:${port}/v1`,apiKey:'test-key',model:'test-model',modelMode:'custom',autoDiscover:false}},null,2));
    child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{...ctx.env,MOCK_NCM:'1',MOCK_TRACK:'鲜花'}});
    for(let i=0;i<40;i++){try{await reqBridge('/api/health');break}catch{await sleep(70)}}
    const p=await reqBridge('/api/session/start','POST',{radius:35,stateWords:'',excludes:''});
    assert.equal(p.status,202);
    const job=await waitJob(p.data);const plan=job.result;
    assert.equal(plan.engine,'ai-session');
    assert(plan.analysis?.aesthetic?.tension?.length,'aesthetic tension was not preserved');
    assert(plan.queue.length>=3,'listening arc too short');
    assert(!plan.queue.slice(0,3).some(x=>x.artist==='回春丹'),'specific same-artist candidate with weak dominant identity leaked into first three');
    assert(plan.queue.some(x=>x.journeyRole),'journey roles missing from planned tracks');
    assert(plan.queue.some(x=>x.aestheticJudgment),'aesthetic judgment missing from planned tracks');

    await reqBridge('/api/session/end','POST',{});
    const constrained=await reqBridge('/api/session/start','POST',{radius:35,stateWords:'不要华语',excludes:''});
    assert.equal(constrained.status,202);
    const constrainedJob=await waitJob(constrained.data);const constrainedPlan=constrainedJob.result;
    assert(constrainedPlan.queue.length>=2,'constraint-aware recall should still find a path');
    assert(!constrainedPlan.queue.some(x=>x.artist==='回春丹'),'不要华语 must rewrite recall space, not leak same-artist Chinese results');
    assert(!constrainedPlan.recall?.sameArtist,'same-artist recall should be skipped when it conflicts with language constraint');
    console.log('✓ AI Listening Judgment: dominant identity → worthiness → sequence + constraint-aware recall');
  }finally{
    if(child)child.kill('SIGTERM');if(server)await new Promise(r=>server.close(r));
    if(ctx)ctx.cleanup();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
