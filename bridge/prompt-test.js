const assert=require('assert');
const { RANK_SYSTEM, buildAnchorAnalysisPrompt, buildRankingPrompt }=require('./prompts/music-semantic');
const anchor={artist:'Of Monsters and Men',title:'Dirty Paws',album:'My Head Is an Animal'};
const a=buildAnchorAnalysisPrompt({anchor,radius:35,instruction:'更冷一点，不要纯音乐，保持人声'});
for(const token of [
  'What makes this song itself?','Dominant Musical Identity','vocal_persona','vocal_interplay','groove','production',
  'Vocal Identity','Vocal Interplay','Groove & Motion','Production & Sonic Body','Melody & Harmony','Atmosphere','Dynamics','Band Energy',
  'IDENTITY[type|strength]','fingerprint.salience','must_preserve','recall_directions'
]) assert(a.includes(token),`missing analysis contract: ${token}`);

const analysis={fingerprint:{
  vocal_identity:['男女声互动'],
  must_preserve:['IDENTITY[vocal_interplay|0.94] 男女声互相回应构成核心人格'],
  can_drift:['编制可稍冷'],
  salience:{vocal:.9,timbre:.8,rhythm_motion:.7}
},aesthetic:{tension:['童话感 × 野性']}};
const r=buildRankingPrompt({anchor,radius:35,instruction:'保持人声',analysis,candidates:[
  {artist:'Edward Sharpe & The Magnetic Zeros',title:'Home',album:'',tags:['indie','folk'],source:'semantic-search'},
  {artist:'Guitar Tribute Players',title:'Dirty Paws Tribute',album:'',tags:['tribute','instrumental'],source:'heartbeat'}
],positiveArtists:[],negativeArtists:[]});

// Identify → Preserve → Drift → Surprise is a system-level judgment contract.
// Candidate-specific enforcement belongs in the ranking prompt.
for(const token of ['Identify','Preserve','Drift','Surprise']) {
  assert(RANK_SYSTEM.includes(token),`missing ranking-system contract: ${token}`);
}
for(const token of [
  'identity_strength','identity_match','almost non-compensatory identity guard',
  '同艺人不是扣分项也不是加分项','source=heartbeat','confidence=low','推荐理由必须','保留了什么 + 改变了什么',
  'world_breaks','perceptual_distance','melody_harmony','language'
]) assert(r.includes(token),`missing ranking prompt contract: ${token}`);
assert(!r.includes('前三首不要出现 Anchor Artist'),'legacy anti-same-artist rule must not remain in ranking prompt');
assert(!r.includes('rough_distance'),'recall source distance must not leak into AI prompt');

console.log('✓ music semantic prompt: dominant identity → preserve → drift → surprise');
