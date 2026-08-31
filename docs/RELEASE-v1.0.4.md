# From Here v1.0.4 — GHCR installer reliability

This patch fixes clean-Mac installation of the private Now Playing helper.

Homebrew publishes the `nowplaying-cli` bottle through GitHub Container Registry. A direct blob request can return an HTTP 401 challenge before an anonymous pull token is obtained. From Here now performs that OCI registry token exchange automatically, so users still do not need Homebrew, a GitHub login, or administrator privileges.

No recommendation, Session, playback or Path UI behavior changes.
