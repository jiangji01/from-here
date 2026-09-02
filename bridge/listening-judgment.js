function unit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

const CONTINUITY_WEIGHTS = {
  // A voice is not just another tag. When the anchor is vocal-led, losing the
  // singer's physical presence / timbral identity is one of the fastest ways to
  // make a transition feel like a different world.
  vocal: 1.55,
  timbre: 1.45,
  dynamics: 1.10,
  rhythm_motion: 1.00,
  instrumentation_texture: 0.95,
  emotional_core: 1.00,
  imagery_narrative: 0.70
};

function continuityAverage(track) {
  const c = track?.continuity && typeof track.continuity === 'object' ? track.continuity : {};
  let weighted = 0;
  let weights = 0;
  for (const [key, baseWeight] of Object.entries(CONTINUITY_WEIGHTS)) {
    const value = unit(c[key]);
    if (value == null) continue;
    const salience = unit(track?.continuitySalience?.[key]);
    const weight = baseWeight * (salience == null ? 1 : (0.65 + salience * 0.7));
    weighted += value * weight;
    weights += weight;
  }
  return weights ? weighted / weights : null;
}

function vocalContinuity(track) {
  const c = track?.continuity && typeof track.continuity === 'object' ? track.continuity : {};
  return { vocal: unit(c.vocal), timbre: unit(c.timbre) };
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

  // A recommendation may be technically similar and still not deserve to be next.
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
    if (r === 'hold' || r === 'deepen') bonus += 9;
    if (r === 'open') bonus += 3;
    if (r === 'turn') bonus -= Number(radius) <= 45 ? 11 : 5;
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

function firstStepVoiceAdjustment(track, radius) {
  if (Number(radius) > 65) return 0;
  const { vocal, timbre } = vocalContinuity(track);
  if (vocal == null && timbre == null) return 0;

  // The first song earns trust. A severe voice/timbre break must not be rescued
  // by semantic emotion, novelty or a clever sequence score.
  if ((vocal != null && vocal < 0.45) || (timbre != null && timbre < 0.43)) return -100;
  if (vocal != null && timbre != null && vocal < 0.55 && timbre < 0.55) return -60;

  let adjustment = 0;
  if (vocal != null) adjustment += (vocal - 0.64) * 22;
  if (timbre != null) adjustment += (timbre - 0.62) * 20;
  return adjustment;
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

  let score = worth * 34 + continuity * 26 + difference * 9 + ai * 12;
  score += Math.min(surprise, Number(radius) <= 25 ? 0.40 : 0.70) * 6;
  score -= obvious * 10 + cliche * 14;
  score += roleBonus(track?.journeyRole, position, radius, selected);

  // Respect the model's holistic sequence when it supplied one, but do not let it
  // override deterministic continuity / journey guards.
  if (seq != null) score += Math.max(0, 12 - seq * 2.0);

  const prev = selected[selected.length - 1];
  if (prev && String(prev.source || '') === String(track.source || '')) score -= 3.5;

  const anchorArtist = String(anchor?.artist || '').toLowerCase();
  const artist = String(track?.artist || '').toLowerCase();
  if (Number(radius) > 18 && anchorArtist && artist === anchorArtist && position < 3) score -= 100;

  if (position === 0) {
    score += firstStepVoiceAdjustment(track, radius);
    // The first step should feel earned before it feels clever.
    if (surprise > 0.72 && continuity < 0.70) score -= 16;
    if (Number(radius) <= 45 && continuity < 0.58) score -= 20;
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
  vocalContinuity,
  normalizeRole,
  aestheticReject,
  composeListeningArc
};
