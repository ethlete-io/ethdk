---
'@ethlete/components': patch
---

`et-match-participant` now takes an attribute form (`<a et-match-participant>` / `<button …>`), so a player or
team card can be the click target itself. On an interactive host it names itself after the participant — the
link would otherwise read "FC Berlin emblem FC Berlin" — takes the shared focus ring, and drops the button
chrome. `et-match-card` already worked this way.
