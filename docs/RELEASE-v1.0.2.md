# From Here v1.0.2 — NetEase onboarding clarity

A small but important onboarding release.

The NetEase desktop app login and the local `ncm-cli` authorization are separate. v1.0.2 no longer drops first-time users into a raw `App ID` prompt. Instead, From Here explains why NetEase requires API credentials, opens the official onboarding/application pages when needed, and lets users skip and resume later.

## Changed

- guided NetEase authorization before `ncm-cli configure`;
- official onboarding + application links;
- resumable `Support/Connect NetEase.command`;
- Side Panel distinguishes `网易云 · 待授权` from component failure;
- no changes to recommendation, Session or UI identity behavior.
