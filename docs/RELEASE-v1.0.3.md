# From Here v1.0.3 — clean-Mac installer fix

v1.0.3 is a focused installation reliability release. Recommendation, Session and UI behavior are unchanged from v1.0.2.

## Fixed

- Fixes the private macOS Now Playing helper installer on the Bash 3.2 environment still shipped by macOS. Optional bottle metadata can no longer trigger an `unbound variable` crash.
- The main installer now verifies that the media helper is actually executable before it proceeds to NetEase / AI onboarding.
- A failed media-helper install now stops the installation with a specific recovery message instead of letting Chrome later report a vague missing-component state.

## Why

A clean company Mac exposed a real first-run failure: the helper metadata had downloaded successfully, but the install script exited before extracting it. The rest of onboarding continued, which made the installation look complete even though current-track detection was unavailable.
