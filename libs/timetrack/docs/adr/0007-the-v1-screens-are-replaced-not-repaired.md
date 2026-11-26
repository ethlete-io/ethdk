# The v1 screens are replaced, not repaired

ADR 0004 names `stream/` the v2 pipeline and `correlate/` the one it replaces. This extends that to
the app: the `today` route is v2, and the `day`, `start`, `week` and `sync` routes are v1. They are
redone on top of the Today view's reporting, not repaired in place. No shared layer is extracted
between `stream/` and `correlate/`.

A shared layer is the obvious answer and it is the wrong one. The two builders read different
sources — `streamDay` reads `window`, `idle`, `git` and `agent-session`, while `correlateDay` also
reads `editor`, `calendar` and `gitlab` — so they look like one system with a bug. Extracting the
event-to-role mapping they duplicate would marry the new foundation to code with a delete date and
spend the work twice.

The drift is already measurable. `stillFocused`, `windowsSeenThroughMs` and `ownAppIds` landed in
`streamDay` on 2026-09-08 and exist nowhere in `correlate/`, so the v1 screens still read a still
focus as unobserved time and still count the app's own window. The fix looked done because half the
app had it.

## Consequences

- A defect found in `correlate/`, `sessionize`, `meetings` or `merge-request-activity` is fixed only
  if a v2 screen shows it. Otherwise it is recorded and left.
- A fix to `streamDay` is never ported to `correlate/`. `evidenceFor`, `repoStateFor`, `reposByName`,
  `repoNamedIn`, `TITLE_SEGMENTS` and `addEvidence` stay duplicated until the v1 side is deleted.
- `correlate/` is deleted per route, as v2 replaces each one — not in one pass.
- The store layer is **not** v1. A collector, an exclusion rule and the title redaction serve both
  builders, so a defect there is fixed for real.
