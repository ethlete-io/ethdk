---
'@ethlete/cdk': patch
---

Change overlay overshooting safe space from changing the width or height of the whole overlay to a pseudo element attached to the et-overlay div. This means your overlay will be 50px bigger than before. This only affects overlay sheets (bottom-sheet, left-sheet, right-sheet, top-sheet).
