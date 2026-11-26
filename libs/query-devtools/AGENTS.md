# query-devtools

## Why three entry points

ng-packagr flattens a library into one FESM per entry point, which rewrites a `@defer`'s
dynamic import into `Promise.resolve().then(...)` - so a deferred component in the _same_
entry point can never be split out of a consumer's bundle. Only a cross-entry-point defer
emits a real `import(...)`. Hence:

- `@ethlete/query-devtools/toggle` - the floating button, the shortcut label and the
  view-state key. A leaf: it must **never** import the other two, or ng-packagr fails the
  build with a circular entry-point dependency.
- `@ethlete/query-devtools` - the panel. Imports the toggle entry.
- `@ethlete/query-devtools/lazy` - the shell an application mounts. Imports the toggle
  entry statically and the panel entry only through its `@defer`.

Measured: mounting the panel eagerly costs an app ~184 kB gz; through the shell, ~5 kB up
front and the rest on first open. The `tools/treeshake` goldens `query-devtools-panel` and
`query-devtools-lazy` guard both numbers.
