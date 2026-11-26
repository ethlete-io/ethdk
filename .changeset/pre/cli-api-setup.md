---
'@ethlete/cli': minor
---

`et api` now runs an API's `setupCommand` itself: `et api setup <name>` on its own, or as an offer
when a command finds the `envFile` missing. `--setup` accepts that offer without the question.
