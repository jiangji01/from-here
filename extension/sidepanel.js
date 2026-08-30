const API='http://127.0.0.1:19428';
const $=s=>document.querySelector(s);
const els={
  settings:$('#settings'),settingsToggle:$('#settingsToggle'),settingsClose:$('#settingsClose'),musicStatus:$('#musicStatus'),aiModel:$('#aiModel'),aiMode:$('#aiMode'),sessionNotice:$('#sessionNotice'),sessionNoticeCopy:$('#sessionNoticeCopy'),
  cover:$('#cover'),coverFallback:$('#coverFallback'),ambientArt:$('#ambientArt'),title:$('#trackTitle'),artist:$('#trackArtist'),album:$('#album'),
  signal:$('#signalCard'),signalCopy:$('#signalCopy'),reanchor:$('#reanchor'),keepWorld:$('#keepWorld'),
  startState:$('#startState'),radius:$('#radius'),radiusWords:$('#radiusWords'),instructionToggle:$('#instructionToggle'),instructionWrap:$('#instructionWrap'),instruction:$('#instruction'),start:$('#start'),
  journey:$('#journey'),journeyTitle:$('#journeyTitle'),journeyDetail:$('#journeyDetail'),progressBar:$('#progressBar'),
  session:$('#session'),anchorName:$('#anchorName'),sessionDistance:$('#sessionDistance'),end:$('#endSession'),routeAnchorStop:$('#routeAnchorStop'),routeAnchorLabel:$('#routeAnchorLabel'),routeAnchorTitle:$('#routeAnchorTitle'),routeAnchorArtist:$('#routeAnchorArtist'),routeCurrentStop:$('#routeCurrentStop'),routeCurrentLabel:$('#routeCurrentLabel'),routeCurrentTitle:$('#routeCurrentTitle'),routeCurrentArtist:$('#routeCurrentArtist'),currentRelation:$('#currentRelation'),currentRelationText:$('#currentRelationText'),nextTrack:$('#nextTrack'),queueCount:$('#queueCount'),moreToggle:$('#moreToggle'),moreQueue:$('#moreQueue'),far:$('#far'),good:$('#good'),
  empty:$('#emptyState'),toast:$('#toast')
};
let current=null,session=null,health=null,lastGoodTrack=null,pollTimer=null,busy=false,healthAt=0,activeJobId=null;

