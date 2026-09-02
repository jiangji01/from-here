const assert = require('assert');
const { composeListeningArc, dominantIdentityAdjustment } = require('./listening-judgment');

function candidate({artist,title,driver,match,strength=.93,role='deepen',continuity=.78,surprise=.3,ai=86}){
  const identity_strength={}; identity_strength[driver]=strength;
  const identity_match={}; identity_match[driver]=match;
  return {
    artist,title,source:'semantic-search',aiScore:ai,nextSongWorthiness:.88,
    meaningfulDifference:.42,surpriseValue:surprise,obviousness:.18,clicheRisk:.08,
    journeyRole:role,confidence:'high',
    continuity:{
      vocal:continuity,timbre:continuity,instrumentation_texture:continuity,
      rhythm_motion:continuity,dynamics:continuity,melody_harmony:continuity,
      emotional_core:continuity,imagery_narrative:continuity,language:.72,
      salience:{vocal:.75,timbre:.75,instrumentation_texture:.75,rhythm_motion:.75,dynamics:.7,melody_harmony:.65,emotional_core:.7,imagery_narrative:.5,language:.45},
      identity_strength,identity_match
    }
  };
}

function runBenchmark({name,anchor,driver,green,yellow,red}){
  const pool=[
    ...green.map((x,i)=>candidate({...x,driver,match:x.match??(.88-i*.02),role:i<2?'hold':'deepen',surprise:.2+i*.03,ai:86-i})),
    ...yellow.map((x,i)=>candidate({...x,driver,match:x.match??(.67-i*.025),role:'open',surprise:.45+i*.03,ai:88-i})),
    ...red.map((x,i)=>candidate({...x,driver,match:x.match??(.36-i*.03),role:'open',surprise:.75,ai:97-i}))
  ];
  const arc=composeListeningArc(pool,anchor,35,10);
  const top3=new Set(arc.slice(0,3).map(x=>x.title));
  const greenTitles=new Set(green.map(x=>x.title));
  const redTitles=new Set(red.map(x=>x.title));
  const greenInTop3=[...top3].filter(x=>greenTitles.has(x)).length;
  assert(greenInTop3>=2,`${name}: at least 2 green candidates must be top-3`);
  assert(!arc.slice(0,3).some(x=>redTitles.has(x.title)),`${name}: red candidate leaked into top-3`);
  assert(greenTitles.has(arc[0].title),`${name}: first step must come from green set`);
  return arc;
}

// 1) Voice-led: Adele-like identity. Same artist is allowed to win if the specific
// song preserves the dominant vocal persona; blanket anti-same-artist logic is wrong.
runBenchmark({
  name:'Adele / voice-led',anchor:{artist:'Adele',title:'Hello'},driver:'vocal_persona',
  green:[
    {artist:'Adele',title:'Easy On Me',match:.97},{artist:'Adele',title:'When We Were Young',match:.95},
    {artist:'Florence + The Machine',title:'Never Let Me Go',match:.88},{artist:'Paloma Faith',title:'Only Love Can Hurt Like This',match:.86}
  ],
  yellow:[
    {artist:'Sam Smith',title:'Stay With Me',match:.70},{artist:'Birdy',title:'Skinny Love',match:.64},{artist:'Sia',title:'Breathe Me',match:.62}
  ],
  red:[
    {artist:'Billie Eilish',title:'when the party’s over',match:.39},{artist:'Norah Jones',title:'Don’t Know Why',match:.34},{artist:'Dua Lipa',title:'Levitating',match:.24}
  ]
});

// 2) Imagine Dragons / In Your Corner: vocal body is the dominant identity.
runBenchmark({
  name:'In Your Corner / vocal-body',anchor:{artist:'Imagine Dragons',title:'In Your Corner'},driver:'vocal_persona',
  green:[
    {artist:'Kings of Leon',title:'Use Somebody',match:.91},{artist:'X Ambassadors',title:'Unsteady',match:.89},
    {artist:'OneRepublic',title:'Secrets',match:.86},{artist:'Nothing But Thieves',title:'Impossible',match:.84}
  ],
  yellow:[
    {artist:'Bastille',title:'Pompeii',match:.70},{artist:'Lewis Capaldi',title:'Before You Go',match:.66},{artist:'Coldplay',title:'Fix You',match:.61}
  ],
  red:[
    {artist:'Novo Amor',title:'Anchor',match:.40},{artist:'Cigarettes After Sex',title:'Apocalypse',match:.31},{artist:'不可撤销乐队',title:'女孩儿',match:.25}
  ]
});

