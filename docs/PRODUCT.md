# From Here — Product thesis

## Preference ≠ Intent ≠ State

A long-term preference model answers “what does this person generally like?” From Here answers a narrower question: “what belongs to the world this person wants to inhabit **right now**?”

A human state is not a scheduled state machine. A timbre heard in a shop, a memory, weather, a voice, or a single chord can redirect attention before the user has articulated a new preference.

`Signal → State → Intent → Session`

The product must accept that switch instead of defending the previous recommendation path.

## The primary action: From Here

The user does not need to explain why the old Session is over. The current song can simply become a new origin.

A Session contains:

- one primary Anchor;
- one exploration distance;
- one optional natural-language instruction;
- temporary positive / negative signals;
- a natural end.

Session state is disposable by default.

## NetEase vs From Here

NetEase answers: “given this track and this listener, what may be relevant?”

From Here answers: “of those possibilities — plus a few AI-guided recall directions — what belongs **now**?”

Therefore From Here does not replace the catalog or playback stack. It controls a small slice of the next queue.

## UI principle

The system may internally use fingerprints, recall sources, model providers and scores. The user should not have to operate those structures.

Main UI:

- current song;
- `留在这里 ↔ 去看看`;
- optional sentence: `更冷一点，不要华语，保持人声`;
- start.

Everything else belongs to Settings / diagnostics.

## Feedback

`靠近起点` means: the current song may be good, but it is too far from the current Session. Increase Anchor invariants.

`沿这个方向` means: keep the primary Anchor, but treat the current track as a positive secondary signal.

This is deliberately different from Like / Dislike.

## Brand

From Here names the human action, not the recommendation mechanism.

The visual grammar is `origin → distance`:

- `●` is the current state;
- outward paths are possible worlds;
- a new signal can create a new `●` immediately.
