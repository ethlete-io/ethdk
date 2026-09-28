# query-devtools scan - open findings

Scan of `libs/query-devtools/src/`, `lazy/` and `toggle/` from 2026-09-28, two passes. 1 High, 5 Medium, 30 Low, 4 Spec. Verified 2026-09-28: 6 confirmed, 3 re-rated, 0 refuted, 1 unverified. Skipped: all stories and specs were not read; the second pass read the tab component `.ts` files and grepped their templates, and read `query-devtools-detail.component.html` only around the sub-tabs and the progress bar.

Entry-point boundaries hold: `toggle/` imports only `@ethlete/query` and `@ethlete/components`; `lazy/` references the panel only inside its `@defer`. No `innerHTML`, `bypassSecurityTrust*` or `eval` anywhere; query data renders through interpolation only.

## Shortcut and listeners

- Low: the shortcut listens only on the host document (`query-devtools.component.ts:1681`). With the panel popped out and focus in the pop-up, the shortcut does nothing. Also listen on the pop-up document for the life of the pop-out. S
- Low: inspect mode ends on `Escape` but does not stop the event (`query-devtools.component.ts:1728`), so the same press also closes an app dialog. Clicks on elements without a query pass through to the app (`query-devtools.component.ts:3921`). Call `preventDefault`/`stopPropagation` for both while inspect mode is active. S

## Pop-out

- Low: each pop-out adds a `pagehide` subscription on its window that ends only on component destroy (`query-devtools.component.ts:3327`). After a dock-back the closed window stays referenced, and every further pop-out adds one more. The `load` subscription (`:1897`) never completes when the user closes the pop-up before it loads, and the blob URL is then never revoked. End both on `dockBack`/`closePopup` (e.g. `takeUntil` a pop-out-closed subject). S Re-rated from Medium: true as read, but it leaks one closed `Window` and one small blob per user pop-out click in a dev-only tool.
- Medium: all copy buttons write through the host window's `navigator.clipboard` and host `document` (`query-devtools-clipboard.ts:98`, `:61`). With the panel popped out, the host document has no focus, and Chrome rejects `writeText` from an unfocused document; the `execCommand` fallback runs in the same unfocused document. Resolve `navigator`/`document` from the panel element's `ownerDocument.defaultView`. Not confirmed in a browser. S Unverified: the code does use the host `navigator` and `document`; needs a real headed Chrome with the panel popped out to see whether `writeText` and the `execCommand` fallback fail.
- Low: the cache countdown clock and the Locks poll gate on the host document's visibility (`query-devtools.component.ts:1078`, `:1483`). A pop-out on a second screen freezes when the user switches the main window to another tab. Gate on the pop-up's visibility while popped out. S

## Cost while closed

- Medium: every repository event goes through `pushEvent` even with the panel closed, and each `request-success` measures the response body again (`query-devtools.component.ts:4049`) - the query stats recorder already serializes the same body. `resolveEventQueryId` (`:4072`) then scans all live entries, and on a miss filters and sorts all tombstones, per event. Reuse the recorder's measurement and resolve the owner lazily when a row is rendered. M Verified. The stats recorder calls `measureQueryDevtoolsPayload` on the same body (`query/src/lib/devtools/query-devtools-stats.ts:413`), so a response without `content-length` is stringified twice.
- Low: the view-state effect serializes the whole `PersistedState` (including the JSON expand sets) and writes it to storage on every signal change (`query-devtools.component.ts:1517`). During a dock resize or a float drag, `panelHeight`/`floatRect` change on every `pointermove`, so the panel does a synchronous `JSON.stringify` + `setItem` per move. Write on drag end, or debounce the write. S Re-rated from Medium: the effect runs once per change-detection pass, and the state is a few KB, so a write per `pointermove` is unlikely to cause visible jank.

## Value explorer

