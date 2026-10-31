# Parallel backlog - decisions: zoom chip, Codex, e2e, new Studio UI, surface theming

## Zoom chip tier (Tom, 2026-10-30, Q45)

The zoom chip is `components/zoom-chip`, not `elements/zoom-chip`: an element may not import another element
(`UPWARD-DEPENDENCY`). Before Tom merges r1 (3d00519df): its `−`, `+` and `Fit` buttons are declared controls with
hover, active and focus, and `design complete components/zoom-chip` passes. The zoom values (100 %, 250 %, 25 %)
are content states, not the interaction coverage Q43 asked for.

- **r2 ready (2026-10-30, 1534846c9):** variant b declares −, percent, + and Fit as button controls in 16 states;
  `design complete` passed in a scratch copy with b merged. Not checked by eye. Waits for Tom's merge in Studio.

### Codex model table decisions (Tom, 2026-10-31, Q186)

The `ethlete-codex-subagent` skill and its wrapper still name the 5.6 models. The current ids (from
`~/.codex/models_cache.json`) replace them:

- `gpt-6-luna`: lookups and greps.
- `gpt-6.1-terra`: the default for real work, and the default of `codex-agent.mjs`.
- `gpt-6.1-sol`: only after asking Tom; his Sol limit runs out fast.
- `gpt-6-astra`: only after asking Tom.

Drop `gpt-5.6-*` and `gpt-6-sol` from the skill. The context-warning hook gets a `gpt-6.1` entry with a 500k
window (the 6 and 5.6 models keep 272k). Edit the source in `libs/agent-rules/content`, then `yarn agents:sync`.
Builder: `ethlete-sdk-57`, a small slice after the running ones. Built in 6300dac7e.

### Ink e2e and control frame decisions (Tom, 2026-10-31, Q187-Q188)

- **Q187 (e2e follows the merged ink look):** the merged b picks give badge, banner and the progress-steps
  connector an ink edge. Rewrite `badge.e2e.ts:209/219` (tonal/filled no border), `banner.e2e.ts:73` (24 % primary
  wash) and `progress-steps.e2e.ts:186` (failed connector = own primary) to assert the theme's ink. The brand loader
  test stays; `--et-brand-loader-accent` stays an override. Builder: `ethlete-sdk-33`.
- **Q188 (control frames use the interaction token):** every control frame uses `surface-interaction`, the token
  of the passing `et-input` frame; container edges keep `surface-border`. SDK: the resting `et-selection-card` edge
  (`selection-card-styles.component.css:47`) and the unchecked checkbox and radio boxes. Studio:
  `border-et-surface-interaction` on the project picker (`shell-main.ts:74`), the comment textarea box (inbox b, c,
  d) and the inbox c segmented. Then shell-main and pages/inbox can be marked ready. Builder: `ethlete-sdk-33`.

### Open point: Codex through the wrapper or the agent-sessions inbox (Tom, 2026-10-31)

Builders now start Codex through `codex-agent.mjs` (a blocking background command that returns only the final
message). The alternative is a Codex tmux session reached through the `ethlete-agent-sessions` mailbox. Tom wants to
weigh which makes more sense later; keep the wrapper until then. Needs its own grill round, no build now.

### Open point: restart a session after the usage limit resets (Tom, 2026-10-31)

A session that stops at the Claude usage limit saves a handoff but cannot clear and resume itself: the
`ethlete-agent-sessions` `restart` command types `/clear` and the resume prompt at once, and the fresh session would
hit the same limit. Tom then has to resume each session by hand after the reset. Wanted: a way to schedule the
restart for a time (for example `restart <name> --at <time> '<prompt>'`), and a rule in the handoff skill that a
session at the limit schedules its own restart for the reset time. Tooling gap, after the current builder queue.

### Path to the new Studio UI (Tom, 2026-10-31, Q189)

