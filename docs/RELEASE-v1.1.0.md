# From Here v1.1.0 — Listening Judgment

From Here 1.1 is the first release where the recommendation layer is designed around **listening judgment**, not similarity alone. It also replaces the fragile clean-Mac dependency chain with a self-contained macOS runtime.

## Listening Judgment

The central ranking question is now:

> **Does this song deserve to be next?**

For each Anchor, From Here builds both a Music Fingerprint and an Aesthetic Reading: what makes the song arresting, its internal tension, emotional/human state, world, unfinished expression, reductions to avoid, and legitimate axes of surprise.

Real NetEase candidates are then evaluated for:

- perceptual continuity;
- next-song worthiness;
- meaningful difference;
- surprise value;
- obviousness and cliché risk;
- transition logic;
- a role in the listening arc (`hold / deepen / open / turn / land`).

A deterministic aesthetic gate sits after the model. A same-artist or same-style answer cannot win the first step merely because it is highly similar. At normal exploration distance, From Here prefers a meaningful bridge over the safest catalog relationship.

Session refill also receives recent path context, so the route can continue its arc instead of starting over aesthetically every few tracks.

## Constraints now change recall

Natural-language boundaries such as `不要华语` are not treated only as post-filters. They alter where recall searches while preserving the Anchor's musical world. If a hard constraint reduces the pool, From Here may search more broadly for candidates, but it does not silently violate the user's boundary just to fill five slots.

## Anchor identity is separate from candidate playability

A track that is already playing is allowed to be the Anchor even when NetEase catalog enrichment cannot recover a playable song ID. Catalog playability is required for **future queue candidates**, not for the user's current origin.

## Self-contained macOS runtime

The normal current-track path is now:

```text
NetEase desktop app
      ↓
macOS Now Playing
      ↓
/usr/bin/osascript (JXA)
      ↓
MRNowPlayingRequest
      ↓
From Here Bridge
```

No Homebrew, GHCR or downloaded `nowplaying-cli` binary is part of the normal install.

Official macOS Release artifacts carry their own pinned Node runtime and official `@music163/ncm-cli` package. Release CI builds one universal ZIP containing both Apple Silicon and Intel runtimes, then boots that exact artifact on real arm64 + Intel GitHub-hosted macOS runners before publication.

## What users still provide

- NetEase Open Platform `App ID` + `PrivateKey` (a NetEase platform requirement);
- NetEase account authorization on each Mac;
- optionally an AI Provider/model; From Here can follow an existing local configuration or fall back to local ranking;
- Chrome/Chromium extension loading while the project remains outside the Chrome Web Store.

## Upgrade notes

If you tested an earlier 1.1 RC, reload the `Chrome Extension/` directory from the v1.1.0 Release and restart From Here. Existing local NetEase and AI configuration can be reused.
