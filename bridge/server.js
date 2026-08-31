const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MediaMemory } = require('./media-memory');
const { profileFor } = require('./music-map');
const { createProviderRuntime } = require('./providers');
const { discoverLocalAI } = require('./local-ai-config');
const { ANALYSIS_SYSTEM, RANK_SYSTEM, buildAnchorAnalysisPrompt, buildRankingPrompt } = require('./prompts/music-semantic');
const { composeListeningArc, aestheticReject } = require('./listening-judgment');

const MOCK = process.env.MOCK_NCM === '1';
const ROOT = __dirname;
const DATA_DIR = process.env.FROM_HERE_DATA_DIR || path.join(ROOT, '.data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const CACHE_FILE = path.join(DATA_DIR, 'track-cache.json');
const ANALYSIS_CACHE_FILE = path.join(DATA_DIR, 'anchor-analysis.json');
const MEDIA_STATE_FILE = path.join(DATA_DIR, 'media-state.json');
const DEFAULT_CONFIG = { port: 19428, queueSize: 5, minQueueSize: 3, ai: { provider: 'auto', baseUrl: '', apiKey: '', model: '', modelMode: 'follow-local', autoDiscover: true } };
const machineAI = discoverLocalAI();

function loadJson(file, fallback = {}) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch { return fallback; }
}
function loadConfig() {
  const local = loadJson(process.env.FROM_HERE_CONFIG_FILE || path.join(ROOT, 'config.local.json'), {});
  // v0.3.x used `llm`; keep it readable so existing local users can upgrade safely.
  const localAI = local.ai || local.llm || {};
  const explicitModel = process.env.LL_AI_MODEL || process.env.LLM_MODEL || '';
  const inferredMode = machineAI.model && localAI.model === machineAI.model ? 'follow-local' : (localAI.model ? 'custom' : 'follow-local');
  const modelMode = process.env.LL_AI_MODEL_MODE || localAI.modelMode || inferredMode;
  const effectiveModel = explicitModel || (modelMode === 'custom' ? (localAI.model || '') : (machineAI.model || localAI.model || ''));
  return {
    ...DEFAULT_CONFIG, ...local,
    port: Number(process.env.PORT || local.port || DEFAULT_CONFIG.port),
    queueSize: Math.max(3, Math.min(8, Number(local.queueSize || DEFAULT_CONFIG.queueSize))),
    minQueueSize: Math.max(2, Math.min(5, Number(local.minQueueSize || DEFAULT_CONFIG.minQueueSize))),
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...localAI,
      provider: process.env.LL_AI_PROVIDER || process.env.LLM_PROTOCOL || localAI.provider || localAI.protocol || machineAI.provider || DEFAULT_CONFIG.ai.provider,
      baseUrl: process.env.LL_AI_BASE_URL || process.env.LLM_BASE_URL || localAI.baseUrl || machineAI.baseUrl || '',
      apiKey: process.env.LL_AI_API_KEY || process.env.LLM_API_KEY || localAI.apiKey || machineAI.apiKey || '',
      model: effectiveModel,
      modelMode,
      localModel: machineAI.model || '',
      localSource: machineAI.source || '',
      autoDiscover: localAI.autoDiscover !== false
    }
  };
}
const config = loadConfig();
const aiProvider = createProviderRuntime(config.ai);
let trackCache = loadJson(CACHE_FILE, {});
let analysisCache = loadJson(ANALYSIS_CACHE_FILE, {});
const mediaMemory = new MediaMemory(MEDIA_STATE_FILE, { ttlMs: 6 * 60 * 60 * 1000 });
function saveCache() { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(trackCache, null, 2)); } catch {} }
function saveAnalysisCache() { try { fs.writeFileSync(ANALYSIS_CACHE_FILE, JSON.stringify(analysisCache, null, 2)); } catch {} }


const jobs = new Map();
function jobView(job){
  return {id:job.id,status:job.status,kind:job.kind,stage:job.stage,message:job.message,progress:job.progress,result:job.result||null,error:job.error||null,history:job.history||[]};
}
function createJob(kind,work){
  const id=crypto.randomUUID();
  const job={id,kind,status:'running',stage:'starting',message:'正在开始…',progress:2,result:null,error:null,history:[],createdAt:Date.now(),updatedAt:Date.now()};
  const update=(stage,message,progress)=>{job.stage=stage;job.message=message;job.progress=Math.max(job.progress,Number(progress)||0);job.updatedAt=Date.now();job.history.push({stage,message,progress:job.progress,at:job.updatedAt});};
  jobs.set(id,job);
  setImmediate(async()=>{
    try{
      const result=await work(update);
      job.result=result; job.status='done'; update('done','准备好了',100);
    }catch(e){
      job.status='error'; job.error=e?.message||String(e); update('error','这次没有走通',100);
    }
    setTimeout(()=>jobs.delete(id),10*60*1000).unref?.();
  });
  return jobView(job);
}
const session = {
  active: false,
  anchor: null,
  radius: 35,
  stateWords: '',
  excludes: '',
  positiveArtists: [],
  negativeArtists: [],
  queue: [],              // compatibility view: current recommendation + upcoming
  upcoming: [],           // future tracks From Here intends to keep ahead of the player
  currentRecommendation: null,
  currentTrack: null,
  history: [],
  recall: {},
  analysis: null,
  engine: 'local-session',
  refillJobId: null,
  refillBlockedUntil: 0,
  reserve: [],
  lastObservedKey: '',
  createdAt: null,
  updatedAt: null,
  ignoredSignalKey: '',
  lastEndedAt: null,
  lastEndedAnchor: null
};

const mockCatalog = [
  ['Kent','Dom andra','rock alternative cold'], ['Kent','Utan dina andetag','rock melancholic'], ['Kent','747','rock atmospheric'],
  ['Kent','Sverige','rock melodic'], ['Kent','Musik non stop','rock electronic'], ['Mew','Comforting Sounds','alternative atmospheric'],
  ['Mew','Am I Wry? No','alternative melodic'], ['Kashmir','Rocket Brothers','alternative melancholic'], ['Editors','No Sound But the Wind','post-punk melancholic'],
  ['The Radio Dept.','Strange Things Will Happen','indie dream pop'], ['The National','About Today','indie melancholic'],
  ['Interpol','NYC','post-punk cold'], ['Doves','There Goes the Fear','indie atmospheric'], ['Sigur Rós','Samskeyti','ambient post-rock'],
  ['Radiohead','Street Spirit (Fade Out)','alternative melancholic'], ['Placebo','Without You I’m Nothing','alternative dark'],
  ['周杰伦','晴天','mandopop nostalgic'], ['王菲','矜持','mandopop ethereal'], ['Of Monsters and Men','Dirty Paws','indie folk vocal anthemic narrative'], ['Of Monsters and Men','Little Talks','indie folk vocal'],
  ['Fleet Foxes','Mykonos','indie folk vocal harmony'], ['The Lumineers','Stubborn Love','indie folk vocal acoustic'], ['Edward Sharpe & The Magnetic Zeros','Home','indie folk vocal communal'],
  ['Guitar Tribute Players','Dirty Paws Tribute','tribute instrumental guitar cover'], ['Guitar Tribute Players','Little Talks Tribute','tribute instrumental guitar cover'], ['Guitar Tribute Players','Mountain Sound Tribute','tribute instrumental guitar cover'],
  ['Novo Amor','Anchor','ambient folk vocal'], ['Massive Attack','Teardrop','trip-hop dark vocal'], ['Klaas','First Girl On The Moon','dance edm electronic four-on-the-floor vocal'], ['Björk','Jóga','art pop electronic vocal'],
  ['回春丹','鲜花','c-pop rock vocal'], ['回春丹','艾蜜莉','c-pop rock vocal'], ['RADWIMPS','スパークル','j-rock melodic vocal'], ['The Killers','Read My Mind','indie rock melodic vocal'], ['Phoenix','Lisztomania','indie rock bright vocal']
].map((x,i)=>({
  title:x[1], artist:x[0], tags:x[2].split(' '), originalId:String(2000+i), encryptedId:(i+1).toString(16).padStart(32,'0'),
  visible:true, plLevel:'standard', freeTrailFlag:false, album:'Mock Album', coverUrl:'', source:'mock'
}));
const mockInitialIndex=Math.max(0,mockCatalog.findIndex(t=>String(t.title).toLowerCase()===String(process.env.MOCK_TRACK||'Dom andra').toLowerCase()));
const mockState = { index:0, playing:true, queue:[mockCatalog[mockInitialIndex]||mockCatalog[0]] };

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
}
function json(res,status,data){ cors(res); res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); }
function body(req){ return new Promise((resolve,reject)=>{ let s=''; req.on('data',d=>{s+=d;if(s.length>1e6)req.destroy();}); req.on('end',()=>{if(!s)return resolve({});try{resolve(JSON.parse(s));}catch{reject(new Error('请求 JSON 无法解析'));}}); req.on('error',reject);});}
function looseParse(text){ const s=String(text||'').trim(); if(!s)return null; try{return JSON.parse(s);}catch{}; for(const [a,b] of [['{','}'],['[',']']]){const i=s.indexOf(a),j=s.lastIndexOf(b);if(i>=0&&j>i){try{return JSON.parse(s.slice(i,j+1));}catch{}}} return {raw:s}; }
function stripAnsi(text){return String(text||'').replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g,'');}
function extractJsonChunks(text){
  const s=stripAnsi(text); const out=[]; let start=-1,depth=0,quote='',esc=false;
  for(let i=0;i<s.length;i++){const ch=s[i];
    if(start<0){if(ch==='{'||ch==='['){start=i;depth=1;quote='';esc=false;}continue;}
    if(quote){if(esc){esc=false;continue;}if(ch==='\\'){esc=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"){quote=ch;continue;}
    if(ch==='{'||ch==='[')depth++; else if(ch==='}'||ch===']')depth--;
    if(depth===0){const chunk=s.slice(start,i+1);try{out.push(JSON.parse(chunk));}catch{}start=-1;}
  }
  return out;
}
function parseCliOutput(stdout,stderr=''){
  const direct=looseParse(stdout);
  if(direct && !(direct.raw && typeof direct.raw==='string'))return direct;
  const chunks=extractJsonChunks(stdout);
  if(chunks.length===1)return chunks[0];
  if(chunks.length>1)return {chunks};
  const errChunks=extractJsonChunks(stderr);
  if(errChunks.length===1)return errChunks[0];
  if(errChunks.length>1)return {chunks:errChunks};
  return direct;
}
function run(command,args,timeoutMs=12000){ return new Promise((resolve,reject)=>{ const child=spawn(command,args,{shell:false,env:process.env}); let out='',err=''; const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error(`${command} 超时：${args.join(' ')}`));},timeoutMs); child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>err+=d); child.on('error',e=>{clearTimeout(timer);reject(e);}); child.on('close',code=>{clearTimeout(timer); if(code!==0)return reject(new Error(String(err||out||`${command} exited ${code}`).trim())); resolve({stdout:String(out).trim(),stderr:String(err).trim(),parsed:parseCliOutput(out,err)});}); }); }
function valueAfter(args,key){ const i=args.indexOf(key); return i>=0?args[i+1]:null; }

