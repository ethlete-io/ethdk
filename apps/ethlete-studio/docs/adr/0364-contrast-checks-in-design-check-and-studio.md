---
status: accepted
built: 15e2dc85c
decided: 2026-10-30
source: plans/studio/contrast.md (trimmed in B597), section "Decisions (2026-10-30)" and "Findings decisions", rulings of the human
---

# Contrast checks in design check and Studio

A contrast rule in `design check` and a contrast view in Studio. The rule (`CONTRAST`, slice 1) and the non-text check
at 3:1 (slice 3, 8b5b314d3) are built. The Studio marks (slice 2) are open in `plans/studio/contrast.md`.

## Measure

- Two sources, both checked:
  - **Token pairs:** `foundations/colors` declares an explicit list of the text tokens allowed on each
    surface, for example `--text`, `--text-muted`, `--text-subtle` on every surface, and `on-accent` on
    `accent` and `accent-active`. The rule computes each pair. The part's drawing shows the list as a
    table with the ratios. No all-against-all matrix: it reports pairs that never occur.
  - **Drawn parts:** in every state of every part, each text element against its effective
    background, with semi-transparent layers composited.
- Standard: WCAG 2 AA. 4.5:1 for normal text, 3:1 for large text (WCAG definition) and for non-text
  UI. No APCA for now.
- Disabled states are exempt, as in WCAG.
- All products, not only `studio`.

## CLI

- A ratio below the limit is an error: `design check` fails.
- Exceptions: a field on the part, each entry a selector and a reason, for example
  `{ selector: '.watermark', reason: 'decorative' }`. No markup attribute.
- The rule is active at once. The builder lists every finding in the checkout; the human decides per
  finding: a new value in a sketch, or an exception.

## Studio

- Marks on the drawing for each text element below the limit, with the measured ratio, and a mark
  for each exception.
- A toggle in the canvas toolbar shows and hides the marks. It shows the number of findings of the
  state even when the marks are hidden.
- The merge comparison shows the lowest ratio per variant.

## Rulings on the first findings

- The drawn disabled samples of `foundations/colors` carry `aria-disabled="true"`, so the rule exempts them; no part
  exception.
- The label of a disabled control is exempt too (a `label[for]`, a wrapping `<label>` or an `aria-labelledby` target of
  a `:disabled` or `aria-disabled="true"` control).
- A resolved inbox row looks paler through colour (`--text-muted`), not through transparency; open and resolved rows
  must not look the same.
- The selected comment pin has the background `var(--accent-active)` under `--on-accent` initials.
