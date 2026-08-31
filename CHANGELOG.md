# Changelog

## 1.1.0 — Listening Judgment + self-contained macOS runtime

### Listening Judgment

- Added **Aesthetic Reading**: why an Anchor stops you, internal tension, human state, world, unfinished expression, lazy reductions to avoid, and legitimate surprise axes.
- Ranking now asks **“does this song deserve to be next?”**, not only how similar it is.
- Added model outputs for next-song worthiness, meaningful difference, surprise, obviousness and cliché risk.
- Added journey roles (`hold / deepen / open / turn / land`) and model-proposed sequence so a Session becomes a listening arc rather than five isolated winners.
- Added a deterministic Listening Judgment gate + trajectory composer so a high raw AI score cannot force an obvious or aesthetically lazy first step.
- Refill receives recent path context so a Session continues its arc rather than aesthetically restarting.
- Same-artist results are strongly demoted at normal distance; semantic/aesthetic bridge recall is preferred.
- Explicit constraints such as “不要华语” now reshape the recall space instead of merely filtering afterward.
- Anchor identity is decoupled from NetEase candidate playability: a track already playing can remain the origin even if catalog ID enrichment fails.
- Added regression tests for anti-obviousness, next-song worthiness, trajectory variety, constraint-aware recall and unresolved Anchor IDs.

### Self-contained macOS runtime

- Replaced the Homebrew/GHCR/`nowplaying-cli` installation chain with a JXA adapter executed by Apple’s `/usr/bin/osascript`; normal users no longer download a media helper at install time.
- Current-track metadata comes from `MRNowPlayingRequest`; NetEase catalog lookup enriches catalog data asynchronously instead of defining playback truth.
- Official GitHub Releases bundle pinned Apple Silicon + Intel Node.js runtimes and pinned local `@music163/ncm-cli`, so end users do not need Homebrew, Node, npm or a global ncm-cli.
- Added release CI that verifies Node SHA-256 hashes, builds one universal macOS ZIP, then smoke-tests that exact artifact on both arm64 and Intel GitHub-hosted macOS runners before publication.
- Removed the obsolete Bottle/GHCR installer and its regression surface entirely.
- Keeps an independently installed `nowplaying-cli` only as an optional compatibility fallback if the system JXA path ever fails.

## 1.0.3 — Clean-Mac installer fix

- Fixed private Now Playing helper installation on macOS Bash 3.2 (`set -u` / optional bottle metadata).
- Install verifies the media helper really exists before continuing.
- Failed media setup stops onboarding immediately with a specific recovery message.
- Recommendation, Session and UI behavior are unchanged.

## 1.0.2 — NetEase onboarding clarity

- Replaces the raw first-run `ncm-cli configure` prompt with a guided NetEase authorization flow.
- Explains that NetEase desktop-app login and From Here / `ncm-cli` authorization are separate per-Mac states.
- Opens NetEase's official developer onboarding guide and API-key application page for users who do not yet have an App ID / PrivateKey.
- Lets users skip NetEase authorization during install and resume later from `Support/Connect NetEase.command`.
- Side Panel settings now distinguish `网易云 · 待授权` from a broken local component.


## 1.0.1 — Homebrew-free current-track setup

- Removed Homebrew as a requirement for macOS current-track detection.
- `Install.command` now downloads the official `nowplaying-cli` Homebrew Bottle directly into From Here’s private runtime directory when no system helper is available.
- The installer does not write to `/usr/local` or `/opt/homebrew` and does not require administrator privileges for the media helper.
- Bridge and diagnostics now prefer the private helper and fall back to an existing system `nowplaying-cli` when available.
- Replaced the popup/Bridge `brew install nowplaying-cli` error with a product-level “rerun Install.command” recovery message.
- Added third-party attribution and license notice for the upstream GPL-3.0-or-later helper.
- No recommendation, Session or Path UI behavior changes.

## 1.0.0 — First public release

- Promoted the stabilized v0.9.3 product into From Here's first public release.
- Unified public version metadata across the Chrome extension, local Bridge, runtime launchers, tests and release builder.
- Added public maintainer identity and contact information: Jipeng Song / 宋吉鹏, nclcat.com, and jiangji628@gmail.com.
- Reworked GitHub publishing guidance and release notes for the 1.0 launch.
- No recommendation, Session, playback or UI behavior changes from the tested v0.9.3 feature set.

## 0.9.3 — CJK semantics, faster refill, playback robustness