const JXA_NOWPLAYING_SCRIPT = path.resolve(ROOT, 'now-playing-jxa.js');
function legacyNowPlayingCommand(){
  if(process.env.FROM_HERE_NOWPLAYING_BIN) return process.env.FROM_HERE_NOWPLAYING_BIN;
  return 'nowplaying-cli';
}
function runLegacyNow(args, timeout=5000){ return run(legacyNowPlayingCommand(), args, timeout); }
function parseJxaPayload(raw){
  let parsed=looseParse(raw);
  if(typeof parsed==='string') parsed=looseParse(parsed);
  if(!parsed||typeof parsed!=='object') throw new Error('macOS system media response could not be parsed');
  if(parsed.ok===false) throw new Error(parsed.error||'macOS system media interface unavailable');
  return parsed;
}
async function runSystemNowPlaying(timeout=4500){
  if(process.env.FROM_HERE_NOWPLAYING_JSON){
    return parseJxaPayload(process.env.FROM_HERE_NOWPLAYING_JSON);
  }
  if(process.platform!=='darwin') throw new Error('macOS system media interface is only available on macOS');
  if(!fs.existsSync(JXA_NOWPLAYING_SCRIPT)) throw new Error('From Here system media script is missing');
  const r=await run('/usr/bin/osascript',['-l','JavaScript',JXA_NOWPLAYING_SCRIPT],timeout);
  return parseJxaPayload(r.stdout);
}

