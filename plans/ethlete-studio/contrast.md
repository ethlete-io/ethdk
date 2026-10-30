# Ethlete Studio: contrast checks

A contrast rule in `design check` and a contrast view in Studio. Context: the colour step B sketch
(`design-system-actions.md` 4.65) had `--text-subtle` below 4.5:1 on `--surface-raised` and
`--surface-overlay`, and only a manual measurement found it.

## Decisions (2026-10-30)

### Measure

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

### CLI

- A ratio below the limit is an error: `design check` fails.
- Exceptions: a field on the part, each entry a selector and a reason, for example
  `{ selector: '.watermark', reason: 'decorative' }`. No markup attribute.
- The rule is active at once. The builder lists every finding in the checkout; Tom decides per
  finding: a new value in a sketch, or an exception.

### Studio

- Marks on the drawing for each text element below the limit, with the measured ratio, and a mark
  for each exception.
- A toggle in the canvas toolbar shows and hides the marks. It shows the number of findings of the
  state even when the marks are hidden.
- The merge comparison shows the lowest ratio per variant.

## Slices

1. CLI rule for text: token pairs in `foundations/colors` and drawn parts; the exceptions field.
2. Studio: the marks, the toolbar toggle and the lowest ratio per variant in the merge comparison.
3. Non-text UI at 3:1: icons, focus rings, input borders.

## Order

The builder's queue (Tom, 2026-10-30), with `design-system-actions.md` numbers:

1. 4.61 slice 1, the targeted redraw.
2. 4.65, the two auto-merge defects.
3. The comment cleanup ("Comment cleanup decisions" in `design-system-actions.md`), with the one-time
   cleanup run on the new code.
4. In parallel: slice 1 of this plan (CLI code), and the CSS work (part sketches). The CSS work is the
   colour cleanup (`--surface-sunken` references, the `sketch-data.css` overrides) and the 4.53
   Tailwind move page by page, then `UTILITY-CSS` in `RULES`.
5. The redo of colour step B: the rule checks its variants and gives the numbers in its drawing.
6. 4.61 slice 2, the draw queue with 4 pages at once.
7. Motion slice 1b.

Slices 2 and 3 of this plan are not in the queue yet.