async function api(path,opt={}){const r=await fetch(API+path,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function toast(s){els.toast.textContent=s;els.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove('show'),2600);}
function radiusLanguage(v){if(v<=20)return'几乎不离开这里';if(v<=42)return'离这里不太远';if(v<=65)return'允许一些偶遇';return'带我走远一点';}
function renderDistance(){els.radiusWords.textContent=radiusLanguage(Number(els.radius.value));}
function short(s='',n=26){const x=String(s||'');return x.length>n?x.slice(0,n-1)+'…':x;}
function trackKey(t){return t?.title&&t?.artist?`${String(t.artist).toLowerCase()}::${String(t.title).toLowerCase()}`:'';}
function sameTrack(a,b){return !!trackKey(a)&&trackKey(a)===trackKey(b);}
function userReason(s=''){const x=String(s||'').trim();if(!x||/网易云|召回|重排|候选池|ranking|rank|provider|模型|AI/i.test(x))return'和起点的声音与情绪能自然接上';return x;}
function storageGet(keys){return new Promise(resolve=>chrome.storage.local.get(keys,resolve));}
function storageSet(obj){return new Promise(resolve=>chrome.storage.local.set(obj,resolve));}
function storageRemove(keys){return new Promise(resolve=>chrome.storage.local.remove(keys,resolve));}

async function rememberTrack(track){
  if(!track?.title||!track?.artist)return;
  lastGoodTrack=track;
  await storageSet({lastGoodTrack:track,lastGoodTrackAt:Date.now()});
}

function renderTrack(t){
  if(t?.title&&t?.artist)rememberTrack(t);
  const track=(t?.title&&t?.artist)?t:lastGoodTrack;
  current=track||null;
  if(!track){
    els.title.textContent='还没有音乐发生';els.artist.textContent='先播放一首歌';els.album.textContent='';els.empty.classList.remove('hidden');
    els.cover.removeAttribute('src');els.cover.classList.remove('show');els.coverFallback.textContent='FH';els.ambientArt.removeAttribute('src');return;
  }
  els.empty.classList.add('hidden');
  els.title.textContent=track.title;els.artist.textContent=track.artist;els.album.textContent=track.album||'';
  const initials=(track.artist||'FH').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();els.coverFallback.textContent=initials||'FH';
  const src=track.artworkData?`data:${track.artworkMime||'image/jpeg'};base64,${track.artworkData}`:(track.coverUrl||'');
  if(src){els.cover.src=src;els.cover.classList.add('show');els.ambientArt.src=src}else{els.cover.removeAttribute('src');els.cover.classList.remove('show');els.ambientArt.removeAttribute('src')}
}

function renderSettings(){
  if(!health){els.musicStatus.textContent='未连接';els.aiModel.textContent='未检测';els.aiMode.textContent='';return;}
  els.musicStatus.textContent=health.mock?'Mock':(health.ncm&&health.nowPlaying?'网易云 · 已连接':'需要检查');
  const ai=health.ai||{};
  if(ai.status==='ready'){
    els.aiModel.textContent=short(ai.model||'AI 已连接');
    const follow=ai.modelMode==='follow-local';
    els.aiMode.textContent=follow?`跟随本机${ai.localModel?` · ${short(ai.localModel,20)}`:''}`:`自定义 · ${ai.providerLabel||ai.provider||'Provider'}`;
  }else if(ai.status==='error'){
    els.aiModel.textContent='AI 暂不可用';els.aiMode.textContent='已自动回退本地排序';
  }else{
    els.aiModel.textContent='未配置 AI';els.aiMode.textContent='使用本地 Session Rank';
  }
}

function setBusy(on){
  busy=on;
  [els.start,els.far,els.good,els.reanchor,els.end].forEach(b=>{if(b)b.disabled=on;});
}

const stageDetails={
  media:'先确认这一刻的原点。',
  identify:'把播放器里的歌曲和网易云曲库对上。',
  understand:'理解人声、音色、节奏、动态、意境与情感内核。',
  directions:'把“像”拆成几条不同但连续的探索方向。',
  recall:'只让网易云提供真实可播放的候选。',
  rank:'逐首检查连续性，拦住明显的世界断裂。',
  queue:'把一段连续的音乐放到接下来。',
  expand:'候选太少，只扩大搜索范围，不扩大你的音乐边界。',
  'refill-reserve':'下一段已经提前准备好了。',
  'refill-recall':'这一轮还在继续，后台提前准备更后面的歌。',
  'refill-rank':'仍然沿用同一个起点与边界。',
  feedback:'只调整后续，不会切掉正在播放的歌。',
  'feedback-deferred':'反馈已经记住，不会打断当前音乐。',
  done:'这一轮已经准备好了。'
};
function renderJourney(job){
  if(!job||job.status==='done'||job.status==='error')return;
  els.startState.classList.add('hidden');els.session.classList.add('hidden');els.journey.classList.remove('hidden');
  els.journeyTitle.textContent=job.message||'正在寻找下一步';
  els.journeyDetail.textContent=stageDetails[job.stage]||'正在继续。';
  els.progressBar.style.width=`${Math.max(4,Math.min(100,Number(job.progress)||4))}%`;
}
function hideJourney(){els.journey.classList.add('hidden');els.progressBar.style.width='0%';}

function renderQueue(s){
  const q=s?.upcoming||s?.queue||[];
  if(els.queueCount)els.queueCount.textContent=q.length?`· ${q.length} 首`:'';
  const first=q[0];
  if(!first){
    const refilling=!!s?.refillJobId;
    els.nextTrack.innerHTML=refilling?'<div><h3>正在补充后续</h3><p>这一轮会自动继续</p></div>':'<div><h3>后续正在准备</h3><p>不会要求你逐首确认</p></div>';
    els.moreToggle.classList.add('hidden');els.moreQueue.classList.add('hidden');return;
  }
  els.nextTrack.innerHTML=`<div><h3>${esc(first.title)}</h3><p>${esc(first.artist)}</p></div><small>${esc(userReason(first.reason))}</small>`;
  const rest=q.slice(1);
  if(rest.length){
    els.moreToggle.dataset.count=String(rest.length);
    els.moreToggle.textContent=`展开其余 ${rest.length} 首`;
    els.moreToggle.classList.remove('hidden');
    els.moreQueue.innerHTML=rest.map(t=>`<div class="more-item"><span>${esc(t.title)} · ${esc(t.artist)}</span><span>${esc(userReason(t.reason))}</span></div>`).join('');
  }else{els.moreToggle.classList.add('hidden');els.moreQueue.classList.add('hidden');}
}

function renderSession(s){
  session=s||null;
  if(!s?.active){
    els.session.classList.add('hidden');els.signal.classList.add('hidden');
    // End-of-round feedback is a toast, not a persistent module. Persistent
    // notices were visually re-entering when the instruction field changed.
    els.sessionNotice.classList.add('hidden');
    if(!busy){hideJourney();els.startState.classList.remove('hidden');}
    return;
  }
  els.sessionNotice.classList.add('hidden');
  hideJourney();els.startState.classList.add('hidden');els.session.classList.remove('hidden');
  els.anchorName.textContent=s.anchor?.title||s.anchor?.artist||'这里';els.sessionDistance.textContent=radiusLanguage(s.radius||35);
  els.routeAnchorTitle.textContent=s.anchor?.title||'起点';els.routeAnchorArtist.textContent=s.anchor?.artist||'';
  const playing=s.currentTrack||current||s.anchor||null;
  const atOrigin=sameTrack(playing,s.anchor);
  els.routeAnchorLabel.textContent=atOrigin?'起点 · 正在播放':'起点';
  els.routeAnchorStop.classList.toggle('compact-origin',atOrigin);
  els.routeCurrentStop.classList.toggle('hidden',atOrigin);
  if(!atOrigin){
    els.routeCurrentLabel.textContent=s.signalIgnored?'正在播放 · 不改变起点':'你在这里';
    els.routeCurrentTitle.textContent=playing?.title||'正在继续';els.routeCurrentArtist.textContent=playing?.artist||'';
  }
  els.radius.value=s.radius||35;renderDistance();if(s.stateWords!=null)els.instruction.value=s.stateWords;
  renderQueue(s);
  if(!atOrigin&&s.currentRelation?.reason){els.currentRelation.classList.remove('hidden');els.currentRelationText.textContent=userReason(s.currentRelation.reason);}else{els.currentRelation.classList.add('hidden');els.currentRelationText.textContent='';}
  if(s.signal&&s.signalTrack){els.signal.classList.remove('hidden');els.signalCopy.textContent=`现在是 ${s.signalTrack.artist} — ${s.signalTrack.title}。要换一个原点吗？`;}else els.signal.classList.add('hidden');
}

async function refresh({quiet=false,playbackOnly=false}={}){
  try{
    // /api/session is the single playback truth. Do not combine independent
    // /api/state and /api/session snapshots around a track transition.
    const s=await api('/api/session');
    const displayTrack=s.currentTrack||s.signalTrack||s.anchor||lastGoodTrack;
    renderTrack(displayTrack);session=s;
    if(playbackOnly)return;
    if(!health || Date.now()-healthAt>60000){health=await api('/api/health');healthAt=Date.now();}
    renderSession(s);renderSettings();
  }catch(e){
    renderTrack(lastGoodTrack);
    if(!quiet)toast('From Here Bridge 未启动或需要检查');
  }
}

async function followJob(jobId,{successToast='已经从这里开始'}={}){
  activeJobId=jobId;await storageSet({activeJobId:jobId});setBusy(true);
  const deadline=Date.now()+180000;
  try{
    while(Date.now()<deadline){
      const job=await api(`/api/jobs/${jobId}`);
      if(job.status==='done'){
        hideJourney();session=job.result;await storageRemove(['activeJobId']);activeJobId=null;await refresh({quiet:true});toast(successToast);return session;
      }
      if(job.status==='error')throw new Error(job.error||'这次探索没有完成');
      renderJourney(job);
      await delay(420);
    }
    throw new Error('这次探索时间有点久，请检查 Bridge 终端输出');
  }finally{setBusy(false);}
}

async function startSession(force=false){
  try{
    setBusy(true);
    renderJourney({status:'running',stage:'media',message:'确认当前歌曲',progress:4});
    const path=force?'/api/session/reanchor':'/api/session/start';
    const job=await api(path,{method:'POST',body:JSON.stringify({radius:Number(els.radius.value),stateWords:els.instruction.value.trim(),excludes:''})});
    await followJob(job.id,{successToast:'下一首已经准备好了'});
  }catch(e){hideJourney();els.startState.classList.remove('hidden');toast(e.message);}finally{setBusy(false);}
}

async function feedback(type){
  try{
    setBusy(true);
    toast(type==='far'?'收到，后面会更靠近起点':'收到，后面会多一点这个方向');
    const job=await api('/api/session/feedback',{method:'POST',body:JSON.stringify({type})});
    activeJobId=job.id;await storageSet({activeJobId:job.id});
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      const j=await api(`/api/jobs/${job.id}`);
      if(j.status==='done'){
        session=j.result;await storageRemove(['activeJobId']);activeJobId=null;
        await refresh({quiet:true});toast(type==='far'?'后面会更靠近起点':'后面会多一点这个方向');return;
      }
      if(j.status==='error')throw new Error(j.error||'调整后续失败');
      await delay(500);
    }
    throw new Error('调整后续时间过长');
  }catch(e){renderSession(session);toast(e.message);}finally{setBusy(false);}
}

