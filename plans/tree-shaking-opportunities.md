# Tree-shaking opportunities across @ethlete/*

**Status: phases 1–5 shipped** (phase 5's four follow-ups implemented 2026-08-01: form-field styles
split, opt-in query persistence/sync, English-only query-error default, opt-in RTE link editor — see
the bottom of this file for measurements and what remains). This is the execution plan; the full evidence lives
in [`tree-shaking-research-measurements.md`](./tree-shaking-research-measurements.md) (bundle
decomposition, simulated fixes, per-feature cost matrix) and
[`tree-shaking-research-static.md`](./tree-shaking-research-static.md) (per-finding `file:line`
inventory). Measurement tooling is committed under `tools/treeshake/` (see its README).

## Scope rules (from the user)

- **Skip `libs/cdk` and `libs/contentful` entirely** (cdk is maintenance-mode; contentful awaits its
  own refactor).
- **Skip legacy query**: `libs/query/src/lib/legacy/**` (V2 client, 60 files / 7,154 LOC) and the
  reactive-forms `query-form/` (superseded by `query-form-signals`). Current gen = `http/`, `auth/`,
  `gql/`, `ws/`, `devtools/`, `pipes/`, `query-form-signals/`.
- **Breaking changes are fine in `components` and `query`.**
- **Breaking `@ethlete/core` needs a migration generator / AI-assisted migration** (Nx-style) —
  and since the whole SDK is currently in a changesets **major pre-release** (`.changeset/pre.json`,
  tag `next`), there is **no deprecation cycle**: change the API outright and ship the generator in
  the same release. The infra already exists: each lib ships Nx generators
  (`generators/generators.json` as ng-package assets); precedents are `@ethlete/core:migrate-to-v5`
  (which already contains a `create-provider.ts` codemod to build on) and
  `@ethlete/query:migrate-to-query-v3` (with `--projects` scoping and the "write
  `*-migration-tasks.md` with stable ids for what the codemod couldn't finish" AI-handoff pattern).
  No `ng update`/`migrations.json` — this repo uses Nx generators deliberately.

## Why bundles are big: the mechanics (verified, not guessed)

1. ng-packagr publishes **one FESM module per lib**, so `sideEffects: false` buys nothing at the
   file level — statement-level dead-code elimination inside the FESM is all a consumer's bundler
   has.
2. Angular's app build pure-annotates **only** top-level `new InjectionToken(...)` in code outside
   `node_modules/@angular/` (`javascript-transformer-worker.js` sets `topLevelSafeMode` for
   third-party packages, and that mode's `pure-toplevel-functions` early-returns for every call
   expression). Every other top-level factory call in our libs is treated as side-effectful and
   retained — along with everything reachable from it.
3. **`/*#__PURE__*/` cannot fix destructuring.** rollup (the FESM step) strips the annotation off
   destructuring declarations, and esbuild refuses to drop `const [a, b] = f()`, `const { a } = f()`
   and `f()[0]` even when annotated. Only a **single-binding declaration whose initializer is one
   annotated call** (or a plain arrow/object literal) is droppable.
4. Consequence, measured: ~98 % of the `@ethlete/components` floor is reachable from ~152 impure
   root statements. Fixing roots one at a time shows almost no movement (each root's _exclusive_
   bytes are tiny while its _reach_ is huge — e.g. `providePipChromeManager`: 210 kB reach, 1.5 kB
   exclusive), which is why this survived so long. It must be one sweep per lib.

## Measured potential (gzip, `@ethlete/*`-only, `tools/treeshake` pipeline)

"Floor" = cost of importing one tiny symbol from the package. Simulated on the real FESMs by
rewriting the offending statement shapes (semantics preserved):

| variant                                        | core floor | query floor | components floor |
| ---------------------------------------------- | ---------: | ----------: | ---------------: |
| before                                         |    12.5 kB |     18.7 kB |          89.9 kB |
| `/*#__PURE__*/` on the tuple factories         |         ±0 |          ±0 |               ±0 |
| tuple-split only (fix 1 below)                 |     6.9 kB |     12.9 kB |          10.9 kB |
| tuple-split + single-binding PUREs (fix 2)     |     1.0 kB |      0.9 kB |           5.3 kB |
| + the 14 literal-with-member-access statements |     1.0 kB |      0.9 kB |           3.4 kB |
| **shipped** (+ nested/`new` annotations)       | **1.0 kB** |  **0.9 kB** |       **2.4 kB** |

**Measured after shipping** (`nx run treeshake:bundle-goldens`, the numbers now guarded in
`tools/treeshake/goldens.json`): core floor **1.0 kB**, query floor **0.9 kB**, components floor
**2.4 kB** (−97 %). Real entries: bracket+SE **111.2 → 29.2 kB**, rich-text-editor **77.8 → 69.3 kB**
(heading menu now opt-in), table 21.3 kB, select 41.2 kB, form-field+input 18.3 kB, overlay+dialog
20.0 kB, query client 13.9 kB.

Real entry check: `BracketComponent` + `singleEliminationBracketLayout()` goes **111.1 → 30.4 kB
(−72.6 %)**, verified to keep the bracket/SE code and drop Spinner/Notification/Overlay/RTE.
`@ethlete/query`'s floor is mostly core's floor re-exported through its graph; fixes 1+2 in core
are the bigger win for query apps than anything inside query.

Per-feature costs **after** the floor fix (the "fixed" matrix in the measurements doc is the real
prioritisation map; today's matrix is useless because the floor pre-pays everything):
rich-text-editor **73.8 kB** · cascader **39.8 kB** · select **38.7 kB** · stream/PiP **34.5 kB** ·
overlay **18.2 kB base + 16.7–20.5 kB per strategy** · table (already split into 14 `*_IMPORTS`)
**18.9 kB**.

## Ranked opportunities

### 1. Kill the destructured-tuple provider idiom — the one that unblocks everything

`libs/core/src/lib/utils/angular/di.ts:69,77,89,102` (`createProvider`, `createStaticProvider`,
`createRootProvider`, `createStaticRootProvider`) and `libs/core/src/lib/providers/labels.ts:53`
(`createLabels`) return tuples, consumed as
`export const [provideX, injectX] = createRootProvider(...)` at ~70–88 top-level call sites across
core/components/query. Unshakeable by construction (see mechanics 3).

**Fix (breaking now — we are in the major pre-release, no deprecation):** replace the tuple
factories with single-binding helpers in core — a descriptor creator plus per-binding extractors,
so each exported symbol is one `/*#__PURE__*/`-annotatable call:

```ts
const BRACKET_CONFIG = /* @__PURE__ */ defineStaticRootProvider<BracketConfig>({}, { name: 'BracketConfig' });
export const provideBracketConfig = /* @__PURE__ */ providerFn(BRACKET_CONFIG);
export const injectBracketConfig = /* @__PURE__ */ injectorFn(BRACKET_CONFIG);
```

Token exports must also go through a pure extractor (`tokenFn(DEF)`) — a bare
`export const X = DEF.token` is a member access and is retained. **Delete**
`createProvider`/`createStaticProvider`/`createRootProvider`/`createStaticRootProvider`/`createLabels`
in the same change (BREAKING-core) and port all internal call sites in core/components/query — the
exported `provideX`/`injectX` names don't change, so app code only breaks where it called the
factories itself. Ship a **`migrate-provider-shape` Nx generator** in the same release (extend
`migrate-to-v5`'s `create-provider.ts` codemod; the rewrite is mechanical:
`const [a, b, c] = createX(args)` → descriptor + extractor statements). Worth: core −5.6 kB,
query −5.7 kB, components **−79 kB** floor.

### 2. PURE-annotate the 49 single-binding factory calls (non-breaking, cheap)

These are already single-binding, so a source `/*#__PURE__*/` works today: query creator templates
(`http/query-creator-templates.ts:33-60`, `gql/gql-query-creator-templates.ts:39-60` — 18 calls;
the **biggest single win inside query**), `memoizeSignal` consumers
(`core .../signals/media-queries.ts` ×17, `signals/router.ts` ×7), `createPropertyBinding` in
`seo/{link,meta}-binding.ts` ×5, and friends. **Verify with the harness that the comment survives
ngc + rollup into the FESM** (single-binding declarations do; destructuring does not). The 26
top-level `new Set/Map/Date/Symbol` are measured irrelevant (90 B) — skip. The 14 object literals
with member-access keys (`[BRACKET_DENSITY.DEFAULT]:`, `label: DEFAULT_RTE_LABELS.undo`) are worth
1.7 kB — fix opportunistically with string-literal keys.

### 3. Break the component-retention chains in `libs/components`

Each of these is a top-level provider whose closure pins component classes (the reason a `paginate`
import used to ship Spinner/Overlay/RTE). After fix 1 they stop being _floor_, but they still make
their own feature heavier than it should be:

- **Notification**: `notification/notification-manager.ts:43` pins `NotificationStackComponent`
  via `createComponent` at `:90` (1,532 LOC + 336 CSS).
- **Overlay**: `overlay/overlay-manager.ts:41` pins `OverlayContainerComponent` (whose template
  compiles to 16.9 kB min — the largest single unit in the old floor); the 7 strategy value objects
  (`overlay/strategies/*.strategy.ts`, 2,735 LOC + `fullscreen-animation.ts` 738) should be
  imported by the consumer like bracket layouts are, not all retained together. BREAKING-components
  is acceptable — mirror the bracket-layout registration pattern.
- **Rich-text-editor**: 73.8 kB base; `rich-text-editor.component.ts:77` drags all of
  `MENU_IMPORTS` (2,237 LOC) for the heading tool — move it behind the existing per-tool
  `provideRichTextEditor*Tool` seam; audit what `provideRichTextEditorDom` (~40 kB) forces.
- **Stream/PiP**: `stream-config.ts:104-106` default components + `pip-chrome-manager.ts:17`.

### 4. `libs/query` internal moves (INTERNAL, no API change)

Current-gen files reach the 7,154-LOC legacy tree through value imports:
`http/query-repository.ts:5`, `http/http-request.ts:4`, `auth/bearer-auth-provider.ts:29`,
`auth/bearer-auth-query-builders.ts:6`, plus an `http ↔ gql` barrel cycle. Move the shared bits
out of the legacy barrel. Separately (BREAKING-query, fine): `http/query-client.ts` ships
persistence (739 LOC) + multi-tab sync (472 LOC) unconditionally and default-on — make them
opt-in features like `withPolling` (note: sync shipped recently; check
`plans/`/changelog before flipping defaults).

### 5. Smaller `libs/components` opt-ins (mostly established patterns)

- **form-field stylesheet split** (757 LOC CSS) — the styles-only-component pattern; already named
  the next candidate in CLAUDE.md.
- **`select` (38.7 kB) / `cascader` (39.8 kB)** — 2.8× the cost of `form-field + input`; audit what
  they retain (likely overlay strategies + animation) once fix 3 lands.
- **Bracket rounds-list-only layout split** (~4 kB): the list resolves a `BracketLayout` whose
  object also references `createGrid`/`drawEdges` it never calls (see
  `plans/bracket-tree-shaking.md`). Only worth it if list-only consumers materialise.
- **Bracket default cards** (`bracket-components.ts:43-55`) drag the `match` domain for
  custom-card consumers — measured ≤ ~3 kB earlier; measurement-gated.
- **Label tables**: `query-error/query-error-labels.ts:59` puts both the German **and** English
  HTTP-status tables (`libs/query/src/lib/pipes/parse-http-error-code-{de,en}.ts`, 14.2 kB min)
  into every components bundle — make languages opt-in or lazy.

## Regression guards (shipped with fix 1, keep forever)

1. **Lint rule** in `@ethlete/eslint-plugin` (e.g. `ethlete/no-impure-top-level-provider`): ban
   top-level array/object destructuring whose initializer is a call expression, and require the
   pure annotation on top-level single-binding factory calls in library source. Without this the
   idiom creeps back one file at a time and nobody notices until the next audit.
2. **Size goldens, Angular-style.** Angular's repo keeps checked-in expected payload sizes
   (`goldens/size-tracking/integration-payloads.json`); CI builds the test apps, compares against
   the golden within a tolerance, and fails on unexplained growth — a golden update is a
   deliberate, reviewable commit. The analog here: `tools/treeshake/goldens.json` holding expected
   gz bytes per entry (the three package floors + one real entry per big domain: bracket+SE, table,
   form-field+input, select, overlay+dialog, RTE, query client), plus a `check-goldens.mjs` that
   runs the existing pipeline and fails past a tolerance (~2 % or 512 B, whichever is larger —
   FESM linking is deterministic but dependency bumps move bytes), and an `--update` flag that
   rewrites the file. Wire it as an Nx target (shipped as `nx run treeshake:bundle-goldens`) in CI for
   affected libs; builds of `core`+`query`+`components` plus linking cost ~1-2 min. Record the
   goldens for the first time **after** fixes 1+2 land so the guarded state is the good state.

## What shipped

1. **Fix 1, done.** `defineProvider` / `defineRootProvider` / `defineStaticProvider` /
   `defineStaticRootProvider` / `defineLabels` return a `{ provide, inject, token }` definition;
   `toProvideFn` / `toInjectFn` / `toToken` name the halves. The five tuple factories are deleted and
   all ~90 call sites in core/components/query/cdk are ported. `createQueryClient`,
   `createBearerAuthProvider` and `createWebSocketClient` return a definition too, so there is no
   tuple left anywhere. `@ethlete/core:migrate-provider-shape` (Nx generator) rewrites both families,
   including consumer call sites, and reports what it cannot in `provider-shape-migration-tasks.md`.
   Dead `theming/theme.util.ts` + the two unused styles components were deleted along the way.
2. **Fix 2, done, and generalized.** `ethlete/no-impure-top-level-provider` bans module-scope
   destructuring of a call everywhere, and with `{ requirePureAnnotation: true }` (on in
   core/query/components source) requires `@__PURE__` on **every** call evaluated at module scope —
   including one nested in an argument or inside a top-level object literal, which is what the
   original 49-call estimate missed. Its fixer placed the annotations. The 14 member-access literals
   became literal keys / one-shot factories.
3. **Goldens, done.** `tools/treeshake/{goldens.json,check-goldens.mjs}` + the
   `treeshake:bundle-goldens` Nx target, wired into all three CI workflows. Tolerance 2 % / 512 B;
   `:update` rewrites the file as a reviewable commit.
4. **Fix 4 first half, done.** No current-gen module imports from `legacy/**` any more —
   `buildRoute`, `buildQueryString`, `buildTimestampFromSeconds`, `decryptBearer`, `QueryError` and
   the query-string types live in `http/internal/request-route`, which legacy re-exports. The
   `http ↔ gql` runtime cycle is closed via `http/internal/gql-options-guard`. Worth ~0 bytes: fixes
   1+2 had already made the legacy tree fully droppable (verified by grepping a `createQueryClient`
   bundle for `V2QueryClient`/`EntityStore`/… — all absent). Kept for graph hygiene.
5. **Fix 3, re-measured, mostly obsolete.** After fix 1 the overlay strategies are already
   individually shakeable (`dialogOverlayStrategy` adds 0.4 kB over no strategy, all seven add
   6.2 kB), so **no registration rework was done** — that avoids a gratuitous breaking change.
   Likewise notification (`injectNotificationManager` 22.6 kB vs `NOTIFICATION_IMPORTS` 19.8 kB) and
   the stream managers (`injectStreamManager` 3.9 kB) no longer justify a breaking split. The one
   real win was taken: the **RTE heading menu is now the opt-in `provideRichTextEditorHeadingTool()`**
   tool, −8.5 kB gz off every editor.

Caveat carried from `plans/table-tree-shaking.md`: consumers bundling without Angular's builder (no
linker/optimizer) get none of this — the numbers assume the standard Angular app build.

## Remaining follow-ups (fix 5), measured 2026-08-01

Worth doing, in order:

1. **form-field stylesheet split — DONE (2026-08-01).** 757 → 355 LOC base; text-shell, rich-text
   and textarea slices became styles-only components mounted by the enabling directives (counter/hint
   rules moved onto their components). Measured gz: `FORM_FIELD_IMPORTS` alone
   **16,622 → 15,466 B (−1,156)**, form-field+checkbox −1,120 B, select+form-field ±0. Goldens:
   select-alone +1,443 B accepted (the headless directive now carries the shell sheet standalone —
   paired usage pays the same); form-field-input +185 B boilerplate. The affix slice and a
   `FORM_FIELD_IMPORTS` barrel split were deliberately left — the barrel pins Hint/Counter/affix
   directives, so those slices save nothing until the barrel is split (breaking; not measured worth
   it this round).
2. **query persistence + multi-tab sync — DONE (2026-08-01).** `createQueryClient` now takes
   `features: [withQueryPersistence(), withMultiTabSync()]`; without them both subsystems tree-shake
   away. Measured: query-client entry **13,919 → 11,442 B gz (−2,477 B)**; with both features
   14,063 B (≈ the old default). Breaking; `@ethlete/query:migrate-query-client-features` is the
   behavior-preserving codemod.
3. **`query-error` language tables — DONE (2026-08-01).** The labels definition now defaults to
   `DEFAULT_QUERY_ERROR_LABELS` (English) instead of the locale-driven selector, so the German table
   is only bundled by apps that opt in via `provideQueryErrorLabels(queryErrorLabelsForLocale)` /
   `GERMAN_QUERY_ERROR_LABELS`. Measured: a `QueryErrorComponent + injectQueryErrorLabels` entry went
   **17,231 → 15,181 B gz (−2,050 B)**; the opt-in path costs what the old default did (17,244 B).
   Breaking (German no longer auto-selected); `@ethlete/components:migrate-query-error-labels`
   reports affected sites.
4. **RTE — link editor opt-in DONE (2026-08-01).** The link popover (which pinned
   FORM_FIELD/INPUT/CHECKBOX/CHOICE_FIELD plus overlay drag-to-dismiss in every editor) is now
   `provideRichTextEditorLinkEditor()`; without it the link tool degrades to the pre-existing
   `window.prompt` path. Also: `RICH_TEXT_EDITOR_HEADING_OPTIONS` moved next to the heading tool,
   and the table/image CSS slices became styles-only components mounted by their tool providers.
   Measured: `RICH_TEXT_EDITOR_IMPORTS` **69,633 → 49,677 B gz (−19,956, −29 %)**; opted back in
   69,136 B. Breaking; `@ethlete/components:migrate-rich-text-editor-link-editor` reports affected
   sites.

Still open in RTE, in value order (audited 2026-08-01, not implemented):

- **DOM feature modules behind provide fns** (~1,100 of the always-retained ~2,830 LOC:
  blockquote/code-block/headings/autoformat/links droppable for a marks/lists-only editor). Invasive —
  it narrows the headless directive's method surface; design carefully before touching.
- **Floating toolbar as `provideRichTextEditorFloatingToolbar()`** (~350 LOC + 82 CSS; does not free
  the overlay runtime).
- **Per-feature label defaults** (~1 kB of the always-loaded 2.2 kB label literal serves opt-in
  image/table/trigger tools).

Measured as **not** worth doing:

- **`select` 41.2 kB / `cascader` 42.4 kB.** Decomposition attributes it to `components/forms`
  (41 %, i.e. select + form-field + their headless) and the overlay it genuinely needs
  (`components/overlay` 18 % + `core/overlay` + `core/animations`). Nothing is retained that a select
  does not use; the lever is (1) above, not the select itself.
- **Bracket rounds-list-only layout.** `BracketRoundsListComponent` + a layout is **27.2 kB** against
  **29.2 kB** for the full bracket + SE — a ~2 kB spread, well under the ~4 kB the earlier plan
  estimated, and it costs an API split. Same for the bracket default cards.
- **Third-party import hygiene (swept 2026-08-01).** `date-fns` is imported per-function from the
  root entry (tree-shakeable), rxjs imports are modern paths except three story/debug files (stories
  don't ship), `@angular/cdk` uses secondary entry points. No duplicated implementations between core
  and components. Nothing actionable.
- **`FORM_FIELD_IMPORTS` barrel split** (drop Hint/Counter/affix directives from the barrel): would
  unlock the affix CSS slice (~0.6 kB) at the cost of a breaking barrel change — not worth it alone.
