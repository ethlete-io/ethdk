# Open: 3. Feedback, rounds and merge

### 3.41 A `sketch ready` run skipped the auto-merge on a markup-only change - open

- **Pain:** `pages/merge` printed `auto-merge skipped: variant a changes open` after four merges in a row; a second
  `sketch ready` merged it. The first comparison probably ran against a base the merges just before had changed.
- **Not reproduced (2026-10-30):** six runs of `shotsShowNoChange` on `pages/inbox` variant c all returned `true`.
  Fix 3.44 removed a cached-result hazard. On the next skip run `design shot <part> --states --variants` at once and record
  the diff lines. Options: draw the merged side fresh after a base change, or print the changed pixel count with the skip line.

### 3.45 Variant rejection is built, waiting for acceptance in Studio - open

- `et design sketch reject|reopen` and the Studio actions are built (951707680, specs only; the ruling is in ADR 0368).
  Not yet seen in a real browser; the human has not rejected the round 4 variants I and J in Studio yet. Closes when the
  human accepts it there.