Tom wants to use the new Studio UI soon instead of the patched current one. Builder `ethlete-sdk-57` order:

1. Friction slice B (small, as queued).
2. Close the MVP tooling: the open-point list per part with "ready" refused while it is not empty (Q155, Q156;
   slice 3) and the part-to-component link (Q157).
3. Go, task and compare (Q158-Q160) with the merged `elements/shell-main` (variant b) and `pages/inbox` (variant d)
   as the first pilot. Their implementation in `apps/ethlete-studio` starts only through this flow; this decision
   is Tom's go for these two parts (Q153).
4. After that: Q174, `sketch report --reopen`, Q173 migration, slice 4, the scheduled restart.

The global chat panel has no Studio design yet. Tom: it stays out of the MVP and gets its design after it.

### Implementation is a design test too (Tom, 2026-10-31)

Building a merged design into `apps/ethlete-studio` (the shell-main and inbox pilot first) stays a product test, like
designing Studio in Studio. Every implementation slice reports, next to what it built:

- **Missed design:** a state, a part or a behaviour the design does not show, so the agent had to decide it.
- **Invented:** anything the agent built that the design does not contain.
- **Worked around:** places where the agent had to build around the design, the tool or the SDK.
- **Too big:** a component that grew large and should have been split into `elements/` or `components/` parts.

The agent does not resolve these alone: a missed design or an invention becomes a design question for Tom (through
the lead), a workaround becomes a friction fix to the tool or the SDK, and a too-big component becomes a split in
the design first. Where the system can detect one of these (for example a compare diff, or a class or element with
no counterpart in the design), the go/task/compare flow reports it itself.

### Surface hover and open-point list decisions (Tom, 2026-10-31, Q190-Q191)

- **Q190 surface hover token:** add `--surface-hover` to `.ethlete/design/studio/foundations/colors/colors.css` as
  `color-mix(in oklch, var(--text) 6%, transparent)`, plus the Tailwind token `--color-surface-hover`. Pressed stays
  at 10 %. Hover of a plain surface uses `hover:bg-surface-hover`, not `hover:bg-surface-raised` (raised means
  height, not interaction).
- **Q191 open-point list in Studio:** 33 sketches where Studio shows the open-point list; Tom merges the sketch. It
  is built after the pilot, through go/task/compare. Until then the CLI and `GET /__design/open-points` show the
  list. No UI for it before the merged sketch.

### Studio uses the SDK surface theming (Tom, 2026-10-31, Q197)

Tom: "wir nehmen das sdk surface theming system kein wenn oder aber." Studio parts use the SDK surface theming
(`libs/core` surface themes, the `theming` skill), not their own tier classes:

- Every raised or floating area sets a surface scope (`dark`, `dark-elevated`, `dark-elevated-2`, generated from
  `foundations/colors` by `yarn studio:themes`) and draws its background, text, border and interaction states from
  the `et-surface` tokens of that scope. No direct `bg-surface`, `bg-surface-raised`, `bg-surface-overlay` tier
  classes in parts.
- Hover and pressed come from `--et-surface-interaction-solid` mixes as in the SDK. This replaces Q190: the Studio
  `--surface-hover` and `--surface-pressed` tokens go away.
- `bg-surface-sunken` (alias removed on 2026-10-30, still in `pages/start`, `pages/flows`, `pages/system`) is fixed
  first, as part of the migration.
- Q49 (shadow on the Q191 popover) is folded in: the popover follows the SDK overlay pattern like every other floating
  panel.
- The migration of the merged parts is a mechanical follow-up of this decision (design accept "Q197" per part, as
  Q188/Q190). A part where the scope changes the look visibly goes to Tom as a round.

### The SDK theming systems are enforced, not remembered (Tom, 2026-10-31, Q198)

Tom: the surface and the colour system were named many times, and Studio still grew its own parallel tokens. "Das
darf NICHT wieder passieren", and agent memory is no fix, because another person does not have it. So the rule lives
in the tool and in the repo, where every person and every agent meets it:

