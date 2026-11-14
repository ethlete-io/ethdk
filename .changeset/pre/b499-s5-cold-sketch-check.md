---
'@ethlete/cli': patch
---

`et design sketch check <sketch>` runs the rules only for that sketch, typechecks its variants incrementally and in parallel with the gates, and starts the design server earlier: a cold check drops from about 19 s to 8 s.