- Low: expansion paths join keys with `.` (`query-devtools-json.component.ts:380`, `:228`), so the key `"a.b"` and the nested path `a` -> `b` share one expand state and one annotation lookup. `appendJsonPathStep` has the same problem for "Copy path" and the diff Path column (`query-devtools-diff.ts:130`): `$.content-type` and `$.a.b` are not valid JSONPath for those keys. Bracket-quote non-identifier keys the way `query-devtools-insomnia.ts:151` does. S

## Diff

- Low: `exoticSignature` calls `JSON.stringify` on a `Map`/`Set`/`FormData` outside any `try` (`query-devtools-diff.ts:57-59`). A `bigint` or a cycle inside throws out of the diff computed and breaks the detail drawer. Nested `Map`s stringify as `{}`, so two different ones read as unchanged. S
- Low: `valueAt` uses `key in record` (`query-devtools-diff.ts:70`), which finds inherited members. A key such as `constructor` or `toString` present on one side only reads as "changed to a function" instead of "removed". Use `Object.hasOwn`. S

## Exports and security

- Low: the Insomnia export writes `url`, headers and bodies verbatim (`query-devtools-insomnia.ts:274-275`). Insomnia renders `{{ }}` and `{% %}` in those fields as Nunjucks, so an arg or body string that contains them breaks the request or runs a template tag on send. Wrap such values in `{% raw %}`. S
- Low: the custom API URL is stored and the page reloads without validation (`query-devtools-settings.component.ts:210`). A typo such as a missing scheme makes every request relative to the page origin. Validate with `new URL()` before `pickApiEnv`. S

## Cleanup

- Low: `copyBySelection` restores the selection but not focus (`query-devtools-clipboard.ts:61`); after a fallback copy, keyboard focus is on `<body>`. Restore `document.activeElement`. S
- Low: two clipboard paths exist side by side - `writeQueryDevtoolsClipboard` (json, main panel) and `@ethlete/core`'s `copyToClipboard` (`query-devtools-about.component.ts:3`, `query-devtools-mocks-tab.component.ts:4`). The core one lacks the `http://` fallback. Use one. The copy-tick `Subject` + `switchMap(timer)` block is also repeated in four components. S
- Low: comment volume breaks the AGENTS.md allowlist - about 740 comment lines in `query-devtools.component.ts` alone, mostly rationale and narration, plus section headers at `query-devtools.component.ts:2412,2490,2521,2588,2622,2717`. M
- Low: hardcoded primary colours in component CSS (`query-devtools.component.css:594,676,742`, `query-devtools-settings.component.css:62`, status colours at `query-devtools.component.css:23-25`). Resolve from theme tokens with the literal as fallback. S
- Low: `package.json` lists `@analogjs/vitest-angular` and `@angular/compiler` as peer dependencies; neither is needed by a consumer of the published package. Check whether `@nx/dependency-checks` forces them and drop them. S

## Spec gaps

- Spec: no test for the shortcut matcher (`code` vs `key`, the lazy shell stopping after the handover). S
- Spec: the pop-out has one smoke call (`query-devtools.component.spec.ts:152`) but nothing for dock-back, closing the pop-up before load, or subscriptions left after dock-back. M

## second pass

Reads `yaml.ts`, `openapi.ts`, `typescript.ts`, `query-tree.ts` in full, and the tab components the first pass only grepped. `query-tree.ts` has no open findings.

### OpenAPI export

- Low: `name in ctx.schemas`, `name in used` and `name in schemas` find inherited members (`query-devtools-openapi.ts:229`, `:286`, `:415`). A schema named `constructor` or `toString` gets a `$ref` but no entry in `components.schemas`. Use `Object.hasOwn`. S
- Low: the UUID pattern accepts only versions 1-5 (`query-devtools-openapi.ts:10`), so v6/v7 ids (v7 is a common primary key now) get no `format: uuid`. S

### YAML writer

