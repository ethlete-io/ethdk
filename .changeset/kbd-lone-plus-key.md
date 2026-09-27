---
'@ethlete/components': patch
---

`parseKbdKeys`, `et-kbd` and `matchesKbdChord` read a `+` standing alone in a key's place as the plus key, so `mod++` is `mod+plus` instead of `mod`.
