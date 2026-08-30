const assert=require('assert');
const { buildAnchorAnalysisPrompt, buildRankingPrompt }=require('./prompts/music-semantic');
const anchor={artist:'Of Monsters and Men',title:'Dirty Paws',album:'My Head Is an Animal'};
const a=buildAnchorAnalysisPrompt({anchor,radius:35,instruction:'更冷一点，不要纯音乐，保持人声'});
for(const token of ['Vocal Identity','真假音','Emotional Core','Imagery & Atmosphere','Rhythm & Motion','Dynamics','Instrumentation & Texture','Melody & Harmony','Narrative Feeling','must_preserve','recall_directions']) assert(a.includes(token),`missing ${token}`);
const r=buildRankingPrompt({anchor,radius:35,instruction:'保持人声',analysis:{fingerprint:{vocal_identity:['男女声','真声'],must_preserve:['有人声'],can_drift:['更暗']}},candidates:[{artist:'Fleet Foxes',title:'Mykonos',album:'',tags:['indie','folk'],source:'semantic-search',distance:28},{artist:'Klaas',title:'First Girl On The Moon',album:'',tags:['dance','edm'],source:'heartbeat',distance:50}],positiveArtists:[],negativeArtists:[]});
for(const token of ['Continuity','Vocal Compatibility','instrumental cover','candidate_id','world_breaks','perceptual_distance','不要因为 source=heartbeat']) assert(r.includes(token),`missing rank ${token}`);
assert(!r.includes('rough_distance'),'recall source distance must not leak into AI prompt');
console.log('✓ music semantic prompt: perceptual continuity + world-break + no fake recall distance');