// 3) Umbrella: groove is allowed to dominate more than singer identity.
runBenchmark({
  name:'Umbrella / groove-led',anchor:{artist:'Rihanna',title:'Umbrella'},driver:'groove',
  green:[
    {artist:'Nelly Furtado',title:'Say It Right',match:.94},{artist:'Beyoncé',title:'Irreplaceable',match:.90},
    {artist:'Alicia Keys',title:'No One',match:.86},{artist:'Leona Lewis',title:'Bleeding Love',match:.83}
  ],
  yellow:[
    {artist:'P!nk',title:'So What',match:.70},{artist:'Kelly Clarkson',title:'Since U Been Gone',match:.64},{artist:'Gwen Stefani',title:'The Sweet Escape',match:.62}
  ],
  red:[
    {artist:'Billie Eilish',title:'when the party’s over',match:.30},{artist:'Norah Jones',title:'Don’t Know Why',match:.24},{artist:'三净灵章爻爻YOYO',title:'三净灵章',match:.18}
  ]
});

// 4) EDM: production is identity; same singer with an acoustic arrangement must lose.
runBenchmark({
  name:'EDM / production-led',anchor:{artist:'Klaas',title:'First Girl On The Moon'},driver:'production',
  green:[
    {artist:'Calvin Harris',title:'Feel So Close',match:.93},{artist:'Zedd',title:'Stay The Night',match:.90},
    {artist:'Avicii',title:'Levels',match:.88},{artist:'Alesso',title:'Heroes (we could be)',match:.86}
  ],
  yellow:[
    {artist:'CHVRCHES',title:'The Mother We Share',match:.70},{artist:'Robyn',title:'Dancing On My Own',match:.66},{artist:'M83',title:'Midnight City',match:.63}
  ],
  red:[
    {artist:'Klaas',title:'Acoustic Session',match:.32},{artist:'Adele',title:'Someone Like You',match:.18},{artist:'Bon Iver',title:'re: Stacks',match:.16}
  ]
});

// 5) Of Monsters and Men: vocal interplay is the dominant signature; generic folk
// similarity cannot replace the male/female conversational identity.
runBenchmark({
  name:'Of Monsters and Men / vocal-interplay',anchor:{artist:'Of Monsters and Men',title:'Little Talks'},driver:'vocal_interplay',
  green:[
    {artist:'Edward Sharpe & The Magnetic Zeros',title:'Home',match:.94},{artist:'The Civil Wars',title:'Barton Hollow',match:.90},
    {artist:'The Head and the Heart',title:'Rivers and Roads',match:.86},{artist:'Angus & Julia Stone',title:'Big Jet Plane',match:.83}
  ],
  yellow:[
    {artist:'The Lumineers',title:'Stubborn Love',match:.70},{artist:'Fleet Foxes',title:'Mykonos',match:.65},{artist:'Mumford & Sons',title:'I Will Wait',match:.61}
  ],
  red:[
    {artist:'Novo Amor',title:'Anchor',match:.38},{artist:'Sigur Rós',title:'Samskeyti',match:.12},{artist:'Guitar Tribute Players',title:'Little Talks Tribute',match:.06}
  ]
});

// Explicit veto: semantic cleverness cannot compensate for catastrophic loss of a
// >0.85 dominant identity at radius 35.
const vetoTrack=candidate({artist:'Semantic Genius',title:'Emotionally Perfect',driver:'vocal_persona',match:.30,strength:.96,ai:100,surprise:.95});
assert(dominantIdentityAdjustment(vetoTrack,35,0)<=-100,'dominant identity mismatch must behave like a veto at normal radius');

console.log('✓ Dominant Musical Identity benchmark: 5 archetypes × 10 candidates');