els.radius.addEventListener('input',renderDistance);
els.instructionToggle.addEventListener('click',()=>{els.instructionWrap.classList.toggle('hidden');if(!els.instructionWrap.classList.contains('hidden'))els.instruction.focus();});
els.start.addEventListener('click',()=>startSession(false));
els.reanchor.addEventListener('click',()=>{els.signal.classList.add('hidden');startSession(true);});
els.keepWorld.addEventListener('click',async()=>{try{els.signal.classList.add('hidden');const s=await api('/api/session/keep',{method:'POST'});renderTrack(s.currentTrack||lastGoodTrack);renderSession(s);toast('继续原来的起点')}catch(e){toast(e.message)}});
els.moreToggle.addEventListener('click',()=>{const hidden=els.moreQueue.classList.toggle('hidden');const n=Number(els.moreToggle.dataset.count||0);els.moreToggle.textContent=hidden?`展开其余 ${n} 首`:'收起';});
els.far.addEventListener('click',()=>feedback('far'));
els.good.addEventListener('click',()=>feedback('good'));
els.end.addEventListener('click',async()=>{try{setBusy(true);const s=await api('/api/session/end',{method:'POST'});session=s;renderTrack(s.currentTrack||lastGoodTrack);renderSession(s);toast('这一轮已结束 · 当前歌曲继续播放')}catch(e){toast(e.message)}finally{setBusy(false)}});
els.settingsToggle.addEventListener('click',()=>{els.settings.classList.toggle('hidden');renderSettings();});
els.settingsClose.addEventListener('click',()=>els.settings.classList.add('hidden'));

async function init(){
  const saved=await storageGet(['lastGoodTrack','activeJobId']);
  if(saved.lastGoodTrack?.title&&saved.lastGoodTrack?.artist){lastGoodTrack=saved.lastGoodTrack;renderTrack(lastGoodTrack);}
  renderDistance();
  await refresh({quiet:true});
  if(saved.activeJobId){
    try{await followJob(saved.activeJobId,{successToast:'下一首已经准备好了'});}catch{await storageRemove(['activeJobId']);hideJourney();await refresh({quiet:true});}
  }
  pollTimer=setInterval(()=>refresh({quiet:true,playbackOnly:busy}),1600);
}
init();
