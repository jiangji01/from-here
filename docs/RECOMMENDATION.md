# Recommendation engine — Listening Judgment

## North star

From Here does not optimize for “most similar”. It asks a harder question:

> **Does this song deserve to be next?**

A technically similar song can still be lazy, obvious or emotionally wrong. A slightly farther song can be the better next step when it carries forward the Anchor's tension, world, or unfinished expression.

## Pipeline

1. Read the current track from macOS Now Playing.
2. Resolve catalog identity when possible. Anchor identity does **not** depend on candidate playability.
3. Build two complementary views:
   - **Music Fingerprint** — vocal, texture, rhythm, dynamics, emotion, imagery, harmony, narrative;
   - **Aesthetic Reading** — why the song stops you, its internal tension, human state, world, unfinished expression, lazy reductions to avoid, and legitimate surprise axes.
4. Generate 2–4 recall directions. Explicit constraints rewrite recall space instead of merely filtering results afterward.
5. Recall only real NetEase candidates.
6. AI performs **Candidate Judgment**:
   - continuity;
   - meaningful difference;
   - next-song worthiness;
   - obviousness;
   - cliché risk;
   - surprise value;
   - explicit world breaks.
7. AI proposes a **Listening Arc** using roles:
   - `hold` — prove we understood the Anchor;
   - `deepen` — dig further into one tension;
   - `open` — open another language / texture / scene with a bridge;
   - `turn` — a stronger but explainable turn;
   - `land` — settle or integrate the short journey.
8. A deterministic Listening Judgment layer rejects low-worth / high-cliché candidates and composes the arc.
9. Diversity, derivative, language, world-break and playback guards still apply.
10. Only a short runway is inserted into the NetEase queue; refill continues the existing arc instead of restarting from the Anchor every time.

## Aesthetic constitution

The model prompt and deterministic layer share these product principles:

- do not worship surface similarity;
- emotional continuity and “world” matter more than genre labels;
- a little risk is better than boring correctness, but surprise needs a bridge;
- same-artist is a safety net, not the product value;
- avoid cliché matching such as “sad → another sad song” or “rock → another rock song”;
- respect internal tensions such as roughness vs tenderness or restraint vs release;
- long-term taste is a weak tie-break; the present state wins;
- optimize for a meaningful trajectory, not five isolated winners.

## Hard constraints rewrite recall

For example, with `回春丹 — 鲜花` + `不要华语`, From Here should **not** recall mostly Chinese neighbors and delete them afterward. It should preserve the Anchor's experiential skeleton and search directly in non-Chinese musical worlds.

Chinese-language exclusion is based on actual/estimated singing language, not “contains CJK characters”, so Japanese titles containing kanji are not automatically rejected.

## Debugging recommendation quality

Run a real Session, then:

```bash
curl -s http://127.0.0.1:19428/api/session
```

Inspect:

- `analysis.summary`
- `analysis.aesthetic`
- `analysis.fingerprint`
- `analysis.recallDirections`
- `recall`
- `queue[].journeyRole`
- `queue[].aestheticJudgment`
- `queue[].transitionLogic`

This separates five kinds of failure:

1. Anchor listening / aesthetic reading is wrong;
2. recall directions are wrong;
3. catalog recall is weak;
4. candidate judgment is wrong;
5. the individual choices are fine but the trajectory is bad.

## Regressions

`npm test` includes:

- Dirty Paws → tribute suppression;
- Dirty Paws → near-radius EDM world-break rejection;
- artist / album diversity;
- feedback does not skip the current song;
- continuous auto-refill;
- clean system-media path;
- metadata-only Anchor can still start a Session;
- `不要华语` rewrites recall and does not misclassify Japanese CJK;
- obvious same-artist / cliché candidates can be rejected even when the model ranks them high;
- Listening Arc role composition.
