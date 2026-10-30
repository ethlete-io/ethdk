---
'@ethlete/cli': minor
---

A design part can declare `motions` between its states, and a rule can name one. `et design check` fails on a motion between unknown states, a rule naming an undeclared motion, and `setTimeout` in motion code.