- Added CJK / Chinese lyric semantic context for less-known Anchors so the model can reason about emotion, imagery, narrative and psychological space instead of retreating to catalog relationships.
- Explicitly prevents same album / same artist from becoming a substitute for perceptual similarity at normal exploration distances.
- Added a weak personal-taste prior from favorites / recent listening only as a tie-break; current Session fit still dominates long-term taste.
- Added a hidden reserve pool and earlier refill trigger so the runway can extend before it becomes visibly short.
- Current-track state no longer waits for slow artwork retrieval; metadata updates first and artwork follows asynchronously.
- Added a narrow playback guard to recover if queue mutation accidentally pauses the same track, without interfering with natural song transitions.
- Runtime startup can recognize and replace an older From Here Bridge occupying the local port instead of asking the user to kill it manually.
- Added regression coverage for CJK semantics, weak taste prior, early append refill, playback guard and old-Bridge upgrades.

## 0.9.2 — Transparent toolbar icon

- Re-rasterized Chrome extension icons from the SVG source with true transparent corners.
- Removed the white corner pixels / halos visible on dark browser toolbars.
- No Session, recommendation or playback behavior changes.

## 0.9.1 — Session clarity

- `结束探索` → `结束这一轮`; ending a Session now clearly means From Here stops maintaining that listening path while the current song keeps playing.
- Side Panel uses the Session endpoint as the playback truth source instead of combining different-time media snapshots.
- Real Now Playing continues syncing during long AI jobs; stale job snapshots can no longer overwrite a newer playing track.
- When the Anchor is still playing, `起点` and `你在这里` collapse into one `起点 · 正在播放` state.
- `继续原来的` is remembered by the Bridge, so an ignored external Signal does not flash back on every poll.
- Every surfaced recommendation receives a user-facing reason; implementation language such as recall / rerank / model is hidden.

## 0.9.0 — Identity

- Rebuilt the Side Panel from a card/dashboard layout into a path-based music interface: `origin → you are here → next`.
- Introduced the Open Disc brand mark and From Here Blue (`#1238C8`) across toolbar icon, Side Panel and repository assets.
- Added album-aware ambient artwork: the current cover softly tints the atmosphere without replacing the brand skeleton.
- Replaced the generic range presentation with a visual path control while preserving the existing Session radius behavior.
- Renamed optional feedback in the UI to `后面近一点` and `多一点这个方向`.
- Added high-contrast 16/32/48/128 Chrome icons optimized for small-size recognition.
- Rebuilt the GitHub README as a product landing page with a hero, product demo GIF and clearer user-vs-developer install split.
- Added a 1280×640 GitHub Social Preview, brand source files and `brand/BRAND.md`.

## 0.8.0 — Productized releases

- Split developer Source from the macOS Runtime Release.
- Added `scripts/build-release.sh` to generate a clean user package deterministically.
- Runtime Finder root exposes only Install, Start, Chrome Extension, README-FIRST and Support.
- Bridge/runtime implementation lives in hidden `.from-here/`.
- Runtime Start launches the Bridge as a background process with PID/log management; Terminal can be closed.
- Added guided dependency / NetEase / AI onboarding.
- Runtime release build rejects local secrets, provider-specific personal config and runtime cache.
- Source repository keeps tests, CI, docs, brand sources and contributor tooling.

## 0.7.0 — Continuous Session

- Reframed a Session from a one-shot recommendation action into an autonomous listening runway.
- Added Bridge-owned media monitoring independent of the Side Panel.
- Fixed feedback accidentally skipping the current song; feedback now changes future recommendations only.
- Made positive direction feedback optional rather than required for Session continuation.
- Added rolling auto-refill using the same primary Anchor, radius and Session instruction.
- Added rescue ranking passes when the model returns too few good candidates, without widening the user's perceptual boundary.
- Session UI shows the currently playing recommendation's relationship to the original Anchor.

## 0.6.0 — State, feedback, continuity

- Rebuilt macOS media handling around Bridge-owned last-good state.
- Added resumable async Session jobs and real progress stages.
- Persisted active job IDs so Side Panel reopen can resume an in-progress exploration.
- Removed recall-source-as-distance assumptions; Heartbeat / FM / search are provenance, not musical distance.
- Added per-dimension perceptual continuity, world-break reasoning and deterministic guardrails.
- Added Dirty Paws regression coverage for tribute / instrumental / EDM discontinuities.

## 0.5.0 — From Here

- Established **From Here** as the public product name and origin/distance interaction model.
- Simplified the Side Panel to current track + distance + one optional natural-language instruction + start.
- Added the first Music Fingerprint covering vocal identity, emotion, imagery, rhythm, dynamics, instrumentation / texture, melody / harmony and narrative feeling.
- AI participates in recall planning + ranking while playback remains limited to real NetEase candidates.
- Added deterministic diversity and derivative guards.
- Default AI model follows explicit local / Claude Code configuration when available.
