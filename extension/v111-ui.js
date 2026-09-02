// v1.1.1 UI patch: recommendation reasons should expose the actual musical bridge,
// not explain internal recall/ranking machinery or repeat a generic success phrase.

function isGenericBridgeReason(value='') {
  const x=String(value||'').trim();
  if(!x)return true;
  return /网易云|召回|重排|候选池|ranking|rank|provider|模型|AI|情绪与听感仍能自然接|和起点仍有清楚的听感连续性|和起点的声音与情绪能自然接上|沿着起点的声音气质继续展开|稍微走远一点，但核心气质仍然连着|更意外的一步，仍保留这一轮的核心感受/i.test(x);
}

function concreteBridgeReason(track) {
  const candidates=[track?.transitionLogic,track?.aestheticJudgment,track?.reason];
  for(const value of candidates){
    const text=String(value||'').trim();
    if(text&&!isGenericBridgeReason(text))return text;
  }
  return '';
}

// Replace only the queue renderer. Everything else stays owned by sidepanel.js.
renderQueue = function(s){
  const q=s?.upcoming||s?.queue||[];
  if(els.queueCount)els.queueCount.textContent=q.length?`· ${q.length} 首`:'';
  const first=q[0];
  if(!first){
    const refilling=!!s?.refillJobId;
    els.nextTrack.innerHTML=refilling?'<div><h3>正在补充后续</h3><p>这一轮会自动继续</p></div>':'<div><h3>后续正在准备</h3><p>不会要求你逐首确认</p></div>';
    els.moreToggle.classList.add('hidden');els.moreQueue.classList.add('hidden');return;
  }
  const firstReason=concreteBridgeReason(first);
  els.nextTrack.innerHTML=`<div><h3>${esc(first.title)}</h3><p>${esc(first.artist)}</p></div>${firstReason?`<small class="bridge-reason">${esc(firstReason)}</small>`:''}`;
  const rest=q.slice(1);
  if(rest.length){
    els.moreToggle.dataset.count=String(rest.length);
    els.moreToggle.textContent=`展开其余 ${rest.length} 首`;
    els.moreToggle.classList.remove('hidden');
    els.moreQueue.innerHTML=rest.map(t=>{
      const reason=concreteBridgeReason(t);
      return `<div class="more-item"><span>${esc(t.title)} · ${esc(t.artist)}</span>${reason?`<span class="bridge-reason">${esc(reason)}</span>`:''}</div>`;
    }).join('');
  }else{els.moreToggle.classList.add('hidden');els.moreQueue.classList.add('hidden');}
};
