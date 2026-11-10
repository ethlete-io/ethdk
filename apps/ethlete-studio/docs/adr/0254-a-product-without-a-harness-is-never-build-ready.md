---
status: accepted
built: 7093784d7
decided: 2026-11-10
source: grill session 2026-11-10 (day shift), B249 question from the builder
---

# A product without a harness is never build-ready

A product with no `harness` in `.ethlete/design/config.json` cannot run the app checks, so every part of it gets the
blocker `no-harness` ("Kein Harness") and reads "Nicht baubereit". `studio-lab` has no harness and no part linked to
app code, so it stays blocked on purpose. It gets a harness only when it gets an app. The human: "q1ok" (option A,
recommended).
