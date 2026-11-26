---
'@ethlete/components': patch
---

Masonry: items are `box-sizing: border-box` and settle even when their reported box cannot match the
assigned width, so a padded card no longer leaves the masonry invisible. Re-sorting the items now
re-packs them in the new reading order.
