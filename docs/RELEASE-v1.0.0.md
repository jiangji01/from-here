# From Here v1.0.0 — First public release

**Start with what you're hearing. Decide how far to go.**

From Here is a session-aware music exploration layer for the moment you are in right now. Instead of turning your entire listening history into one permanent taste profile, it treats the currently playing song as a temporary origin and builds a continuous path outward from there.

### What 1.0 includes

- a path-based Chrome Side Panel built around `origin → you are here → next`;
- a controllable exploration distance from `留在这里` to `去看看`;
- optional natural-language Session constraints;
- AI Music Fingerprint + recall planning + ranking over real NetEase candidates;
- perceptual continuity and world-break guards;
- a rolling runway that continues automatically without per-song confirmation;
- CJK / Chinese lyric semantic context for less-known songs;
- optional feedback that changes future recommendations without interrupting the current track;
- macOS playback-state recovery, background refill and local Bridge lifecycle management;
- a separate macOS Runtime package for users and full Source repository for contributors.

### Current platform

`macOS + NetEase Cloud Music desktop app + Chrome / Chromium`

The current setup still uses a local helper and manually loaded Chrome extension. Zero-terminal setup and broader music-service adapters are natural next steps after 1.0.

### Download

Normal users should download:

`From-Here-v1.0.0-macOS.zip`

Developers can clone or fork the repository and run the full regression suite with:

```bash
cd bridge
npm test
```

---

Created by **Jipeng Song / 宋吉鹏**  
Blog: https://nclcat.com  
Contact: jiangji628@gmail.com
