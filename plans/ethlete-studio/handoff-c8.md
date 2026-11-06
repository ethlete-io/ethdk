# Handoff: UI builder c8 shut down (ADR 0207)

c0 stays as the only builder. This is c8's open queue and state as of 2026-11-06. Slice notes are in
`plans/ethlete-studio/ui-builder.md`.

## Commits today

- 332e49626 merge of Tom's pick b, components/title-bar@notice-hint (tooltip on "Neu starten").
- cf1441036 app: `etTooltip` with the cause on the restart button; inline `data-code-notice` only without a restart.
  Specs: title-bar 12/12, shell-main 12/12 (its "names the cause" test now reads the tooltip description).
- 1741d8bf8 finding 500: sketch view Fit shows every variant column (`FIT_COLUMNS = 2` removed in app and in
  `pages/sketches/shared/sketch-rows.ts`); e2e case "Fit shows every column of a wide sketch, heads at the top" in
  `apps/ethlete-studio/e2e/canvas.e2e.mjs` bites.

## Queue, in order

1. **Compares for title-bar b (ADR 0203, not done).** Run with `ETHLETE_DESIGN_RESIDENT=0` until c0's S3 fix:
   `yarn et:design compare components/title-bar --product studio`, then every part that embeds it (shell-main, flows,
   inbox, inventory, merge, sketches, system, ...). Likely gap: the design draws the tooltip always open, the real
   `etTooltip` opens only on hover/focus, so the notice states will differ unless compare hovers the restart button.
   That is a tool question for c0 (compare must open the tooltip, or the design marks it as a hover state).
2. **Finding 500 rest.** Tom must confirm the design rule change (Fit: 2 columns -> all). Not reproduced: ~550 px top
   gap and the cropped Aktuell column. Hypothesis: the view reopened with a restored camera (`move()` stores
   {x, y, zoom} after a wheel pan at Fit). Fix would be in camera restore, `system-view/sketch-view.component.ts`.
   `design check --part pages/sketches` and its compare did not run after 1741d8bf8. Tool fix to record: a check
   geometry rule for camera-fit parts plus a 3-variant wide-part fixture.
3. **Five verifies** (studio-menu, start, flows, inventory, merge): blocked on c0's finding 498 (a passing compare and
   the part's own check write the verify record). After its sha, run
   `yarn et:design task <p> --product studio --verify ff698951f` for each. Part checks passed (0 findings).
4. After the push: finding 497 (compare components/canvas-viewport and components/comment-pin), finding 496 (sketch the
   flows "Bildschirmgröße" combobox), finding 489 (sketch components/rail-bubble for the shell-main rail buttons).
5. A2 command palette: sketch components/command-palette (2-3 variants on the SDK palette, empty and no-match states,
   results: parts, sketches, commands), and wire title-search click + Ctrl/⌘+K.
6. A3: compare components/update-dialog, check what is left. A36: explorer as a sketch (STATUS.md A36).

## Uncommitted in the tree

Nothing of c8's. `dist/f500-cli` was removed. `dist/libs/cli` was rebuilt from the working tree during the e2e run.
c8's claims (sketches design part, title-bar component, ui-builder.md) expire at 15:18 today.
