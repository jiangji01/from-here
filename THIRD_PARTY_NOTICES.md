# Third-party notices

From Here source code is MIT licensed. Official macOS Release ZIPs may bundle the following independent runtimes so end users do not need to install a developer toolchain.

## Node.js

- Project: https://nodejs.org/
- Pinned release runtime: 22.22.0
- License: MIT (plus notices for bundled Node.js dependencies, as included in the official Node.js distribution)
- Purpose: execute the local From Here Bridge and the official NetEase CLI

The Release contains the official Apple Silicon and Intel Node binaries obtained from nodejs.org. Their SHA-256 checksums are pinned in `.github/workflows/release.yml`. The original Node.js `LICENSE` file is shipped next to each binary.

## @music163/ncm-cli

- Package: https://www.npmjs.com/package/@music163/ncm-cli
- Pinned release version: 0.1.7
- License: MIT
- Purpose: NetEase Cloud Music search, recommendation recall, authorization and queue/player control through the official open-platform CLI

The Release keeps ncm-cli as a separate command-line program invoked by From Here. Its package and runtime dependencies are stored under the hidden `.from-here/runtime/ncm/` directory; package license files remain in the installed dependency tree.

## macOS current-track detection

From Here 1.1.0 does **not** bundle or download `nowplaying-cli`, a Homebrew Bottle, or any other media binary. Current-track metadata is read through the system `/usr/bin/osascript` process using a small JXA script and Apple's private `MediaRemote.framework` / `MRNowPlayingRequest` interface.

Because MediaRemote is private Apple API, future macOS versions may change its behavior. If the system JXA path is unavailable and the user has independently installed `nowplaying-cli`, From Here can use it only as an optional compatibility fallback; it is not distributed by From Here.