- Low: `isBlockSafe` rejects only `\r` and `\t` (`query-devtools-yaml.ts:41`), so other C0 controls (BEL, form feed) go raw into a `|-` block. The quoted path uses `JSON.stringify`, which leaves C1 controls and U+FEFF raw. YAML forbids all of these unescaped, so a parser rejects the file. YAML 1.1 readers also split a block at U+0085/U+2028/U+2029. Send strings with any such character to a quoted scalar with `\u` escapes. S

### TypeScript snippet

- Low: `routeOf` puts the pattern into `'...'` and into a template literal without escapes (`query-devtools-typescript.ts:89`, `:100`). A segment with `'`, a backtick or `${` gives a snippet that does not compile or that interpolates. S
- Low: `nameOf` can return a reserved word: `DELETE /` gives `export const delete = ...` (`query-devtools-typescript.ts:72-82`). Suffix the name when it is reserved. S
- Low: `queryParamType` and `queryParamSchema` read a whitespace-only or hex value as a number, since `Number(' ')` is `0` (`query-devtools-typescript.ts:66`, `query-devtools-openapi.ts:155`). A repeated key (`?tag=a&tag=b`) is typed as one scalar, not an array (`query-devtools-typescript.ts:145`). S

### Tabs

- Low: the dropped-entries list tracks by `entry.at` (`query-devtools-cache-tab.component.html:127`), and `at` is the event timestamp (`query-devtools.component.ts:3997`). "Evict all" or a logout drops many entries in the same millisecond, so the keys repeat: Angular logs NG0955 and can reuse the wrong rows. Give each dropped entry an id, or track by `$index`. S Re-rated from Medium: the keys do collide (`unbindAllSecure` emits synchronously and `at` is `Date.now()`), but `@for` handles duplicate keys and only logs the NG0955 dev warning.
- Low: `sessionAge` and `isExpired` read `Date.now()` without a signal (`query-devtools-auth-tab.component.ts:96`, `:106`). "12s ago" and the "token expired" chip do not change while the tab stays open. Read `host.clock()` the way the timeline does. S
- Low: the session-name and token-TTL inputs keep a rejected or clamped value on screen (`query-devtools-auth-tab.component.html:145`, `:305`). A blank name returns early and a clamped TTL can equal the stored one; in both cases `[value]` does not change, so Angular does not write it back. Reset `input.value` after the call. S
- Low: `emitSocketMessage` wraps `JSON.parse` and `emit` in one `try` (`query-devtools.component.ts:2781`), so a throw from a closed socket shows as "Invalid JSON". Parse in its own `try`. S
- Low: the detail sub-tabs use `role="tab"` without `aria-controls`, a `tabpanel` or arrow-key focus (`query-devtools-detail.component.html:248`). Add the tab pattern or drop the roles for plain toggle buttons. S
- Low: `foldedRunsOpen` does not reset when `sel` changes (`query-devtools-detail.component.ts:70`), so the drawer opens the next query with its folded runs already open. Reset it in a `linkedSignal` from `sel`. S

### Cleanup

- Low: `nameOf` and `operationIdOf`, `queryParamType` and `queryParamSchema`, and three `isPlainObject` copies repeat the same logic across `query-devtools-typescript.ts`, `query-devtools-openapi.ts` and `query-devtools-yaml.ts`. The fixes above then land twice. Extract one helper module. S
- Low: none of these four modules is exported from `index.ts`, so their JSDoc is not public API, and most inline comments are rationale (`query-devtools-yaml.ts:98`, `:114`, `:127`, `query-devtools-openapi.ts:93`, `:191`, `:395`, `:435`, `query-devtools-typescript.ts:144`). The tab templates also hold rationale in 13 HTML comments. Cut to the AGENTS.md allowlist. S

### Spec gaps

- Spec: no test runs the exported OpenAPI document through a schema validator, which would catch the `oneOf` and dangling-`$ref` defects above (`query-devtools-openapi.spec.ts`). S
