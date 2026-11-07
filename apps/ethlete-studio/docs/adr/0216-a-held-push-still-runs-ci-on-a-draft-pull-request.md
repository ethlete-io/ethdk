---
status: accepted
open: B416
governs: ['.husky/pre-push', '.github/workflows/*']
decided: 2026-11-06
source: doc-agent session 2026-11-06, after finding 540
---

# A held push still runs CI on a draft pull request

While a push of `next` is held (as in ADR 0213), no CI runs, because CI starts only on a push to `next` or on a pull
request, and pre-push leaves typecheck and lint to CI (ADR 0038). A type error from 1518330a1 stayed hidden for hours
until the ci-check before the push (finding 540). From now on, while a push is held, the builder pushes the state to
its own branch with a draft pull request after every slice, so the full CI runs there and `next` stays untouched. A red
run is fixed before the next slice starts. Rejected: local typecheck and lint after every slice (one to three minutes
per slice on Tom's machine) and nothing beyond the ci-check before the push (finds the error hours and many commits
later). Tom: "ok" (option a, recommended).
