# Tree-shaking opportunities across @ethlete/*

**Status: not started** (researched 2026-08-01). This is the execution plan; the full evidence lives
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
- **Breaking `@ethlete/core` requires a migration generator / AI-assisted migration** (Nx-style).
  The infra already exists: each lib ships Nx generators (`generators/generators.json` as
  ng-package assets); precedents are `@ethlete/core:migrate-to-v5` (which already contains a
  `create-provider.ts` codemod to build on) and `@ethlete/query:migrate-to-query-v3` (with
  `--projects` scoping and the "write `*-migration-tasks.md` with stable ids for what the codemod
  couldn't finish" AI-handoff pattern). No `ng update`/`migrations.json` — this repo uses Nx
  generators deliberately.

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

| variant                                       | core floor | query floor | components floor |
| --------------------------------------------- | ---------: | ----------: | ---------------: |
| today                                         |    12.5 kB |     18.6 kB |          89.8 kB |
| `/*#__PURE__*/` on the tuple factories        |         ±0 |          ±0 |               ±0 |
| tuple-split only (fix 1 below)                |     6.9 kB |     12.9 kB |          10.7 kB |
| tuple-split + 49 single-binding PUREs (fix 2) | **1.1 kB** |  **0.9 kB** |       **4.9 kB** |
| + 14 literal-with-member-access statements    |        1.1 |         0.9 |       **3.2 kB** |

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

**Fix (recommended, additive — no consumer breakage):** new single-binding helpers in core (e.g.
`defineProvider` / `defineLabels`, or per-binding creators so each exported symbol is one
`/*#__PURE__*/`-annotatable call: token, provide fn, inject fn as three pure statements). Port all
internal call sites in core/components/query — the **exported `provideX`/`injectX` names don't
change**, so this is invisible to apps. Keep the tuple factories exported but `@deprecated`.
Classification: INTERNAL for the sweep; the deprecation is BREAKING-core **later** — ship a
`migrate-provider-shape` generator (extend the existing `create-provider.ts` codemod) before any
removal in the next core major. Worth: core −5.6 kB, query −5.7 kB, components **−79 kB** floor.

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

## Execution order (each phase independently shippable, measured before/after)

1. **Fix 1 sweep** (core helpers + all internal call sites) + changesets (core minor: additive
   helpers + deprecation; components/query patch: internal). Acceptance: floors ≤ 7/13/11 kB
   (core/query/components).
2. **Fix 2 annotations** (+ FESM-survival verification). Acceptance: floors ≈ 1.1/0.9/4.9 kB.
3. **Query internal moves** (fix 4 first half). Acceptance: no legacy modules in the current-gen
   module graph (`tools/treeshake/dump-bundle.mjs` grep).
4. **Retention chains** (fix 3), one feature per changeset, biggest first (RTE menu, overlay
   strategies registration, notification stack, stream defaults). BREAKING-components allowed.
5. **Opt-ins** (fix 5) as follow-ups, each measurement-gated.
6. **Deprecation endgame**: `migrate-provider-shape` generator, then tuple-factory removal in the
   next core major.

Every phase: `npx nx build core query components`, run `tools/treeshake/measure-bundle.mjs` on the
floor + feature entries, record numbers in this file, `nx test` + `nx lint --fix` + changeset per
the repo skills. Caveat carried from `plans/table-tree-shaking.md`: consumers bundling without
Angular's builder (no linker/optimizer) get none of this — the numbers assume the standard Angular
app build.