async function runNcm(args, timeout=15000){ if(MOCK)return mockNcm(args); return run(process.env.FROM_HERE_NCM_BIN||'ncm-cli',args,timeout); }
function mockNcm(args){
  const cmd=args.join(' ');
  if(args[0]==='--version') return Promise.resolve({stdout:'0.1.mock',parsed:{}});
  if(args[0]==='user'&&args[1]==='favorite') return Promise.resolve({stdout:JSON.stringify({playlist:{name:'我喜欢的音乐',encryptedId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',originalId:'1'},tracks:mockCatalog.slice(0,8)}),parsed:{playlist:{name:'我喜欢的音乐',encryptedId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',originalId:'1'},tracks:mockCatalog.slice(0,8)}});
  if(args[0]==='user'&&args[1]==='history') return Promise.resolve({stdout:JSON.stringify({tracks:mockCatalog.slice(4,14)}),parsed:{tracks:mockCatalog.slice(4,14)}});
  if(args[0]==='song'&&args[1]==='lyric') return Promise.resolve({stdout:JSON.stringify({lrc:{lyric:'[00:00.00]夜色里的一段故事\n[00:10.00]克制、靠近又撤退'}}),parsed:{lrc:{lyric:'[00:00.00]夜色里的一段故事\n[00:10.00]克制、靠近又撤退'}}});
  if(args[0]==='search'&&args[1]==='song'){
    const q=String(valueAfter(args,'--keyword')||'').toLowerCase();
    const toks=q.split(/\s+/).filter(Boolean); let found=mockCatalog.filter(t=>toks.every(k=>(`${t.artist} ${t.title}`).toLowerCase().includes(k))||toks.some(k=>(`${t.artist} ${t.title}`).toLowerCase().includes(k))).slice(0,12);
    if(process.env.MOCK_ANCHOR_UNPLAYABLE==='1'){
      const target=String(process.env.MOCK_TRACK||'').toLowerCase();
      found=found.map(t=>String(t.title).toLowerCase()===target?{...t,visible:false,plLevel:'none'}:t);
    }
    return Promise.resolve({stdout:JSON.stringify({songs:found.length?found:mockCatalog.slice(0,8)}),parsed:{songs:found.length?found:mockCatalog.slice(0,8)}});
  }
  if(args[0]==='recommend'&&args[1]==='heartbeat'){
    const sid=String(valueAfter(args,'--songId')||'');
    const anchor=mockCatalog.find(t=>t.encryptedId===sid);
    const songs=anchor?.title==='Dirty Paws'
      ? ['Little Talks','Mykonos','Stubborn Love','Home','Dirty Paws Tribute','Little Talks Tribute','Mountain Sound Tribute','Anchor','First Girl On The Moon'].map(title=>mockCatalog.find(t=>t.title===title)).filter(Boolean)
      : mockCatalog.slice(4,16);
    return Promise.resolve({stdout:JSON.stringify({songs}),parsed:{songs}});
  }
  if(args[0]==='recommend'&&args[1]==='fm') return Promise.resolve({stdout:JSON.stringify({songs:mockCatalog.slice(12,20)}),parsed:{songs:mockCatalog.slice(12,20)}});
  if(args[0]==='recommend'&&args[1]==='daily') return Promise.resolve({stdout:JSON.stringify({songs:mockCatalog.slice(8)}),parsed:{songs:mockCatalog.slice(8)}});
  if(args[0]==='queue'&&args[1]==='add'){
    const enc=valueAfter(args,'--encrypted-id'); const track=mockCatalog.find(t=>t.encryptedId===enc); if(track){ if(args.includes('--next'))mockState.queue.splice(mockState.index+1,0,track); else mockState.queue.push(track); }
    return Promise.resolve({stdout:'{"success":true}',parsed:{success:true}});
  }
  if(args[0]==='queue') return Promise.resolve({stdout:JSON.stringify({queue:mockState.queue.map((t,i)=>({index:i+1,current:i===mockState.index,label:`${t.title} - ${t.artist}`}))}),parsed:{queue:mockState.queue.map((t,i)=>({index:i+1,current:i===mockState.index,label:`${t.title} - ${t.artist}`}))}});
  if(args[0]==='next'){mockState.index=Math.min(mockState.index+1,mockState.queue.length-1);return Promise.resolve({stdout:'ok',parsed:{success:true}});}
  if(args[0]==='prev'){mockState.index=Math.max(0,mockState.index-1);return Promise.resolve({stdout:'ok',parsed:{success:true}});}
  return Promise.resolve({stdout:'{}',parsed:{}});
}

function walk(obj,fn,depth=0){ if(depth>9||obj==null)return null; const direct=fn(obj); if(direct)return direct; if(Array.isArray(obj)){for(const v of obj){const r=walk(v,fn,depth+1);if(r)return r;}} else if(typeof obj==='object'){for(const v of Object.values(obj)){const r=walk(v,fn,depth+1);if(r)return r;}} return null; }
function collect(obj,fn,out=[],depth=0){ if(depth>9||obj==null)return out; const val=fn(obj); if(val)out.push(val); if(Array.isArray(obj))obj.forEach(v=>collect(v,fn,out,depth+1)); else if(typeof obj==='object')Object.values(obj).forEach(v=>collect(v,fn,out,depth+1)); return out; }
function firstString(...vals){ for(const v of vals){ if(typeof v==='string'&&v.trim())return v.trim(); } return ''; }
function artistText(node){
  let a=node.artist||node.artistName||node.singer||node.author;
  if(Array.isArray(a))a=a.map(x=>typeof x==='string'?x:x?.name).filter(Boolean).join(' / ');
  if(!a&&Array.isArray(node.artists))a=node.artists.map(x=>x?.name||x).filter(Boolean).join(' / ');
  if(!a&&Array.isArray(node.ar))a=node.ar.map(x=>x?.name||x).filter(Boolean).join(' / ');
  return typeof a==='string'?a:'';
}
function normalizeTrack(node){
  if(!node||typeof node!=='object'||Array.isArray(node))return null;
  const title=firstString(node.title,node.name,node.songName,node.trackName);
  const artist=artistText(node);
  if(!title||!artist)return null;
  // ncm-cli 官方返回中常见结构：songId=32位加密ID，originalId=数字明文ID。
  // 不要把 songId 当成 originalId；否则搜索其实成功了，也会被 isPlayable 过滤掉。
  const songIdRaw=node.songId??node.trackId??'';
  const idRaw=node.id??'';
  const originalId=firstString(
    node.originalId==null?'':String(node.originalId),
    node.originalID==null?'':String(node.originalID),
    node.rawId==null?'':String(node.rawId),
    /^\d+$/.test(String(idRaw))?String(idRaw):'',
    /^\d+$/.test(String(songIdRaw))?String(songIdRaw):''
  );
  const encryptedId=firstString(
    node.encryptedId,node.encryptedID,node.encryptId,node.encryptedSongId,node.songEncryptedId,
    /^[0-9a-f]{32}$/i.test(String(songIdRaw))?String(songIdRaw):'',
    /^[0-9a-f]{32}$/i.test(String(idRaw))?String(idRaw):''
  );
  const album=typeof node.album==='string'?node.album:firstString(node.album?.name,node.al?.name,node.albumName);
  const coverUrl=firstString(node.coverUrl,node.coverImgUrl,node.picUrl,node.album?.picUrl,node.al?.picUrl,node.cover);
  let tags=node.songTag||node.tags||node.tag||[]; if(typeof tags==='string')tags=tags.split(/[,/|、\s]+/).filter(Boolean); if(!Array.isArray(tags))tags=[];
  return { title:String(title), artist:String(artist), album:String(album||''), coverUrl:String(coverUrl||''), tags:tags.map(String), originalId:String(originalId||''), encryptedId:String(encryptedId||''), visible:node.visible!==false, plLevel:String(node.plLevel||node.playLevel||node.level||''), freeTrailFlag:node.freeTrailFlag===true };
}
function isPlayable(t){ return Boolean(t&&t.visible!==false&&String(t.plLevel).toLowerCase()!=='none'&&t.freeTrailFlag!==true&&t.encryptedId&&t.originalId); }
function dedupe(items){ const seen=new Set(); return items.filter(t=>{const k=t.encryptedId||`${t.artist.toLowerCase()}::${t.title.toLowerCase()}`; if(seen.has(k))return false;seen.add(k);return true;}); }
function keyFor(t){return `${String(t.artist||'').toLowerCase()}::${String(t.title||'').toLowerCase()}`;}
function sameTrack(a,b){return a&&b&&keyFor(a)===keyFor(b);}

const nowCache={ key:'', artwork:'', artworkMime:'image/jpeg', album:'', polledAt:0, state:null };
function cleanNowValue(v){
  let s=String(v??'').trim().replace(/^["']|["']$/g,'').trim();
  if(!s||/^(null|nil|undefined|none|n\/a)$/i.test(s))return '';
  return s;
}
async function legacyNowProp(prop,timeout=4500){
  const r=await runLegacyNow(['get',prop],timeout);
  let s=String(r.stdout||'').trim();
  try{
    const p=JSON.parse(s);
    if(typeof p==='string')return cleanNowValue(p);
    if(p&&typeof p==='object')return cleanNowValue(p[prop]??p.value??'');
  }catch{}
  s=s.replace(new RegExp(`^${prop}\\s*[:=]\\s*`,'i'),'');
  return cleanNowValue(s);
}
async function legacyNowSnapshot(){
  try{
    const r=await runLegacyNow(['get','title','artist','album','duration','elapsedTime','playbackRate','uniqueIdentifier'],5000);
    const lines=String(r.stdout||'').split(/\r?\n/).map(cleanNowValue);
    return {
      title:lines[0]||'', artist:lines[1]||'', album:lines[2]||'',
      duration:Number(lines[3])||0, elapsedTime:Number(lines[4])||0,
      playbackRate:Number(lines[5])||0, uniqueIdentifier:lines[6]||'', detector:'nowplaying-cli-fallback'
    };
  }catch{
    const [title,artist,album,duration,elapsedTime,playbackRate,uniqueIdentifier]=await Promise.all([
      legacyNowProp('title'),legacyNowProp('artist'),legacyNowProp('album').catch(()=>''),legacyNowProp('duration').catch(()=>''),
      legacyNowProp('elapsedTime').catch(()=>''),legacyNowProp('playbackRate').catch(()=>''),legacyNowProp('uniqueIdentifier').catch(()=>''),
    ]);
    return {title,artist,album,duration:Number(duration)||0,elapsedTime:Number(elapsedTime)||0,playbackRate:Number(playbackRate)||0,uniqueIdentifier,detector:'nowplaying-cli-fallback'};
  }
}
async function nowSnapshot(){
  let systemError='';
  try{
    const payload=await runSystemNowPlaying(4500);
    const t=payload.track||{};
    return {
      title:cleanNowValue(t.title), artist:cleanNowValue(t.artist), album:cleanNowValue(t.album),
      duration:Number(t.duration)||0, elapsedTime:Number(t.elapsedTime)||0,
      playbackRate:Number(t.playbackRate)||0, uniqueIdentifier:cleanNowValue(t.uniqueIdentifier),
      detector:String(payload.detector||'system-jxa'), appName:cleanNowValue(payload.appName)
    };
  }catch(e){ systemError=e.message; }
  try{ return await legacyNowSnapshot(); }
  catch(e){ throw new Error(`macOS 系统媒体接口不可用${systemError?`（${systemError}）`:''}${e?.message?`；兼容回退也不可用（${e.message}）`:''}`); }
}
let catalogHydrateSeq=0;
function hydrateCatalogAsync(trackKey,baseTrack){
  const seq=++catalogHydrateSeq;
  const cached=trackCache[trackKey]||{};
  if(cached.coverUrl&&cached.originalId&&cached.encryptedId)return;
  searchExact(baseTrack).then(full=>{
    if(seq!==catalogHydrateSeq||nowCache.key!==trackKey)return;
    const latest=trackCache[trackKey]||full||{};
    if(nowCache.state?.track&&keyFor(nowCache.state.track)===trackKey){
      nowCache.state={...nowCache.state,track:{...nowCache.state.track,...latest,title:nowCache.state.track.title,artist:nowCache.state.track.artist}};
    }
  }).catch(()=>{});
}

async function currentState({ force=false }={}){
  if(MOCK){ const t=mockState.queue[mockState.index]||mockCatalog[0]; return {connected:true,mock:true,detector:'mock',track:{...t,artworkData:''},freshness:'fresh'}; }
  const now=Date.now();
  if(!force && now-nowCache.polledAt<1100 && nowCache.state)return nowCache.state;
  let title='',artist='',album='',duration=0,elapsedTime=0,playbackRate=0,uniqueIdentifier='',detector='system-jxa';
  try{ ({title,artist,album,duration,elapsedTime,playbackRate,uniqueIdentifier,detector}=await nowSnapshot()); }
  catch(e){
    const fallback=mediaMemory.fallback(now);
    if(fallback.track){
      const state={connected:true,mock:false,detector:detector||'system-jxa',track:fallback.track,stale:true,freshness:'last-good',warning:'macOS Now Playing 暂时不可用，继续使用上一条已确认媒体。'};
      nowCache.state=state; nowCache.polledAt=now; return state;
    }
    return {connected:true,mock:false,detector:'unavailable',track:null,error:'macOS 系统媒体接口当前不可用。请运行 Support/Diagnose.command 查看详情。',detail:e.message};
  }
  if(!title||!artist){
    // MediaRemote can return an empty snapshot for minutes after a Side Panel
    // lifecycle change. An empty read is not evidence that playback stopped.
    // Keep the Bridge-owned last-good track so closing/reopening the panel does
    // not erase the user's current musical context.
    const fallback=mediaMemory.fallback(now);
    if(fallback.track){
      const state={connected:true,mock:false,detector:detector||'system-jxa',track:fallback.track,stale:true,freshness:'last-good',warning:'macOS Now Playing 暂未返回完整字段，继续显示上一条已确认媒体。'};
      nowCache.state=state; nowCache.polledAt=now; return state;
    }
    const state={connected:true,mock:false,detector:detector||'system-jxa',track:null,stale:true,freshness:'none',error:`macOS 当前媒体信息不完整（title=${title||'∅'}, artist=${artist||'∅'}）。请确保网易云 Mac 客户端正在播放音乐。`};
    nowCache.state=state; nowCache.polledAt=now; return state;
  }
  const k=`${artist.toLowerCase()}::${title.toLowerCase()}`;
  if(k!==nowCache.key){
    nowCache.key=k; nowCache.artwork=''; nowCache.album=album||'';
    // The system JXA adapter deliberately avoids binary/private helper assets.
    // Enrich artwork/catalog IDs asynchronously from NetEase instead of blocking playback truth.
    hydrateCatalogAsync(k,{title,artist,album});
  } else if(album) nowCache.album=album;
  const cached=trackCache[k]||{};
  const track={title,artist,album:nowCache.album||cached.album||'',coverUrl:cached.coverUrl||'',artworkData:nowCache.artwork||'',artworkMime:nowCache.artworkMime||'image/jpeg',originalId:cached.originalId||'',encryptedId:cached.encryptedId||'',visible:true,plLevel:cached.plLevel||'',freeTrailFlag:false,tags:cached.tags||[],duration,elapsedTime,playbackRate,uniqueIdentifier,catalogResolved:Boolean(cached.originalId||cached.encryptedId),catalogPlayable:cached.catalogPlayable===true};
  mediaMemory.accept(track,now);
  const state={connected:true,mock:false,detector:detector||'system-jxa',track,stale:false,freshness:'fresh'};
  nowCache.state=state; nowCache.polledAt=now; return state;
}

function canonMatchText(value){
  return String(value||'').normalize('NFKC').toLowerCase()
    .replace(/[“”‘’"'`·・•]/g,'')
    .replace(/[，、,。.!！？?：:；;（）()\[\]【】《》<>—–_\/\\|+-]+/g,' ')
    .replace(/\s+/g,' ').trim();
}
async function searchExact(track){
  const k=keyFor(track); const cached=trackCache[k];
  if(cached?.encryptedId||cached?.originalId)return {...track,...cached,catalogResolved:true,catalogPlayable:isPlayable(cached)};
  const a=canonMatchText(track.artist),t=canonMatchText(track.title),al=canonMatchText(track.album);
  function score(x){
    let s=0; const xa=canonMatchText(x.artist),xt=canonMatchText(x.title),xal=canonMatchText(x.album);
    if(xa===a)s+=12;else if(xa&&a&&(xa.includes(a)||a.includes(xa)))s+=8;
    if(xt===t)s+=16;else if(xt&&t&&(xt.includes(t)||t.includes(xt)))s+=10;
    if(al&&xal){if(xal===al)s+=4;else if(xal.includes(al)||al.includes(xal))s+=2;}
    return s;
  }
  const queries=[`${track.artist} ${track.title}`,`${track.title} ${track.artist}`,track.title];
  let best=null,bestScore=-1,lastError='';
  for(const q of queries){
    try{
      const r=await runNcm(['search','song','--keyword',q,'--userInput',`识别当前歌曲 ${track.artist} ${track.title}`],15000);
      // Anchor identity and candidate playability are different concerns. The song
      // is already playing in the desktop app, so an Open Platform visibility or
      // plLevel flag must never block the Session from starting.
      const tracks=dedupe(collect(r.parsed,normalizeTrack).filter(Boolean));
      for(const x of tracks){const sc=score(x);if(sc>bestScore){best=x;bestScore=sc;}}
      if(best&&bestScore>=24)break;
    }catch(e){lastError=e.message;}
  }
  if(!best||bestScore<10){
    console.warn(`[anchor catalog] metadata-only anchor: ${track.artist} — ${track.title}${lastError?` (${lastError})`:''}`);
    return {...track,catalogResolved:false,catalogPlayable:false};
  }
  const resolved={...best,catalogResolved:true,catalogPlayable:isPlayable(best)};
  trackCache[k]=resolved; saveCache(); return {...track,...resolved};
}

function encryptedPlaylistId(parsed){
  const directKeys=['playlistId','playlistID','favoritePlaylistId','playlistEncryptedId','encryptedPlaylistId'];
  const direct=walk(parsed,node=>{ if(!node||typeof node!=='object'||Array.isArray(node))return null; for(const k of directKeys){const v=node[k];if(typeof v==='string'&&/^[0-9a-f]{32}$/i.test(v))return v;} return null; }); if(direct)return direct;
  const named=walk(parsed,node=>{ if(!node||typeof node!=='object'||Array.isArray(node))return null; const name=String(node.name||node.title||''); const id=String(node.encryptedId||node.encryptId||node.id||''); if(/喜欢的音乐|红心|favorite|liked/i.test(name)&&/^[0-9a-f]{32}$/i.test(id))return id; return null; }); if(named)return named;
  const playlistObj=walk(parsed,node=>{ if(!node||typeof node!=='object'||Array.isArray(node))return null; const p=node.playlist; if(p&&typeof p==='object'){const id=String(p.encryptedId||p.encryptId||p.id||''); if(/^[0-9a-f]{32}$/i.test(id))return id;} return null; });
  return playlistObj||'';
}
const tasteMemory={favoriteKeys:new Set(),historyKeys:new Set(),historyAt:0};
function rememberTasteTracks(items,target){
  for(const t of dedupe(collect(items,normalizeTrack).filter(Boolean)))target.add(t.encryptedId||keyFor(t));
}
let favoriteCache={id:'',at:0};
async function getFavoritePlaylistId(){
  if(favoriteCache.id&&Date.now()-favoriteCache.at<6*3600e3)return favoriteCache.id;
  const r=await runNcm(['user','favorite','--userInput','获取红心歌单用于当前听歌 Session 的候选召回'],18000);
  const id=encryptedPlaylistId(r.parsed); if(!id)throw new Error('未能从 user favorite 解析红心歌单 ID；可先用 ncm-cli user favorite 检查返回结构。');
  rememberTasteTracks(r.parsed,tasteMemory.favoriteKeys);
  favoriteCache={id,at:Date.now()}; return id;
}
async function refreshHistoryMemory(){
  if(Date.now()-tasteMemory.historyAt<30*60e3)return;
  tasteMemory.historyAt=Date.now();
  try{
    const r=await runNcm(['user','history','--userInput','读取最近播放，仅作为当前 Session 的弱个性化信号'],16000);
    const next=new Set(); rememberTasteTracks(r.parsed,next); tasteMemory.historyKeys=next;
  }catch(e){console.warn('[taste:history]',e.message);}
}
function tasteFlags(track){
  const ids=[track?.encryptedId,keyFor(track)].filter(Boolean);
  return {liked:ids.some(k=>tasteMemory.favoriteKeys.has(k)),recent:ids.some(k=>tasteMemory.historyKeys.has(k))};
}
function withTasteFlags(items){return items.map(t=>({...t,...tasteFlags(t)}));}

const lyricCache=new Map();
function lyricTextFrom(parsed){
  let text=walk(parsed,node=>{
    if(!node||typeof node!=='object'||Array.isArray(node))return null;
    if(typeof node.lyric==='string'&&node.lyric.trim())return node.lyric;
    if(node.lrc&&typeof node.lrc.lyric==='string')return node.lrc.lyric;
    return null;
  })||'';
  text=String(text).replace(/\[[^\]]{0,40}\]/g,' ').replace(/\s+/g,' ').trim();
  return text.slice(0,1400);
}
async function enrichAnchorContext(track){
  if(!track||!containsCjk(`${track.artist}${track.title}`)||!track.encryptedId)return track;
  const k=track.encryptedId||keyFor(track);
  if(lyricCache.has(k))return {...track,lyricContext:lyricCache.get(k)};
  try{
    const r=await runNcm(['song','lyric','--songId',track.encryptedId,'--userInput',`理解 ${track.artist} ${track.title} 的歌词语义，仅用于意境与叙事`],12000);
    const lyricContext=lyricTextFrom(r.parsed); lyricCache.set(k,lyricContext);
    return lyricContext?{...track,lyricContext}:track;
  }catch(e){console.warn('[anchor lyric]',e.message);return track;}
}

function tracksFrom(parsed,source,distance){ return dedupe(collect(parsed,normalizeTrack).filter(isPlayable)).map(t=>({...t,source,distance})); }

function transformationAllowed(text=''){
  const s=String(text||'');
  if(/(?:不要|别|不想|避免)[^，,。；;]{0,12}(?:纯音乐|器乐|instrumental|翻奏|翻唱|cover|tribute|karaoke)/i.test(s))return false;
  return /(?:想听|想要|来点|可以|允许|多一点|更)[^，,。；;]{0,12}(?:纯音乐|器乐|instrumental|翻奏|翻唱|cover|tribute|karaoke)|^(?:纯音乐|器乐|instrumental)$/i.test(s.trim());
}
function likelyDerivative(track){
  const hay=`${track.artist} ${track.title} ${track.album} ${(track.tags||[]).join(' ')}`.toLowerCase();
  return /(guitar tribute|tribute players|tribute to|\btribute\b|karaoke|instrumental version|instrumental cover|cover version|piano tribute|string quartet tribute|8-bit tribute|lullaby rendition|翻奏|伴奏|卡拉ok)/i.test(hay);
}
function vocalMismatch(track,analysis,stateWords=''){
  if(!analysis || transformationAllowed(stateWords) || !analysisSuggestsVocal(analysis))return false;
  const hay=`${track.artist} ${track.title} ${track.album} ${(track.tags||[]).join(' ')}`.toLowerCase();
  return /(instrumental|纯音乐|伴奏)/i.test(hay);
}
function arr(value, limit=8){ return Array.isArray(value) ? value.slice(0,limit).map(String).filter(Boolean) : []; }
function normalizeAnalysis(raw,anchor){
  const obj=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const fp=obj.fingerprint&&typeof obj.fingerprint==='object'?obj.fingerprint:{};
  const legacy=obj.traits&&typeof obj.traits==='object'?obj.traits:{};
  const dirs=Array.isArray(obj.recall_directions)?obj.recall_directions:(Array.isArray(obj.recallDirections)?obj.recallDirections:[]);
  const recallDirections=dirs.slice(0,4).map((d,i)=>({
    name:String(d?.name||`方向 ${i+1}`),
    reason:String(d?.reason||''),
    aestheticBridge:String(d?.aesthetic_bridge||d?.aestheticBridge||''),
    preserve:arr(d?.preserve,6),
    drift:arr(d?.drift,6),
    searchArtists:arr(d?.search_artists||d?.searchArtists,6),
    searchKeywords:arr(d?.search_keywords||d?.searchKeywords,6),
    targetLanguage:String(d?.target_language||d?.targetLanguage||'unknown').toLowerCase()
  })).filter(d=>d.searchArtists.length||d.searchKeywords.length);
  // Migration from v0.4.1's simpler `searches` format.
  if(!recallDirections.length && Array.isArray(obj.searches)){
    for(const [i,q] of obj.searches.slice(0,4).entries()){
      const keyword=typeof q==='string'?q:String(q?.keyword||'');
      if(keyword)recallDirections.push({name:`方向 ${i+1}`,reason:String(q?.reason||''),preserve:[],drift:[],searchArtists:[keyword],searchKeywords:[],targetLanguage:'unknown'});
    }
  }
  const fingerprint={
    vocal_identity:arr(fp.vocal_identity || (legacy.vocal?[legacy.vocal]:[]),8),
    emotional_core:arr(fp.emotional_core || legacy.mood,8),
    imagery:arr(fp.imagery,8),
    rhythm_motion:arr(fp.rhythm_motion,8),
    dynamics:arr(fp.dynamics,8),
    instrumentation_texture:arr(fp.instrumentation_texture || legacy.texture,8),
    melody_harmony:arr(fp.melody_harmony,8),
    narrative:arr(fp.narrative,8),
    must_preserve:arr(fp.must_preserve || legacy.invariants,6),
    can_drift:arr(fp.can_drift,8)
  };
  const langRaw=obj.anchor_language||obj.anchorLanguage||{};
  const anchorLanguage={
    code:String(langRaw?.code||langRaw?.language||'unknown').toLowerCase(),
    confidence:String(langRaw?.confidence||'low').toLowerCase(),
    reason:String(langRaw?.reason||'')
  };
  const aesRaw=obj.aesthetic&&typeof obj.aesthetic==='object'?obj.aesthetic:{};
  const aesthetic={
    why_it_stops_you:String(aesRaw.why_it_stops_you||aesRaw.whyItStopsYou||''),
    human_state:arr(aesRaw.human_state||aesRaw.humanState,6),
    tension:arr(aesRaw.tension,6),
    world:String(aesRaw.world||''),
    unspoken:String(aesRaw.unspoken||''),
    avoid_reductions:arr(aesRaw.avoid_reductions||aesRaw.avoidReductions,6),
    surprise_axes:arr(aesRaw.surprise_axes||aesRaw.surpriseAxes,6)
  };
  return {
    summary:String(obj.summary||`${anchor.artist} — ${anchor.title}`),
    anchorLanguage,
    aesthetic,
    fingerprint,
    recallDirections,
    avoidTransforms:arr(obj.avoid_transforms||obj.avoidTransforms,8).length?arr(obj.avoid_transforms||obj.avoidTransforms,8):['tribute','karaoke','instrumental reinterpretation']
  };
}
function analysisSuggestsVocal(analysis){
  const text=(analysis?.fingerprint?.vocal_identity||[]).join(' ').toLowerCase();
  if(/instrumental|纯器乐|无人声/.test(text)&&!/vocal|人声|主唱|合唱|男女/.test(text))return false;
  return /vocal|人声|男声|女声|主唱|合唱|男女|真声|假声|混声|气声|和声/.test(text);
}
function recallQueries(analysis,radius,maxOverride=null){
  const max=Number(maxOverride)|| (radius<=25?4:radius<=65?6:8);
  const out=[]; const seen=new Set();
  for(const d of analysis?.recallDirections||[]){
    const terms=[...(d.searchArtists||[]),...(d.searchKeywords||[])];
    for(const term of terms){
      const keyword=String(term||'').trim(); if(!keyword)continue;
      const key=keyword.toLowerCase(); if(seen.has(key))continue;
      seen.add(key); out.push({keyword,reason:[d.aestheticBridge,d.reason,d.name].filter(Boolean).join('；')});
      if(out.length>=max)return out;
    }
  }
  return out;
}
async function analyzeAnchor(anchor,radius=35,instruction='',force=false){
  const bucket=radius<=25?'near':radius<=65?'mid':'far';
  const contextKey=`v3-listening-judgment::${keyFor(anchor)}::${bucket}::${String(instruction||'').toLowerCase().trim()}`;
  if(!force&&analysisCache[contextKey])return analysisCache[contextKey];
  if(!config.ai.apiKey){
    const fallback=normalizeAnalysis({
      summary:`${anchor.artist} — ${anchor.title}`,
      fingerprint:{
        vocal_identity:[],
        emotional_core:anchor.tags||[],
        must_preserve:['保持原曲主要演唱/器乐形态','避免明显 tribute / karaoke 版本'],
        can_drift:[]
      },
      recall_directions:[]
    },anchor);
    analysisCache[contextKey]=fallback; saveAnalysisCache(); return fallback;
  }
  try{
    const content=await callAI(ANALYSIS_SYSTEM,buildAnchorAnalysisPrompt({anchor,radius,instruction}));
    const parsed=looseParse(content);
    const analysis=normalizeAnalysis(parsed,anchor);
    analysisCache[contextKey]=analysis; saveAnalysisCache(); return analysis;
  }catch(e){
    console.warn('[anchor analysis fallback]',e.message);
    return normalizeAnalysis({
      summary:`${anchor.artist} — ${anchor.title}`,
      fingerprint:{vocal_identity:[],emotional_core:anchor.tags||[],must_preserve:['保持原曲主要演唱/器乐形态','避免明显 tribute / karaoke 版本'],can_drift:[]},
      recall_directions:[]
    },anchor);
  }
}
async function recallSemantic(analysis,radius,maxQueries=null){
  const searches=recallQueries(analysis,radius,maxQueries);
  const jobs=searches.map(async(q,idx)=>{
    const r=await runNcm(['search','song','--keyword',q.keyword,'--userInput',`当前 Session 语义召回：${q.keyword}。${q.reason||''}`],15000);
    return tracksFrom(r.parsed,'semantic-search',24+idx*7).slice(0,10).map(t=>({...t,semanticReason:q.reason||''}));
  });
  const results=await Promise.all(jobs.map(p=>p.catch(e=>{console.warn('[recall:semantic]',e.message);return [];})));
  return dedupe(results.flat());
}
async function recallSameArtist(anchor){
  const r=await runNcm(['search','song','--keyword',anchor.artist,'--userInput',`围绕 ${anchor.artist} 保持较近的当前听歌边界`],15000);
  return tracksFrom(r.parsed,'same-artist',8).filter(t=>t.artist.toLowerCase().includes(anchor.artist.toLowerCase())||anchor.artist.toLowerCase().includes(t.artist.toLowerCase()));
}
async function recallHeartbeat(anchor){
  const playlistId=await getFavoritePlaylistId();
  const r=await runNcm(['recommend','heartbeat','--playlistId',playlistId,'--songId',anchor.encryptedId,'--count','40','--userInput',`围绕 ${anchor.artist} ${anchor.title} 获取心动候选，本轮仅作为召回池`],18000);
  return tracksFrom(r.parsed,'heartbeat',50);
}
async function recallFm(){ const r=await runNcm(['recommend','fm','--userInput','为当前听歌 Session 补充少量更远候选'],16000); return tracksFrom(r.parsed,'fm',62); }
async function recallDaily(){ const r=await runNcm(['recommend','daily','--userInput','为高探索半径补充少量意外候选'],16000); return tracksFrom(r.parsed,'daily',78); }

async function recallPool(anchor,radius,analysis,constraints={excludedLanguages:[]}){
  // Recall breadth and perceptual radius are different controls. A hard user
  // constraint may require looking in a broader catalog region while the final
  // ranking still enforces the same perceptual radius.
  const jobs=[];
  if(!sameArtistConflictsWithConstraints(anchor,analysis,constraints))jobs.push(['sameArtist',()=>recallSameArtist(anchor)]);
  if(recallQueries(analysis,radius).length)jobs.push(['semantic',()=>recallSemantic(analysis,radius)]);
  if(anchor.encryptedId)jobs.push(['heartbeat',()=>recallHeartbeat(anchor)]);
  if(radius>=52||constraints.excludedLanguages.length)jobs.push(['fm',()=>recallFm()]);
  if(radius>=78)jobs.push(['daily',()=>recallDaily()]);
  const results=await Promise.all(jobs.map(async([name,fn])=>{try{return [name,await fn(),null];}catch(e){console.warn(`[recall:${name}] ${e.message}`);return [name,[],e.message];}}));
  const meta={}; const all=[]; for(const [name,items,error] of results){meta[name]={count:items.length,error:error||null};all.push(...items);} return {items:withTasteFlags(dedupe(all).filter(t=>!sameTrack(t,anchor))),meta};
}

function containsCjk(s){return /[\u3400-\u9fff]/.test(String(s||''));}
function tokenize(s){return String(s||'').toLowerCase().split(/[\s,，、/|;；]+/).filter(Boolean);}
function parseSessionConstraints(stateWords='',excludes=''){
  const raw=`${stateWords} ${excludes}`.trim();
  const excludedLanguages=[];
  const zhNegative=/(?:不要|别|不想(?:听)?|避免|排除)[^，,。；;\n]{0,10}(?:华语|中文(?:歌|歌曲|音乐)?|国语|普通话|粤语|mandopop|cantopop|c-pop)/i.test(raw)
    || /(?:华语|中文(?:歌|歌曲|音乐)?|国语|普通话|粤语|mandopop|cantopop|c-pop)[^，,。；;\n]{0,8}(?:不要|排除|避免)/i.test(raw);
  if(zhNegative)excludedLanguages.push('zh');
  return {raw,excludedLanguages};
}
function hasKana(s){return /[\u3040-\u30ff]/.test(String(s||''));}
function hasHangul(s){return /[\uac00-\ud7af]/.test(String(s||''));}
function metadataLanguageHint(track){
  const hay=`${track?.artist||''} ${track?.title||''} ${track?.album||''} ${(track?.tags||[]).join(' ')}`;
  if(/mandopop|cantopop|c-pop|华语|国语|普通话|粤语|中文歌/i.test(hay))return {code:'zh',confidence:'high'};
  if(hasKana(hay))return {code:'ja',confidence:'high'};
  if(hasHangul(hay))return {code:'ko',confidence:'high'};
  return {code:'unknown',confidence:'low'};
}
function languageBlocked(code,constraints){return Boolean(code&&constraints?.excludedLanguages?.includes(String(code).toLowerCase()));}
function rowLanguageBlocked(row,track,constraints){
  if(!constraints?.excludedLanguages?.length)return false;
  const code=String(row?.language||row?.language_code||'unknown').toLowerCase();
  const confidence=String(row?.language_confidence||row?.languageConfidence||'low').toLowerCase();
  if(languageBlocked(code,constraints)&&confidence!=='low')return true;
  const hint=metadataLanguageHint(track);
  return languageBlocked(hint.code,constraints)&&hint.confidence==='high';
}
function localLanguageBlocked(track,constraints){
  if(!constraints?.excludedLanguages?.length)return false;
  const hint=metadataLanguageHint(track);
  return languageBlocked(hint.code,constraints)&&hint.confidence==='high';
}
function sameArtistConflictsWithConstraints(anchor,analysis,constraints){
  if(!constraints?.excludedLanguages?.length)return false;
  const code=String(analysis?.anchorLanguage?.code||'unknown').toLowerCase();
  const confidence=String(analysis?.anchorLanguage?.confidence||'low').toLowerCase();
  if(languageBlocked(code,constraints)&&confidence!=='low')return true;
  const text=`${anchor?.artist||''} ${anchor?.title||''}`;
  // Conservative recall choice only: a Han-script anchor with no kana/hangul is
  // likely to violate an explicit “不要华语” request. This does NOT classify
  // Japanese/Korean candidates as Chinese; candidate language is judged later.
  if(constraints.excludedLanguages.includes('zh')&&containsCjk(text)&&!hasKana(text)&&!hasHangul(text))return true;
  return false;
}
function constraintPrompt(constraints){
  if(!constraints?.excludedLanguages?.length)return '';
  const labels=constraints.excludedLanguages.map(x=>x==='zh'?'中文演唱/华语':x).join('、');
  return `硬约束：不要 ${labels}。召回方向必须从源头跨到允许的语言空间，不能只靠最后过滤。`;
}
function negativeFromInstruction(text=''){
  const s=String(text||''); const out=[];
  const re=/(?:不要|别|不想听?|避免)\s*([^，,。；;\n]+)/g; let m;
  while((m=re.exec(s)))out.push(...String(m[1]||'').split(/[、/\s]+/).filter(Boolean));
  return out.join(' ');
}
function effectiveExcludes(stateWords='',excludes=''){return [excludes,negativeFromInstruction(stateWords)].filter(Boolean).join(' ').trim();}
function exclusionHit(track,excludes){
  const words=tokenize(excludes); if(!words.length)return false; const hay=`${track.title} ${track.artist} ${track.album} ${(track.tags||[]).join(' ')}`.toLowerCase();
  for(const w of words){
    if(['edm','电子'].includes(w)&&/(edm|electronic|house|techno|电子)/i.test(hay))return true;
    if(['太欢快','欢快','快乐'].includes(w)&&/(happy|upbeat|欢快|快乐|活力)/i.test(hay))return true;
    if(w.length>1&&hay.includes(w))return true;
  }
  return false;
}
function profileDistance(track,anchor){
  const p=profileFor(anchor.artist); if(!p)return track.distance;
  const a=track.artist.toLowerCase();
  if(a.includes(anchor.artist.toLowerCase())||anchor.artist.toLowerCase().includes(a))return 6;
  if(p.closeArtists.some(x=>a.includes(x.toLowerCase())||x.toLowerCase().includes(a)))return Math.min(track.distance,24);
  if(p.farArtists.some(x=>a.includes(x.toLowerCase())||x.toLowerCase().includes(a)))return Math.max(track.distance,55);
  return track.distance;
}
function coarseWorldBreak(track,analysis,radius){
  if(radius>45)return false;
  const anchorText=JSON.stringify(analysis?.fingerprint||{}).toLowerCase();
  const candidateText=`${track.artist} ${track.title} ${track.album} ${(track.tags||[]).join(' ')}`.toLowerCase();
  const anchorOrganic=/(acoustic|原声|folk|民谣|木吉他|organic)/i.test(anchorText);
  const candidateDance=/(dance|edm|four-on-the-floor|house|techno|trance|festival|电子舞曲)/i.test(candidateText);
  const anchorVocal=analysisSuggestsVocal(analysis);
  const candidateInstrumental=/(instrumental|纯音乐|伴奏)/i.test(candidateText);
  if(anchorOrganic&&candidateDance)return true;
  if(anchorVocal&&candidateInstrumental&&!transformationAllowed(candidateText))return true;
  return false;
}
function eligibleByFormat(track,analysis,stateWords='',excludes=''){
  const userText=`${stateWords} ${excludes}`;
  if(!transformationAllowed(userText)&&likelyDerivative(track))return false;
  if(vocalMismatch(track,analysis,userText))return false;
  return true;
}
function diversify(items,anchor,limit=Math.max(config.queueSize,6),radius=session.radius){
  const out=[]; const counts=new Map(); const albumCounts=new Map(); const seenTracks=new Set();
  const anchorArtist=String(anchor.artist||'').toLowerCase();
  const delayedAnchor=[];
  function tryPush(t){
    const trackKey=t.encryptedId||keyFor(t); if(seenTracks.has(trackKey))return false;
    const artist=String(t.artist||'').toLowerCase();
    const isAnchorArtist=artist===anchorArtist;
    const cap=isAnchorArtist?(Number(radius)<=18?2:1):1;
    if((counts.get(artist)||0)>=cap)return false;
    const album=String(t.album||'').trim().toLowerCase();
    const albumKey=album?`${artist}::${album}`:'';
    if(albumKey&&(albumCounts.get(albumKey)||0)>=1)return false;
    out.push(t); seenTracks.add(trackKey); counts.set(artist,(counts.get(artist)||0)+1);
    if(albumKey)albumCounts.set(albumKey,(albumCounts.get(albumKey)||0)+1);
    return true;
  }
  for(const t of items){
    const isAnchorArtist=String(t.artist||'').toLowerCase()===anchorArtist;
    // At normal exploration distances, same-artist tracks are a safety net, not
    // the product value. Do not let them occupy the first three positions.
    if(Number(radius)>18&&isAnchorArtist&&out.length<3){delayedAnchor.push(t);continue;}
    tryPush(t);
    if(out.length>=limit)break;
  }
  if(out.length<limit){
    for(const t of delayedAnchor){if(out.length>=limit)break;tryPush(t);}
  }
  return out;
}
function localRank(pool,anchor,radius,stateWords,excludes,analysis,constraints={excludedLanguages:[]}){
  const neg=new Set(session.negativeArtists.map(x=>x.toLowerCase())); const pos=new Set(session.positiveArtists.map(x=>x.toLowerCase())); const profile=profileFor(anchor.artist);
  let items=pool.filter(t=>!neg.has(t.artist.toLowerCase())&&!exclusionHit(t,excludes)&&!localLanguageBlocked(t,constraints)&&eligibleByFormat(t,analysis,stateWords,excludes)&&!coarseWorldBreak(t,analysis,radius)).map((t,i)=>{
    const distance=profileDistance(t,anchor); let score=100-Math.max(0,distance-radius)*1.4-distance*.25;
    if(pos.has(t.artist.toLowerCase()))score+=18; if(distance<=radius)score+=10; if(t.liked)score+=3; else if(t.recent)score+=1; if(t.source==='heartbeat')score+=6; if(t.source==='semantic-search')score+=12; if(t.source==='same-artist'&&radius<=18)score+=10; else if(t.source==='same-artist'&&radius>18)score-=8;
    const text=`${(t.tags||[]).join(' ')} ${t.artist} ${t.album}`.toLowerCase(); for(const w of tokenize(stateWords)){if(w.length>1&&text.includes(w))score+=4;}
    score+=(i%5)*0.17;
    let reason='和起点仍有清楚的听感连续性'; if(t.source==='same-artist')reason='保留起点熟悉的声音与表达方式'; else if(t.source==='heartbeat')reason='情绪与听感仍能自然接在这一轮后面'; else if(t.source==='semantic-search')reason=t.semanticReason||'沿着起点的声音气质继续展开'; else if(t.source==='fm')reason='稍微走远一点，但核心气质仍然连着'; else if(t.source==='daily')reason='更意外的一步，仍保留这一轮的核心感受';
    if(profile&&profile.closeArtists.some(x=>t.artist.toLowerCase().includes(x.toLowerCase())))reason='和起点处在相近的声音世界';
    return {...t,distance,score,reason};
  });
  items.sort((a,b)=>b.score-a.score);
  // Local fallback has no true acoustic/perceptual model. Prefer AI-guided
  // semantic searches over Heartbeat, and treat Heartbeat as uncertain recall —
  // never as proof that a song is perceptually close.
  const same=items.filter(t=>t.source==='same-artist');
  const semantic=items.filter(t=>t.source==='semantic-search');
  const hb=items.filter(t=>t.source==='heartbeat');
  const fm=items.filter(t=>t.source==='fm');
  const daily=items.filter(t=>t.source==='daily');
  const quotas=radius<=22?[2,2,1,0,0]:radius<=45?[1,3,1,0,0]:radius<=70?[1,2,1,1,0]:[1,2,1,1,1];
  const picks=[]; [[same,quotas[0]],[semantic,quotas[1]],[hb,quotas[2]],[fm,quotas[3]],[daily,quotas[4]]].forEach(([bucket,n])=>{for(const t of bucket.slice(0,n))if(!picks.some(x=>x.encryptedId===t.encryptedId))picks.push(t);});
  for(const t of items){if(picks.length>=Math.max(config.queueSize,6))break;if(!picks.some(x=>x.encryptedId===t.encryptedId))picks.push(t);}
  return diversify(picks.concat(items),anchor,Math.max(config.queueSize,6));
}


// AI providers are isolated behind bridge/providers/*. The Session engine never
// needs to know whether a user chose Anthropic, OpenAI, DeepSeek, OpenRouter,
// a compatible gateway, or no AI at all.
async function discoverAI(force=false){ return aiProvider.discover(force); }
function aiView(){ return aiProvider.view(); }
async function callAI(system,prompt){ return aiProvider.complete(system,prompt); }

function clamp01(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):null;}
function rankingWorldBreak(row,radius){
  const breaks=Array.isArray(row?.world_breaks)?row.world_breaks.filter(Boolean):[];
  const c=row?.continuity&&typeof row.continuity==='object'?row.continuity:{};
  const core=['vocal','timbre','instrumentation_texture','rhythm_motion'].map(k=>clamp01(c[k])).filter(v=>v!=null);
  const veryLow=core.filter(v=>v<0.34).length;
  if(radius<=45 && breaks.length>0)return true;
  if(radius<=45 && veryLow>0)return true;
  if(radius<=65 && breaks.length>=2)return true;
  if(radius<=65 && veryLow>=2)return true;
  return false;
}

function publicReason(reason,fallback='和起点仍有清楚的听感连续性'){
  const raw=String(reason||'').trim();
  if(!raw)return fallback;
  if(/网易云|召回|重排|候选池|ranking|rank|provider|模型|AI/i.test(raw))return fallback;
  return raw;
}

async function aiRank(pool,anchor,radius,stateWords,excludes,analysis,constraints={excludedLanguages:[]}){
  if(!config.ai.apiKey)return null;
  const eligible=pool.filter(t=>eligibleByFormat(t,analysis,stateWords,excludes)&&!exclusionHit(t,excludes));
  const candidates=eligible.slice(0,48);
  if(!candidates.length)return null;
  const instruction=[stateWords,excludes?`不要：${excludes}`:'',constraintPrompt(constraints)].filter(Boolean).join('；');
  const recentPath=[
    ...session.history.slice(-4).map(t=>({...t,pathState:'played'})),
    ...(session.currentRecommendation?[{...session.currentRecommendation,pathState:'current'}]:[]),
    ...session.upcoming.slice(0,3).map(t=>({...t,pathState:'planned'}))
  ];
  const prompt=buildRankingPrompt({
    anchor,
    radius,
    instruction,
    analysis,
    candidates,
    positiveArtists:session.positiveArtists,
    negativeArtists:session.negativeArtists,
    recentPath
  });
  const content=await callAI(RANK_SYSTEM,prompt); if(!content)return null;
  const parsed=looseParse(content);
  const arr=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.ranking)?parsed.ranking:[]);
  if(!arr.length)throw new Error('AI Provider 未返回 ranking JSON 数组');
  const sequence=Array.isArray(parsed?.sequence)?parsed.sequence.map(Number).filter(Number.isFinite):[];
  const sequenceOrder=new Map(sequence.map((id,i)=>[Number(id),i]));
  const rows=[...arr].sort((a,b)=>{
    const ai=sequenceOrder.has(Number(a?.candidate_id??a?.i))?sequenceOrder.get(Number(a?.candidate_id??a?.i)):999;
    const bi=sequenceOrder.has(Number(b?.candidate_id??b?.i))?sequenceOrder.get(Number(b?.candidate_id??b?.i)):999;
    if(ai!==bi)return ai-bi;
    return (Number(b?.score)||0)-(Number(a?.score)||0);
  });
  const picked=[];
  for(const x of rows){
    const idx=Number(x.candidate_id ?? x.i);
    const t=candidates[idx];
    if(!t||picked.some(p=>p.encryptedId===t.encryptedId))continue;
    if(session.negativeArtists.some(a=>a.toLowerCase()===t.artist.toLowerCase()))continue;
    if(rowLanguageBlocked(x,t,constraints))continue;
    if(!eligibleByFormat(t,analysis,stateWords,excludes)||exclusionHit(t,excludes))continue;
    if(rankingWorldBreak(x,radius))continue;
    const confidence=String(x.confidence||'medium').toLowerCase();
    if(radius<=45 && confidence==='low')continue;
    const label=String(x.distance_from_anchor||'').toLowerCase();
    const explicit=Number(x.perceptual_distance);
    let mapped=Number.isFinite(explicit)?Math.max(0,Math.min(100,explicit)):null;
    if(mapped==null) mapped=label==='near'?24:label==='medium'?50:label==='far'?76:50;
    if(mapped>radius+10 && radius<=65)continue;
    const enriched={
      ...t,
      distance:mapped,
      reason:publicReason(x.reason,'它接住了起点没有说完的那一部分'),
      aestheticJudgment:String(x.aesthetic_judgment||x.aestheticJudgment||''),
      transitionLogic:String(x.transition_logic||x.transitionLogic||''),
      journeyRole:String(x.journey_role||x.journeyRole||'open').toLowerCase(),
      nextSongWorthiness:x.next_song_worthiness??x.nextSongWorthiness,
      meaningfulDifference:x.meaningful_difference??x.meaningfulDifference,
      surpriseValue:x.surprise_value??x.surpriseValue,
      obviousness:x.obviousness,
      clicheRisk:x.cliche_risk??x.clicheRisk,
      sequenceIndex:sequenceOrder.has(idx)?sequenceOrder.get(idx):null,
      aiScore:Number(x.score)||0,
      continuity:x.continuity||{},
      worldBreaks:Array.isArray(x.world_breaks)?x.world_breaks:[],
      confidence
    };
    if(aestheticReject(enriched,radius))continue;
    picked.push(enriched);
  }
  if(!picked.length)return null;
  const arc=composeListeningArc(picked,anchor,radius,Math.max(config.queueSize,8));
  return arc.length?diversify(arc,anchor,Math.max(config.queueSize,8)):null;
}

function guardPlaybackAfterQueue(before){
  if(MOCK||!before?.title||!before?.artist||Number(before.playbackRate)<=0)return;
  setTimeout(async()=>{
    try{
      const after=await nowSnapshot();
      const same=String(after.uniqueIdentifier||'')&&String(before.uniqueIdentifier||'')
        ? String(after.uniqueIdentifier)===String(before.uniqueIdentifier)
        : keyFor(after)===keyFor(before);
      if(same&&Number(after.playbackRate)<=0){
        // Queue mutation in Orpheus can occasionally leave the same song paused.
        // Restore only when it was playing before and the track itself did not change.
        await runNcm(['resume'],5000);
      }
    }catch(e){console.warn('[playback guard]',e.message);}
  },450).unref?.();
}
async function injectQueue(plan,{position='next',limit=config.queueSize}={}){
  const toAdd=plan.slice(0,Math.max(0,limit));
  const before=nowCache.state?.track?{...nowCache.state.track}:null;
  const ordered=position==='next'?[...toAdd].reverse():toAdd;
  for(const t of ordered){
    const args=['queue','add','--encrypted-id',t.encryptedId,'--original-id',t.originalId];
    if(position==='next')args.push('--next');
    await runNcm(args,12000);
  }
  guardPlaybackAfterQueue(before);
  return toAdd;
}

function sessionKnownKeys(){
  const tracks=[session.anchor,session.currentRecommendation,...session.upcoming,...session.reserve,...session.history].filter(Boolean);
  return new Set(tracks.map(t=>t.encryptedId||keyFor(t)));
}
function filterKnown(items){
  const known=sessionKnownKeys();
  return items.filter(t=>!known.has(t.encryptedId||keyFor(t)));
}

async function planBatch(anchor,analysis,onProgress=()=>{}, {refill=false}={}){
  const activeExcludes=effectiveExcludes(session.stateWords,session.excludes);
  const constraints=parseSessionConstraints(session.stateWords,activeExcludes);
  onProgress(refill?'refill-recall':'recall',refill?'正在补充后续':'网易云正在沿这些方向找歌',refill?35:58);
  let recall=await recallPool(anchor,session.radius,analysis,constraints);
  let pool=filterKnown(recall.items);
  if(!pool.length && !refill) pool=recall.items;
  if(!pool.length)throw new Error(constraints.excludedLanguages.length?'当前硬约束下暂时没有找到可用候选。From Here 不会退回被你排除的音乐来凑数；请稍后重试。':'当前歌曲已经识别，但这次没有找到能加入播放队列的后续歌曲。请稍后重试，或把探索距离稍微打开一点。');
  onProgress(refill?'refill-rank':'rank',refill?'让后面继续留在这一轮':'比较候选，守住这一刻的感觉',refill?62:76);
  let engine='local-session', ranked=null;
  try{
    ranked=await aiRank(pool,anchor,session.radius,session.stateWords,activeExcludes,analysis,constraints);
    if(ranked?.length)engine='ai-session';
  }catch(e){console.warn('[AI rank fallback]',e.message);}
  if(!ranked?.length) ranked=localRank(pool,anchor,session.radius,session.stateWords,activeExcludes,analysis,constraints);
  ranked=ranked.filter(t=>!sameTrack(t,anchor));

  // A single excellent recommendation is not a usable continuous Session. If
  // the strict first pass leaves too little runway, expand the *candidate pool*
  // (more semantic searches), never the user's perceptual radius.
  if(ranked.length<config.minQueueSize && analysis?.recallDirections?.length){
    onProgress(refill?'refill-expand':'expand','候选太少，再沿原来的边界多找一些',refill?72:84);
    try{
      const extra=await recallSemantic(analysis,session.radius,10);
      const merged=dedupe([...pool,...filterKnown(extra)]);
      const byId=new Map(); for(const t of ranked)byId.set(t.encryptedId||keyFor(t),t);
      let remaining=merged.filter(t=>!byId.has(t.encryptedId||keyFor(t)));
      // A cautious model may return only its single favourite even when several
      // candidates are valid. Ask it again on the *remaining* pool rather than
      // loosening continuity thresholds or inventing filler.
      for(let rescue=0; rescue<2 && byId.size<config.minQueueSize && remaining.length; rescue++){
        let more=null;
        try{more=await aiRank(remaining,anchor,session.radius,session.stateWords,activeExcludes,analysis,constraints);}catch(e){console.warn('[AI expanded rank fallback]',e.message);}
        if(!more?.length && !config.ai.apiKey)more=localRank(remaining,anchor,session.radius,session.stateWords,activeExcludes,analysis,constraints);
        for(const t of more||[])byId.set(t.encryptedId||keyFor(t),t);
        remaining=remaining.filter(t=>!byId.has(t.encryptedId||keyFor(t)));
      }
      // When AI is unavailable, local rank may safely fill because deterministic
      // format/world-break guards have already run. With AI configured we never
      // bypass the model's continuity gate merely to hit a count.
      if(!config.ai.apiKey && byId.size<config.minQueueSize){for(const t of localRank(remaining,anchor,session.radius,session.stateWords,activeExcludes,analysis,constraints))byId.set(t.encryptedId||keyFor(t),t);}
      ranked=diversify([...byId.values()].filter(t=>!sameTrack(t,anchor)),anchor,Math.max(config.queueSize,8));
      recall={items:merged,meta:{...recall.meta,expandedSemantic:{count:extra.length,error:null}}};
    }catch(e){console.warn('[expanded recall]',e.message);}
  }
  if(!ranked.length)throw new Error(constraints.excludedLanguages.length?'当前硬约束下没有找到足够可靠的后续歌曲。From Here 不会用不符合要求的歌凑数；可以换一种描述或稍后重试。':'候选全部被当前边界过滤掉了。可以把距离稍微打开一点。');
  return {ranked,recall,engine};
}

function queueView(){
  return [session.currentRecommendation,...session.upcoming].filter(Boolean);
}
function updateQueueCompat(){session.queue=queueView();}
function currentRelation(){
  const t=session.currentRecommendation;
  if(!t)return null;
  return {
    track:t,
    anchor:session.anchor,
    reason:publicReason(t.reason,'和起点的声音与情绪能自然接上'),
    distance:Number.isFinite(Number(t.distance))?Number(t.distance):null,
    journeyRole:t.journeyRole||null,
    aestheticJudgment:t.aestheticJudgment||null,
    transitionLogic:t.transitionLogic||null
  };
}

async function buildSession(input={},forceNew=false,onProgress=()=>{}){
  onProgress('media','确认当前歌曲',8);
  const state=await currentState({force:true}); if(!state.track)throw new Error(state.error||'没有读到当前歌曲，请先在网易云 Mac 客户端播放一首歌。');
  onProgress('identify',`确认 ${state.track.artist} — ${state.track.title}`,16);
  let current=await searchExact(state.track);
  current=await enrichAnchorContext(current);
  refreshHistoryMemory().catch(()=>{});
  if(forceNew||!session.active||!session.anchor){
    session.anchor=current; session.positiveArtists=[]; session.negativeArtists=[]; session.history=[];
    session.currentRecommendation=null; session.upcoming=[]; session.reserve=[]; session.createdAt=new Date().toISOString(); session.ignoredSignalKey=''; session.lastEndedAt=null; session.lastEndedAnchor=null;
  }
  const anchor=session.anchor;
  session.currentTrack=state.track;
  session.radius=Math.max(10,Math.min(90,Number(input.radius??session.radius??35)));
  session.stateWords=String(input.stateWords??session.stateWords??'').trim();
  session.excludes=String(input.excludes??session.excludes??'').trim();
  const activeExcludes=effectiveExcludes(session.stateWords,session.excludes);
  const constraints=parseSessionConstraints(session.stateWords,activeExcludes);
  const instruction=[session.stateWords,activeExcludes?`明确排除：${activeExcludes}`:'',constraintPrompt(constraints)].filter(Boolean).join('；');
  onProgress('understand','理解这首歌的声音与情绪',30);
  const analysis=await analyzeAnchor(anchor,session.radius,instruction,forceNew);
  onProgress('directions','找到几条可以继续走的路',48);
  const {ranked,recall,engine}=await planBatch(anchor,analysis,onProgress);
  onProgress('queue','把一段连续的音乐放到接下来',92);
  const injectedTracks=await injectQueue(ranked,{position:'next',limit:config.queueSize});
  session.active=true; session.currentRecommendation=null; session.upcoming=injectedTracks; session.reserve=ranked.slice(injectedTracks.length);
  session.recall=recall.meta; session.analysis=analysis; session.engine=engine; session.updatedAt=new Date().toISOString();
  updateQueueCompat();
  return sessionView(state.track);
}

async function replanAfterFeedback(type,onProgress=()=>{}){
  const s=await currentState(); if(!s.track)throw new Error('没有读取到当前歌曲');
  const current=s.track;
  // Feedback changes the future. It never skips or interrupts the song that is
  // currently playing.
  if(type==='far'){
    if(!sameTrack(current,session.anchor)&&!session.negativeArtists.some(a=>a.toLowerCase()===current.artist.toLowerCase()))session.negativeArtists.push(current.artist);
    session.radius=Math.max(10,session.radius-8);
  } else if(type==='good'){
    if(!sameTrack(current,session.anchor)&&!session.positiveArtists.some(a=>a.toLowerCase()===current.artist.toLowerCase()))session.positiveArtists.push(current.artist);
  } else throw new Error('未知反馈');
  onProgress('feedback','只调整后续，不打断正在播放',18);
  try{
    const {ranked,recall,engine}=await planBatch(session.anchor,session.analysis,onProgress,{refill:true});
    onProgress('queue','把新的方向放到当前歌曲之后',88);
    const fresh=await injectQueue(ranked,{position:'next',limit:config.queueSize});
    session.upcoming=fresh; session.reserve=ranked.slice(fresh.length);
    session.recall=recall.meta; session.engine=engine;
  }catch(e){
    // Feedback itself is valuable even when the catalog cannot immediately
    // produce a better replacement batch. Never turn that into a playback
    // error; keep the current runway and apply the signal to the next refill.
    console.warn('[feedback deferred]',e.message);
    onProgress('feedback-deferred','已经记住，下一次补充会按这个方向调整',88);
  }
  session.updatedAt=new Date().toISOString(); updateQueueCompat();
  return sessionView(current);
}

function samePlannedTrack(a,b){return !!a&&!!b&&sameTrack(a,b);}
function observeSessionTrack(track){
  if(!session.active||!track?.title||!track?.artist)return;
  session.currentTrack=track;
  const k=keyFor(track);
  if(k===session.lastObservedKey)return;
  session.lastObservedKey=k;
  if(session.anchor&&sameTrack(track,session.anchor)){
    session.currentRecommendation=null; session.ignoredSignalKey=''; updateQueueCompat(); return;
  }
  const idx=session.upcoming.findIndex(t=>samePlannedTrack(t,track));
  if(idx>=0){
    const matched=session.upcoming[idx];
    session.currentRecommendation=matched; session.ignoredSignalKey='';
    if(!session.history.some(t=>sameTrack(t,matched)))session.history.push(matched);
    session.upcoming=session.upcoming.slice(idx+1);
    updateQueueCompat();
    session.updatedAt=new Date().toISOString();
  }
}

function shouldRefill(){
  return session.active&&session.anchor&&!session.refillJobId&&Date.now()>=Number(session.refillBlockedUntil||0)&&session.upcoming.length<=3;
}
async function startAutoRefill(){
  if(!shouldRefill())return;
  const job=createJob('autopilot-refill',async progress=>{
    const need=()=>Math.max(0,config.queueSize-session.upcoming.length);
    // Fast path: initial ranking already produced more good tracks than we
    // injected. Append those to the *end* so playback order never jumps.
    if(need()>0&&session.reserve.length){
      progress('refill-reserve','接下来已经有准备好的歌',28);
      const quick=session.reserve.splice(0,need());
      const added=await injectQueue(quick,{position:'end',limit:quick.length});
      session.upcoming=[...session.upcoming,...added]; updateQueueCompat();
    }
    // Replenish the hidden reserve early while the user still has runway.
    if(session.reserve.length<config.minQueueSize){
      const {ranked,recall,engine}=await planBatch(session.anchor,session.analysis,progress,{refill:true});
      const known=sessionKnownKeys();
      const freshReserve=ranked.filter(t=>!known.has(t.encryptedId||keyFor(t)));
      session.reserve=dedupe([...session.reserve,...freshReserve]); session.recall=recall.meta; session.engine=engine;
    }
    if(need()>0&&session.reserve.length){
      const more=session.reserve.splice(0,need());
      const added=await injectQueue(more,{position:'end',limit:more.length});
      session.upcoming=[...session.upcoming,...added];
    }
    session.updatedAt=new Date().toISOString(); updateQueueCompat();
    return sessionView(session.currentTrack);
  });
  session.refillJobId=job.id;
  const id=job.id;
  const timer=setInterval(()=>{
    const j=jobs.get(id);
    if(!j||j.status==='done'||j.status==='error'){
      clearInterval(timer); if(j?.status==='error')session.refillBlockedUntil=Date.now()+60000; if(session.refillJobId===id)session.refillJobId=null;
    }
  },250); timer.unref?.();
}

async function observePlayback(){
  try{
    const st=await currentState({force:true});
    if(st.track&&!st.stale){
      observeSessionTrack(st.track);
      if(shouldRefill())startAutoRefill().catch(e=>console.warn('[autopilot refill]',e.message));
    }
  }catch(e){console.warn('[media monitor]',e.message);}
}
const mediaMonitor=setInterval(observePlayback,1800); mediaMonitor.unref?.();

function sessionView(nowTrack=null,playbackState=null){
  const mediaIsFresh=!playbackState || playbackState.stale!==true;
  if(mediaIsFresh&&nowTrack?.title&&nowTrack?.artist)observeSessionTrack(nowTrack);
  // A stale last-good snapshot must never rewind a newer track already observed
  // by the Bridge media monitor. This is the single playback truth used by UI.
  const current=(playbackState?.stale&&session.currentTrack)?session.currentTrack:(nowTrack||session.currentTrack||null);
  let signal=false,signalIgnored=false;
  if(session.active&&session.anchor&&current&&!sameTrack(current,session.anchor)){
    const isCurrent=session.currentRecommendation&&sameTrack(session.currentRecommendation,current);
    const isUpcoming=session.upcoming.some(t=>sameTrack(t,current));
    const k=keyFor(current);
    signalIgnored=!!session.ignoredSignalKey&&session.ignoredSignalKey===k;
    signal=!isCurrent&&!isUpcoming&&!signalIgnored;
  }
  return {
    ...session,
    queue:queueView(),
    currentTrack:current,
    currentRelation:currentRelation(),
    remaining:session.upcoming.length,
    autoplay:true,
    signal,
    signalIgnored,
    signalTrack:signal?current:null,
    playback:{
      track:current,
      stale:!!playbackState?.stale,
      freshness:playbackState?.freshness||'unknown',
      detector:playbackState?.detector||''
    },
    profile:session.anchor?profileFor(session.anchor.artist):null,
    aiConfigured:aiProvider.state.status==='ready',
    ai:{...aiView(),modelMode:config.ai.modelMode,localModel:config.ai.localModel,localSource:config.ai.localSource}
  };
}

async function health(){
  let ncm=MOCK,version=MOCK?'mock':'',nowPlaying=MOCK,login=MOCK,player=null,error=null;
  if(config.ai.apiKey) await discoverAI();
  if(!MOCK){try{const r=await runNcm(['--version'],5000);ncm=true;version=r.stdout;}catch(e){error=e.message;} try{await nowSnapshot();nowPlaying=true;}catch{} try{await runNcm(['login','--check'],5000);login=true;}catch{login=false;} try{player=(await runNcm(['config','get','player'],5000)).stdout;}catch{} }
  return {ok:true,app:'from-here',appVersion:'1.1.0',mock:MOCK,ncm,ncmAuthorized:!!login,nowPlaying,version,player,aiConfigured:aiProvider.state.status==='ready',ai:{...aiView(),modelMode:config.ai.modelMode,localModel:config.ai.localModel,localSource:config.ai.localSource},error};
}

const server=http.createServer(async(req,res)=>{
  cors(res); if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  try{
    const url=new URL(req.url,`http://${req.headers.host||'127.0.0.1'}`);
    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,await health());
    if(req.method==='GET'&&url.pathname==='/api/ai') { if(url.searchParams.get('refresh')==='1') await discoverAI(true); else await discoverAI(); return json(res,200,aiView()); }
    if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,await currentState());
    if(req.method==='GET'&&url.pathname==='/api/session'){const media=await currentState();return json(res,200,sessionView(media.track,media));}
    if(req.method==='GET'&&url.pathname.startsWith('/api/jobs/')){const id=url.pathname.split('/').pop();const job=jobs.get(id);return job?json(res,200,jobView(job)):json(res,404,{error:'任务不存在或已过期'});}
    if(req.method==='POST'&&url.pathname==='/api/session/start'){const input=await body(req);return json(res,202,createJob('start',progress=>buildSession(input,true,progress)));}
    if(req.method==='POST'&&url.pathname==='/api/session/rebuild'){const input=await body(req);return json(res,202,createJob('rebuild',progress=>buildSession(input,false,progress)));}
    if(req.method==='POST'&&url.pathname==='/api/session/reanchor'){const input=await body(req);return json(res,202,createJob('reanchor',progress=>buildSession(input,true,progress)));}
    if(req.method==='POST'&&url.pathname==='/api/session/feedback'){const b=await body(req);return json(res,202,createJob(`feedback:${b.type}`,progress=>replanAfterFeedback(b.type,progress)));}
    if(req.method==='POST'&&url.pathname==='/api/session/keep'){const media=await currentState({force:true});if(media.track?.title&&media.track?.artist)session.ignoredSignalKey=keyFor(media.track);session.updatedAt=new Date().toISOString();return json(res,200,sessionView(media.track,media));}
    if(req.method==='POST'&&url.pathname==='/api/session/end'){const media=await currentState({force:true});const endedAnchor=session.anchor;session.active=false;session.anchor=null;session.queue=[];session.upcoming=[];session.currentRecommendation=null;session.currentTrack=media.track||session.currentTrack;session.history=[];session.refillJobId=null;session.refillBlockedUntil=0;session.reserve=[];session.positiveArtists=[];session.negativeArtists=[];session.recall={};session.analysis=null;session.ignoredSignalKey='';session.lastEndedAt=new Date().toISOString();session.lastEndedAnchor=endedAnchor;session.updatedAt=session.lastEndedAt;return json(res,200,{ok:true,...sessionView(media.track,media)});}
    if(MOCK&&req.method==='POST'&&url.pathname==='/api/mock/play'){const b=await body(req);const track=mockCatalog.find(t=>String(t.title).toLowerCase()===String(b.title||'').toLowerCase());if(!track)return json(res,404,{error:'mock track not found'});mockState.queue.push(track);mockState.index=mockState.queue.length-1;const media=await currentState({force:true});return json(res,200,sessionView(media.track,media));}
    if(req.method==='POST'&&url.pathname==='/api/player/next'){await runNcm(['next']);return json(res,200,await currentState());}
    if(req.method==='POST'&&url.pathname==='/api/player/prev'){await runNcm(['prev']);return json(res,200,await currentState());}
    return json(res,404,{error:'Not found'});
  }catch(e){console.error('[bridge]',e);return json(res,500,{error:e.message,hint:!MOCK&&/ENOENT|spawn ncm-cli/i.test(e.message)?'请先安装 @music163/ncm-cli':undefined});}
});

server.listen(config.port,'127.0.0.1',()=>{
  setTimeout(()=>refreshHistoryMemory().catch(()=>{}),150).unref?.();
  console.log(`\n● From Here v1.1.0 · Listening Judgment · http://127.0.0.1:${config.port}`);
  console.log(`模式：${MOCK?'MOCK':'网易云 ncm-cli + macOS Now Playing'}`);
  console.log(`推荐：Anchor 语义理解 → 网易云多路召回 → ${config.ai.apiKey?'AI Provider（失败时回退本地）':'本地 Session Rank（AI 未配置）'}`);
  if(config.ai.apiKey) discoverAI(true).then(a=>console.log(a.status==='ready'?`AI：${a.model} · ${a.protocol||'auto'} · 已连接\n`:`AI：连接失败 · ${a.lastError}\n`));
  console.log(`队列：保持约 ${config.queueSize} 首的滚动窗口；剩余过少时自动补充，不清空原队列\n`);
});
