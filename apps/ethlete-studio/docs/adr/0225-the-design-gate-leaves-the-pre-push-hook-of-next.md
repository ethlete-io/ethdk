---
status: accepted
open: B295
decided: 2026-11-07
source: doc-agent session, after Tom asked why the work hangs on git hooks again (finding 560)
---

# The design gate leaves the pre-push hook of next

Tom: "Wieso hängen wir eigentlich schon wieder bei git hooks? Hatten wir uns nicht dagegen entschieden? Wollten wir die
nötige Technik nicht in Studio einbauen?", then "Ok" on option a. ADR 0036 already moved the Studio checks out of the git
hooks, but during the push-safety work the design gate came back into the pre-push hook of `next` and `main` (ADR 0217,
ADR 0221). It leaves again: an uncompared or drifted part shows as a problem on the part in Studio and makes it not
build-ready (ADR 0037), and CI runs the design gate after the push as the backstop. A red CI run on `next` is accepted.
The slice-branch exception of ADR 0221 is no longer needed.
