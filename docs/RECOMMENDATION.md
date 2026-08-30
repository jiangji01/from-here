# Recommendation engine

## Goal

Do not optimize for “most similar”. Optimize for **the most natural next step**.

## Pipeline

1. Read current track from macOS Now Playing.
2. Resolve it to a real NetEase song ID.
3. Build an Anchor Music Fingerprint with AI when available.
4. Generate 2–4 recall directions, not final song hallucinations.
5. Recall real candidates through NetEase: same artist, Heartbeat, semantic searches, FM / Daily by distance.
6. AI ranks real candidates using the Fingerprint and current Session instruction.
7. Deterministic guards enforce diversity and prevent obvious transformation failures.
8. Insert only a small next segment into the existing NetEase queue.

## Anchor dimensions

The prompt in [`bridge/prompts/music-semantic.js`](../bridge/prompts/music-semantic.js) explicitly considers:

- Vocal Identity: gender/ensemble, timbre, register, true/falsetto/mixed/breathy voice, articulation, spatial distance, harmony;
- Emotional Core;
- Imagery & Atmosphere;
- Rhythm & Motion;
- Dynamics;
- Instrumentation & Texture;
- Melody & Harmony;
- Narrative Feeling;
- Must Preserve / Can Drift.

## Dirty Paws regression

A bad candidate pool may contain multiple tracks by `Guitar Tribute Players`. Even if a catalog similarity system considers those tracks related to the original composition, a vocal, narrative indie-folk Anchor should not naturally turn into six instrumental tribute tracks.

The engine therefore applies both:

- model-level perceptual reasoning;
- deterministic derivative / diversity guards.

`npm test` contains this regression case.

## Debugging recommendation quality

Run a real Session, then:

```bash
curl -s http://127.0.0.1:19428/api/session
```

Inspect:

- `analysis.summary`
- `analysis.fingerprint`
- `analysis.recallDirections`
- `recall`
- final `queue`

This separates four kinds of failure:

1. Anchor understanding is wrong;
2. recall directions are wrong;
3. NetEase candidate recall is weak;
4. ranking / hard guards are wrong.

## Perceptual continuity and world breaks (v0.6)

A recall source is not a distance metric. `heartbeat`, `fm`, `daily`, and semantic search only say **where a candidate came from**. They do not say how close it sounds to the Anchor.

The AI ranker therefore evaluates candidate continuity across vocal identity, timbre, instrumentation/texture, rhythm/motion, dynamics, emotional core, and imagery/narrative. It returns a `perceptual_distance`, confidence and explicit `world_breaks`. At close exploration radii, a world break such as acoustic indie folk → four-on-the-floor EDM is rejected even if the songs share imagery or narrative associations.

If an AI ranking succeeds, From Here will not refill continuity-filtered slots with unevaluated Heartbeat tracks. A shorter coherent queue is preferred to a longer but broken one.
