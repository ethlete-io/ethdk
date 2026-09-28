# query-devtools scan - open findings

Scan of `libs/query-devtools/src/`, `lazy/` and `toggle/` from 2026-09-28, two passes. 0 High, 1 Medium, 2 Low, 2 Spec. Verified 2026-09-28: 6 confirmed, 3 re-rated, 0 refuted, 1 unverified. Skipped: all stories and specs were not read; the second pass read the tab component `.ts` files and grepped their templates, and read `query-devtools-detail.component.html` only around the sub-tabs and the progress bar.

Entry-point boundaries hold: `toggle/` imports only `@ethlete/query` and `@ethlete/components`; `lazy/` references the panel only inside its `@defer`. No `innerHTML`, `bypassSecurityTrust*` or `eval` anywhere; query data renders through interpolation only.

## Cost while closed

- Medium: every repository event goes through `pushEvent` even with the panel closed, and each `request-success` measures the response body again (`query-devtools.component.ts:4049`) - the query stats recorder already serializes the same body. `resolveEventQueryId` (`:4072`) then scans all live entries, and on a miss filters and sorts all tombstones, per event. Reuse the recorder's measurement and resolve the owner lazily when a row is rendered. M Verified. The stats recorder calls `measureQueryDevtoolsPayload` on the same body (`query/src/lib/devtools/query-devtools-stats.ts:413`), so a response without `content-length` is stringified twice.

## Cleanup

- Low: comment volume in `query-devtools.component.ts` - about 500 rationale lines and the section headers were cut on 2026-09-28; the ~240 kept lines are mostly workarounds and invariants, but several long JSDoc blocks (`resetDevtools`, `popOut`, `requestHeaders`, `chromeTokens`, `resolveEventQueryId`) still carry rationale to trim. S
- Low: the status colours at `query-devtools.component.css:23-25` (`--_et-qdt-success`/`-error`/`-loading`) are hardcoded. There is no global CSS token for them - semantic colours come from DI (`injectErrorTheme()`), which throws in an app with no error theme, while the panel must stay legible in theme-less apps. Decide whether to bind optional semantic themes or keep the literals. S

## Spec gaps

- Spec: no test for the shortcut matcher (`code` vs `key`, the lazy shell stopping after the handover). S

## second pass

Reads `yaml.ts`, `openapi.ts`, `typescript.ts`, `query-tree.ts` in full, and the tab components the first pass only grepped. `query-tree.ts` has no open findings.

### Spec gaps

- Spec: no test runs the exported OpenAPI document through a schema validator, which would catch the `oneOf` and dangling-`$ref` defects above (`query-devtools-openapi.spec.ts`). S
