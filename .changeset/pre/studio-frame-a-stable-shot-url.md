---
'@ethlete/cli': patch
'ethlete-studio': patch
---

Studio picture URLs stay the same across page switches, so a page shown before paints its stored pictures at once. Draw ranking moves to `POST /__design/view`; shots carry an ETag and answer 304.
