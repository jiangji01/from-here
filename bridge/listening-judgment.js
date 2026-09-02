function unit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

const BASE_WEIGHTS = {
  vocal: 1,
  timbre: 1,
  instrumentation_texture: 1,
  rhythm_motion: 1,
  dynamics: 1,
  melody_harmony: 1,
  emotional_core: 1,
  imagery_narrative: 1,
  language: 0.8
};

function continuityAverage(track) {
  const c = track?.continuity && typeof track.continuity === 'object' ? track.continuity : {};
  const salience = c.salience && typeof c.salience === 'object' ? c.salience : (track?.continuitySalience || {});
  let weighted = 0;
  let weights = 0;
  for (const [key, baseWeight] of Object.entries(BASE_WEIGHTS)) {
    const value = unit(c[key]);
    if (value == null) continue;
    const s = unit(salience?.[key]);
    const weight = baseWeight * (s == null ? 1 : (0.35 + s * 1.65));
    weighted += value * weight;
    weights += weight;
  }
  return weights ? weighted / weights : null;
}

function identityPairs(track) {
  const c = track?.continuity && typeof track.continuity === 'object' ? track.continuity : {};
  const strengths = c.identity_strength && typeof c.identity_strength === 'object' ? c.identity_strength : {};
  const matches = c.identity_match && typeof c.identity_match === 'object' ? c.identity_match : {};
  return Object.keys(strengths).map(type=>({
    type,
    strength: unit(strengths[type]),
    match: unit(matches[type])
  })).filter(x=>x.strength!=null && x.strength>=0.65);
}

function dominantIdentityAdjustment(track, radius=35, position=0) {
  const pairs = identityPairs(track);
  if (!pairs.length) return 0;
  const dominant = pairs.filter(x=>x.strength>0.85);
  const strong = pairs.filter(x=>x.strength>=0.65 && x.strength<=0.85);

  // A dominant identity is non-compensatory at normal distance. If Adele is
  // voice-led, a weak vocal-persona match cannot be rescued by lyrics or piano;
  // if an EDM anchor is production-led, a same-artist acoustic ballad cannot be
  // rescued by artist identity.
  if (Number(radius)<=45) {
    if (dominant.some(x=>x.match!=null && x.match<0.48)) return -120;
    if (dominant.length>=2) {
      const known=dominant.filter(x=>x.match!=null);
      const good=known.filter(x=>x.match>=0.68).length;
      if (known.length>=2 && good < Math.ceil(known.length/2)) return -100;
    }
  }
  if (Number(radius)<=65 && dominant.some(x=>x.match!=null && x.match<0.35)) return -90;

  let score=0;
  for(const x of dominant){ if(x.match!=null) score += (x.match-0.66) * (position===0?42:32) * x.strength; }
  for(const x of strong){ if(x.match!=null) score += (x.match-0.60) * 18 * x.strength; }
  return score;
}

function normalizeRole(role='') {
  const r = String(role || '').toLowerCase().trim();
  if (['hold','deepen','open','turn','land'].includes(r)) return r;
  return 'open';
}

function aestheticReject(track, radius=35) {
  const worth = unit(track?.nextSongWorthiness);
  const obvious = unit(track?.obviousness);
  const cliche = unit(track?.clicheRisk);
  const difference = unit(track?.meaningfulDifference);
  if (worth != null && worth < 0.48) return true;
  if (Number(radius) > 18 && cliche != null && obvious != null && cliche >= 0.84 && obvious >= 0.64) return true;
  if (Number(radius) > 18 && obvious != null && difference != null && obvious >= 0.90 && difference < 0.26) return true;
  return false;
}

function roleBonus(role, position, radius, selected) {
  const r = normalizeRole(role);
  const seen = new Set(selected.map(x => normalizeRole(x.journeyRole)));
  let bonus = 0;
  if (position === 0) {
    if (r === 'hold' || r === 'deepen') bonus += 10;
    if (r === 'open') bonus += 2;
    if (r === 'turn') bonus -= Number(radius) <= 45 ? 13 : 5;
    if (r === 'land') bonus -= 5;
  } else if (position === 1) {
    if (r === 'deepen' || r === 'open') bonus += 7;
    if (r === 'turn' && Number(radius) <= 30) bonus -= 6;
  } else if (position === 2) {
    if (r === 'open' || r === 'turn') bonus += 8;
  } else {
    if (r === 'land' && (seen.has('open') || seen.has('turn'))) bonus += 7;
    if (r === 'turn' && !seen.has('turn') && Number(radius) > 28) bonus += 4;
  }
  const prev = selected[selected.length - 1];
  if (prev && normalizeRole(prev.journeyRole) === r) bonus -= 7;
  return bonus;
}

function candidateScore(track, position, radius, selected, anchor) {
  const worth = unit(track?.nextSongWorthiness) ?? 0.62;
  const continuity = continuityAverage(track) ?? 0.58;
  const difference = unit(track?.meaningfulDifference) ?? 0.45;
  const surprise = unit(track?.surpriseValue) ?? 0.35;
  const obvious = unit(track?.obviousness) ?? 0.35;
  const cliche = unit(track?.clicheRisk) ?? 0.20;
  const ai = Number.isFinite(Number(track?.aiScore)) ? Math.max(0, Math.min(100, Number(track.aiScore))) / 100 : 0.55;
  const seq = Number.isFinite(Number(track?.sequenceIndex)) ? Number(track.sequenceIndex) : null;

  let score = worth * 34 + continuity * 27 + difference * 8 + ai * 11;
  score += Math.min(surprise, Number(radius) <= 25 ? 0.35 : 0.68) * 5;
  score -= obvious * 7 + cliche * 13;
  score += roleBonus(track?.journeyRole, position, radius, selected);
  score += dominantIdentityAdjustment(track, radius, position);

  if (seq != null) score += Math.max(0, 10 - seq * 1.8);
  const prev = selected[selected.length - 1];
  if (prev && String(prev.source || '') === String(track.source || '')) score -= 3;

  // Same artist is now neutral. The specific song must win or lose on Dominant
  // Musical Identity, not on a blanket anti-obviousness rule.
  if (position === 0) {
    if (surprise > 0.72 && continuity < 0.70) score -= 18;
    if (Number(radius) <= 45 && continuity < 0.58) score -= 22;
  }
  return score;
}

function composeListeningArc(items, anchor, radius=35, limit=8) {
  const max = Math.max(1, Number(limit) || 8);
  const pool = (Array.isArray(items) ? items : []).filter(t => !aestheticReject(t, radius));
  const selected = [];
  const used = new Set();
  while (selected.length < max) {
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(i)) continue;
      const score = candidateScore(pool[i], selected.length, radius, selected, anchor);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    if (best == null) break;
    used.add(best);
    selected.push(pool[best]);
  }
  return selected;
}

module.exports = {
  unit,
  continuityAverage,
  identityPairs,
  dominantIdentityAdjustment,
  normalizeRole,
  aestheticReject,
  composeListeningArc
};