1. **Make the wrong thing impossible.** A design product's foundations define only the inputs of the SDK themes
   (surface themes and colour themes). The product stylesheet exposes no own tier or accent utilities (`bg-surface-*`,
   `bg-accent*`, `text-accent-*`, `var(--accent*)`, `var(--warning)`, and so on); parts can only reach the `et-surface`
   and `et-theme-color` tokens. Q197 extends to colour: parts use the SDK colour theming (`et-theme-color-*`, colour
   scopes, `injectSemanticColorTheme` types), not `--accent`, `--warning` or `--danger`.
2. **Errors, not warnings.** `et design check` fails a part on a raw colour outside foundations, on a utility that
   emits no CSS (CLASS-UNDEFINED), and on a denied class. `sketch ready`, merge and `design accept` refuse while one is
   open. No per-part opt-out; the only exemption is the foundations part itself.
3. **The tool tells every agent.** The task text that `et design` hands an agent (sketch, round, task) names the two
   theming systems and points to the `theming` skill. The rule also goes into the portable agent rules
   (`libs/agent-rules/content/`) for the design workflow, so other repos and people get it with `ethlete-agents sync`.

**As built (builder, 2026-10-31), steps (a) and (b); the switch to errors (c) waits for the Q197 migration:**

- `d3ef77ac3`: `DENIED-CLASS` checks the classes (without variants, `!` and opacity) and `var()` references of each
  part outside `foundations/`; `DENIED-STYLESHEET` checks the product's own stylesheets outside `foundations/` (custom
  properties, `@theme --color-*`, `@utility`, class rules). The patterns are regular expressions in
  `products.<name>.deniedClasses` of `config.json`, each with its fix text; Studio has four. Both print as warnings in
  `check`; a sketch fails on a hit it adds. `HARD-CODED-COLOUR` was already an error outside foundations.
  Read-only run on Studio: 30 part hits and 10 in `apps/ethlete-studio/src/styles.css`.
- `9f63947dc`, `1ab53ab75`: `sketch new` and `task` print one theming line (`system/theming-text.ts`). `sketch round`
  prints no agent text, so it has none.
- `fac71a294`: the design-exploration skill in `libs/agent-rules/content/` states the rule. It cannot link the
  `theming` skill, because the sync emits that skill only for consumers.
- Verified: the specs of both rules and both texts. Not verified: `et design check` on the real product, which
  writes into `.ethlete/design`.

### Surface migration look calls (Tom, 2026-10-31, Q199-Q201)

- **Q199, sunken prompt box:** the prompt box in `pages/system` and `pages/flows` takes the SDK sunken surface token and
  is solid dark (rgb 15); the dotted grid no longer shows through. The two held lines drop the own
  `bg-surface-sunken` class.
- **Q200, comment-pin hover:** the pin uses the SDK interaction tint on its own surface, so hover and pressed get
  lighter than rest, like every other part. Then delete the own `--surface-hover` and `--surface-pressed` tokens.
- **Q201, interaction border:** `border-et-surface-interaction` keeps the real interaction grey (rgb 164) in zoom-chip,
  shell-main and inbox. The near-white border before 71beccb12 was a missing token, not a look.

### The open-points popover is a real SDK overlay (Tom, 2026-10-31, Q202)

The open-points popover in `pages/system` (under the "N offen" chip) was a hand-built panel: an
`et-surface--dark-elevated-2` scope, an arbitrary background, the interaction border and an own shadow fallback. It
did not follow the surface system. It is rendered through `ng(...)` as the real SDK anchored overlay, like
`elements/studio-menu` renders the real `et-menu`, so surface, border (`--et-overlay-surface-border-color`), radius and
shadow come from the SDK. The list inside stays. It reaches Tom as a one-variant sketch, because the look changes, and
he merges it.
