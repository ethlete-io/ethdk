---
'@ethlete/components': major
---

Breaking: remove `YoutubePlayerSlotDirective` and `YOUTUBE_PLAYER_SLOT_TOKEN`; use `YoutubePlayerSlotComponent` or `createStreamPlayerSlot`. `et update` runs a migration that drops the directive and marks the other uses.
