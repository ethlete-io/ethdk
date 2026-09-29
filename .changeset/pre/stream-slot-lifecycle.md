---
'@ethlete/components': patch
---

Stream slots now react to `streamSlotPriority` changes after mount, keep a shared player when one slot rebinds, show their overlays in the slot that holds the player, and tear the player down when consent is revoked.
