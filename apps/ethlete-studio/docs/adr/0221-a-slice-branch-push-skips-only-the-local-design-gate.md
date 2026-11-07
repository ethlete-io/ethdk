---
status: accepted
built: a277e1c3e
governs: ['.husky/pre-push']
decided: 2026-11-07
source: doc-agent session, grill round after finding 545
---

# A slice branch push skips only the local design gate

Tom: "q1ok". The pre-push design gate refused `slice/*` pushes too, so the draft-PR path of ADR 0216 was closed exactly
while a push of `next` was held for the gate. For `refs/heads/slice/*` the pre-push hook skips only the design gate and
prints a line saying so; the draft PR's CI runs the gate and stays red until it passes. `next` and `main` keep the full
hook, and `--no-verify` stays forbidden everywhere.
