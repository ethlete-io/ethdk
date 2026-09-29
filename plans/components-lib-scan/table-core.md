# Table core scan - open findings

Scan of `table/headless/`, `table/testing/`, `table/table.component.{ts,html,css}`, `table/table.types.ts`, `table/table.imports.ts`, `table/table-errors.ts`, `table/index.ts` from 2026-09-28. 0 High, 0 Medium, 1 Low (4 fixed: enclosed shadow token 7575a109e, state on `TableFeatureHost` 0142e07ee), 0 Spec (after verification: 7 verified, 1 re-rated). Skipped: the `table-*.directive.ts` feature files (another scan), all specs and stories except spot checks, and a line-by-line read of the 911-line `table.component.css` (the scan checked the layer wrap, hardcoded colours and feature CSS only).

## table.component

- Low: the error cell sets `aria-live="polite"` on an element that is created with its content (`table/table.component.html:155`); most screen readers do not announce a live region inserted already filled. S
