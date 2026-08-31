const assert = require('assert');
const { aestheticReject, composeListeningArc } = require('./listening-judgment');

const anchor={artist:'回春丹',title:'鲜花'};
const base={continuity:{vocal:.8,timbre:.75,instrumentation_texture:.76,rhythm_motion:.72,dynamics:.7,emotional_core:.82,imagery_narrative:.78},worldBreaks:[],confidence:'high'};
const items=[
  {...base,artist:'回春丹',title:'艾蜜莉',source:'same-artist',aiScore:99,nextSongWorthiness:.82,meaningfulDifference:.12,surpriseValue:.08,obviousness:.96,clicheRisk:.86,journeyRole:'hold',sequenceIndex:0},
  {...base,artist:'The Killers',title:'Read My Mind',source:'semantic-search',aiScore:91,nextSongWorthiness:.94,meaningfulDifference:.62,surpriseValue:.48,obviousness:.18,clicheRisk:.08,journeyRole:'deepen',sequenceIndex:1},
  {...base,artist:'RADWIMPS',title:'スパークル',source:'semantic-search',aiScore:89,nextSongWorthiness:.90,meaningfulDifference:.68,surpriseValue:.58,obviousness:.24,clicheRisk:.10,journeyRole:'open',sequenceIndex:2},
  {...base,artist:'Phoenix',title:'Lisztomania',source:'semantic-search',aiScore:86,nextSongWorthiness:.84,meaningfulDifference:.71,surpriseValue:.66,obviousness:.20,clicheRisk:.11,journeyRole:'turn',sequenceIndex:3},
  {...base,artist:'Mew',title:'Comforting Sounds',source:'semantic-search',aiScore:84,nextSongWorthiness:.87,meaningfulDifference:.55,surpriseValue:.42,obviousness:.16,clicheRisk:.07,journeyRole:'land',sequenceIndex:4},
  {...base,artist:'Generic Rock Band',title:'Sad Indie Rock',source:'semantic-search',aiScore:95,nextSongWorthiness:.40,meaningfulDifference:.08,surpriseValue:.05,obviousness:.94,clicheRisk:.93,journeyRole:'hold',sequenceIndex:5}
];

assert(aestheticReject(items[0],35),'obvious same-artist cliché should fail aesthetic gate at normal distance');
assert(aestheticReject(items[5],35),'technically compatible but low-worth cliché should fail');
const arc=composeListeningArc(items,anchor,35,5);
assert(arc.length>=4,'listening arc should keep enough high-quality candidates');
assert.notEqual(arc[0].artist,'回春丹','same artist must not occupy first step at normal distance');
assert(['hold','deepen','open'].includes(arc[0].journeyRole),'first step should earn trust before a hard turn');
assert(!arc.some(x=>x.artist==='Generic Rock Band'),'low-worth cliché leaked into arc');
assert(new Set(arc.map(x=>x.journeyRole)).size>=3,'arc should have role variety rather than five isolated same-role winners');
console.log('✓ Listening Judgment: worthiness gate + anti-obviousness + trajectory composition');
