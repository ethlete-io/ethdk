---
'@ethlete/cli': patch
---

The design pictures now cancel running infinite animations, as the app pictures already do, so an `animate-pulse` or a looping CSS animation no longer fails the compare as a pixel diff.
