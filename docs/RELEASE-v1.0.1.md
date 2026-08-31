# From Here v1.0.1 — Homebrew-free current-track setup

v1.0.1 is a small installation-focused release. Recommendation, Session and Path UI behavior are unchanged from v1.0.0.

### What changed

- `Install.command` no longer requires Homebrew to add macOS current-track detection.
- When no system `nowplaying-cli` is available, From Here downloads the official prebuilt Homebrew Bottle directly into its own private runtime directory.
- The helper does not install into `/usr/local` or `/opt/homebrew` and does not require administrator privileges.
- Bridge and diagnostics prefer the private helper, with an existing system installation as fallback.
- Missing media-helper errors now tell users to rerun `Install.command` instead of showing `brew install nowplaying-cli`.
- Added third-party attribution and license information.

### Why

A clean Mac without Homebrew could install Node and `ncm-cli` yet still fail before From Here could read the current song. That exposed an implementation detail to normal users. v1.0.1 moves that dependency behind From Here's installer.

### Current platform

`macOS + NetEase Cloud Music desktop app + Chrome / Chromium`

Normal users should download:

`From-Here-v1.0.2-macOS.zip`

---

Created by **Jipeng Song / 宋吉鹏**  
Blog: https://nclcat.com  
Contact: jiangji628@gmail.com
