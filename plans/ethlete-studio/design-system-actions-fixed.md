### 5.34 `StateGrid` has no row groups - closed, not built

- **Pain:** variant c of "Many states" groups rows ("States by interaction", "Rest only") by
  inference; a grouping by kind and end mark cannot be declared.
- **Fix option:** optional `groups` on `StateGrid`, only if Tom picks a grouped look.
- **Decision (Tom, 2026-10-30):** not built. Folded unchanged states and the question-first
  review view (4.48) already give the overview.

### 5.50 Studio's danger colour fails contrast on its dark surfaces - fixed

- **Pain:** `--color-et-danger` is rgb(220 38 38): 3.96:1 on `--surface-sunken`, 2.92:1 on
  `--surface-overlay`. Below AA for text everywhere and below 3:1 for a mark on overlay.
- **Fix options:** 1. a `foundations/tokens` sketch that gives `danger` a Studio tone, about
  oklch(0.68 0.19 25) (recommended). 2. only a `--danger-text` alias.
- **Fixed earlier (`96eff57ce`), verified 2026-10-30 by the grill session:** the signal red
  variant a is merged; `foundations/colors/colors.css` sets `--color-et-danger` to
  rgb(247 93 89). The entry was stale.

### 5.25 Studio has no warning colour theme - fixed

- **Pain:** tree-row's warning mark needs a semantic warning colour. Studio's tokens had only the
  accent theme and `danger`, so the merged `tree-row` drew the mark in `--color-et-danger`.
- **Fixed earlier (`9594be0c0`), verified 2026-10-30 by the grill session:** the warning colour is
  merged, and `components/tree-row/tree-row.css` draws the mark in `var(--warning)`. The entry was
  stale.

### 5.45 Agent logos exist in three copies - fixed

- **Pain:** a component cannot import from a page, so the `components/comment-pin` sketch holds a
  third copy of the agent logos (after `pages/inbox` and `pages/sketches`), with brand hex colours
  in TS.
- **Fix option:** the agent logos become a foundation asset: an icon set in `assets/` with a named
  export in a foundations part, then the pages and the pin import it (recommended, follows 5.13).
- **Fixed earlier (`9594be0c0`), verified 2026-10-30 by `claude-sdk58`:** `foundations/agent-logos`
  holds the logos, with `assets/agent-*.svg`. `pages/inbox`, `pages/sketches` and
  `components/comment-pin` all import `agentLogo` from `@system/foundations/agent-logos`. No copy
  is left in the product; the entry was stale.

### 3.20 A product switch keeps the entry of the old product - fixed

- **Pain:** after a switch from studio-lab to studio, with a sketch of the old product open, the
  sidebar showed the sketches of studio-lab in the list of studio. The old sketch view stayed. A
  click on "Merge b" ran against the wrong product, and Studio refused it.
- **Where:** the product switch in the System view. Seen one time, from a script race. Not
  reproduced.
- **Fix option:** reset the selected entry when the product changes.
- **Cause:** the System view kept the sketch list and the flow list of the old product until the
  list of the new product answered. In that time the view paired the new product with an old sketch,
  so the tree and "Merge" used the old entry.
- **Fix:** each list read carries the product it was read for. A read for another product counts as
  no list yet. The selected entry stays as it was.
- **Verified 2026-10-30 by `claude-sdk58`:** a new spec in `system-view.component.spec.ts` switches
  from `web` to `lab` while the `lab` sketches never answer. It failed before the fix (the `web`
  sketch stayed) and passes after it.
