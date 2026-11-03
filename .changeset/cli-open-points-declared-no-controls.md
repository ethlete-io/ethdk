---
'@ethlete/cli': patch
---

A part that declares an explicit `controls: {}` no longer gets a "no controls declared" open point; a part without a
`controls` key keeps it.
