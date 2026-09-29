# forms/cascader + forms/dropzone scan - open findings

Scan of `libs/components/src/lib/forms/cascader/` and `libs/components/src/lib/forms/dropzone/` from 2026-09-28. 0 High, 0 Medium, 1 Low (4 fixed: dropzone labels, 10 MB preview cap and `selectValue: unknown` bfa444ef3, preview bar tokens 7575a109e), 0 Spec (1 fixed, 1 refuted in verification). Skipped: stories and specs (read only to check coverage), the CSS files beyond a layer and colour check, the query internals behind `executeUntilSettled$`.

## cascader - cleanup

- Low: `internals/cascader-tree` is re-exported from the public headless barrel, which publishes `toChildrenObservable`, `toSearchObservable`, `toPathObservable`, `nodesEqual` and `indexOfNode` (`forms/cascader/headless/index.ts:9`). Export only the types and `canHaveChildren`/`defaultCompareWith`. S

## Refuted in verification

- Single-mode replace deletes the old file before the new upload succeeds: `apps/docs/components/dropzone.md:65,124` documents this as intended (the value clears until the new upload succeeds, and a replace deletes like a remove).
