---
'@ethlete/components': minor
---

Stream slots expose playback controls next to their state: `slot.play()`, `pause()`, `mute()`, `unmute()` and `seek(seconds)` drive the slot's player and return whether the command was sent, and `slot.capabilities()` reports what the player supports (`NO_STREAM_PLAYER_CAPABILITIES` until it exists). Content projected into a slot reaches them through `inject(STREAM_PLAYER_SLOT_TOKEN).slot`. A second slot bound to the same player id now reads that player's state and controls it, instead of reporting the default state.
