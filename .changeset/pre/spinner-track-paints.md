---
'@ethlete/components': patch
---

Fix the spinner's `track` never painting: `--et-spinner-track-color` was registered with an
`initial-value`, so its default could not apply. It now defaults to `currentColor` at 24%, and a
button's determinate loading spinner shows its track.
