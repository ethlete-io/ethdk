---
'timetrack-app': patch
---

The packaged app is styled again. The production build inlined the critical CSS and deferred the
stylesheet with an inline `onload` handler, which the app CSP blocks, so the sheet stayed on
`media="print"`. The build now links the stylesheet directly.
