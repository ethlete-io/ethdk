---
status: accepted
built: c510481c6
decided: 2026-11-17
source: doc-agent session 2026-11-17 (late evening), the human on the pages/sketches false positives
---

# The builder fixes the arrow-anchor and pan-world false positives in the CLI

pages/sketches cannot become build-ready because of two check findings that are not real: ARROW-ANCHOR looks up
`[data-et-control="fit"]` from the root and finds the first of 12 zoom chips' buttons, not the tooltip's own (cause by
probe); CANVAS-UNDER-PANEL reads a 0.25 px rounding translate as a panned world (suspect). The permission check refused
the builder's CLI edit. The doc agent recommended allowing it; the human answered "ok".

- The builder may land the CLI fixes for both rules (`libs/cli/design/arrow-anchor.ts`,
  `libs/cli/src/lib/design/system/arrow-anchor.ts`, `render-check.ts`), each with a spec and a cli changeset.
- No skip and no picture change in pages/sketches hides the findings.
