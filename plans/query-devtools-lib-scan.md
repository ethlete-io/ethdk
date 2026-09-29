# query-devtools scan - open findings

Scan of `libs/query-devtools/src/`, `lazy/` and `toggle/` from 2026-09-28, two passes. 0 High, 0 Medium, 1 Low, 0 Spec. Verified 2026-09-28: 6 confirmed, 3 re-rated, 0 refuted, 1 unverified. Skipped: all stories and specs were not read; the second pass read the tab component `.ts` files and grepped their templates, and read `query-devtools-detail.component.html` only around the sub-tabs and the progress bar.

Entry-point boundaries hold: `toggle/` imports only `@ethlete/query` and `@ethlete/components`; `lazy/` references the panel only inside its `@defer`. No `innerHTML`, `bypassSecurityTrust*` or `eval` anywhere; query data renders through interpolation only.

## Cleanup

- Low: the status colours at `query-devtools.component.css:23-25` (`--_et-qdt-success`/`-error`/`-loading`) are hardcoded. There is no global CSS token for them - semantic colours come from DI (`injectErrorTheme()`), which throws in an app with no error theme, while the panel must stay legible in theme-less apps. Decide whether to bind optional semantic themes or keep the literals. S
