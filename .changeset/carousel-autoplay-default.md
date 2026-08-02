---
'@ethlete/components': patch
---

Fix `<et-carousel>` autoplaying by default: `autoplay` is the component's own input now and defaults
to `false`, which is what it always documented. Add `autoplay` to a carousel that should play. On the
headless directive, read the new `isEnabled()` for what is in effect.
