---
'@ethlete/cli': patch
'ethlete-studio': patch
---

The design check reads a bare boolean attribute (`<x empty />`) as a `true` source for STATE-NO-SOURCE, so templates keep the static attribute the lint rule asks for.
