# Tree-shaking measurement harness

Measures what an `import` from a published `@ethlete/*` package actually costs a consumer, and
diagnoses **why** unused code is retained.

Everything here is a diagnostic tool, not part of any build. Nothing in this folder writes inside the
repo: caches, bundles and reports go to `<os.tmpdir()>/ethlete-treeshake/`, and every script hard-fails
if an output path would land in the working tree.

## Prerequisites

```bash
npx nx build core query components   # types is pulled in as a dependency
```

The scripts read `dist/libs/{components,core,query,types}/fesm2022/*.mjs`. `decompose.mjs`
additionally needs the `.mjs.map` files next to them (ng-packagr writes them by default).

A rebuilt `dist` is detected automatically - the cache directory name is a hash of the FESMs' size
and mtime, so a stale cache is never reused, and an unchanged one is instant.

## The pipeline (do not skip a step)

ng-packagr publishes **partial** Angular declarations. Bundling the published FESM straight with
esbuild/Rollup measures nothing: every class stays pinned by `ɵɵngDeclare*(…)` calls, and at
`target: es2022` the `ɵcmp`/`ɵfac` statics live in class `static {}` blocks that no bundler drops. So
these scripts reproduce exactly what an Angular application build does before bundling (see
`node_modules/@angular/build/src/tools/esbuild/javascript-transformer-worker.js`):

1. **`@angular/compiler-cli/linker/babel`** - link the partial declarations into real ones.
2. **`@angular/build`'s babel optimizer passes**, in the same order and with the same options used
   for a `sideEffects: false`, non-`@angular` package:
   - `markTopLevelPure { topLevelSafeMode: true }`
   - `elideAngularMetadata`
   - `adjustTypeScriptEnums`
   - `adjustStaticMembers { wrapDecorators: true }` - this is what wraps each class in a
     `/*#__PURE__*/` IIFE so a bundler can drop it.
3. **A `package.json` shim** with `sideEffects: false` written next to each processed FESM in the
   cache dir. esbuild only drops unused top-level statements of a module whose _nearest_
   `package.json` says so. Without the shim the `@ethlete/components` floor measures ~293 kB gz
   instead of ~90 kB.
4. **esbuild** - `bundle`, `format: esm`, `target: es2022`, `minify`, `treeShaking`,
   `define: ngDevMode=false ngJitMode=false ngI18nClosureMode=false NODE_ENV=production` → **gzip
   level 9** → bytes.

### `--external` mode

`--external` marks every non-`@ethlete` package (`@angular/*`, `rxjs`, `date-fns`, …) as external, so
the number is "how much `@ethlete` code lands in the app" without the ~85 kB gz Angular runtime
constant. **Deltas between entries are identical in both modes**; external mode is less noisy and
much faster. Use it for anything comparative.

### `--third-party` mode

`--external` hides third-party retention completely: a dependency that stopped tree-shaking is worth
0 B in that mode. `--third-party` externalizes only the framework (`@angular/*`, `rxjs`, `tslib`,
`zone.js`) and bundles everything else, so `date-fns`, `socket.io-client` and
`@contentful/rich-text-types` count towards the number. Compare an entry in both modes: the
difference is what the dependencies cost.

Two shapes make a dependency unshakeable, and neither is visible in `--external`:

- **A package without `sideEffects: false`** cannot be dropped at all once a module statically
  imports it, no matter whether the imported binding is used. `socket.io-client` is the example.
- **A TS enum imported as a value** emits a runtime object. `@contentful/rich-text-types`' `BLOCKS`
  and `INLINES` cost ~2.4 kB gz that way, which is why `rich-text-node-types.ts` keeps local literal
  maps and every import of that package stays `import type`.

`goldens.json` carries one `"thirdParty": true` entry per lib for exactly this surface.

### Consumer caveat

An app bundled **without** Angular's builder (plain Vite/esbuild/Rollup over the published FESM) does
not get passes 1–2 and therefore gets **no tree-shaking at all** from these packages - it ships the
whole library regardless of what these numbers say. If
that ever needs supporting, the fix is to run the same two passes as part of this repo's own publish
pipeline rather than leaving them to the consumer.

## Scripts

| script                  | purpose                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `harness.mjs`           | shared plumbing: repo root detection, the babel pipeline, the FESM cache, the esbuild base options, the "never write into the repo" guard. Not run directly.                                                                                                                                                       |
| `measure-bundle.mjs`    | **how many bytes.** Bundles each entry in an entries JSON as a consumer app and reports minified + gzipped size.                                                                                                                                                                                                   |
| `decompose.mjs`         | **whose bytes.** Keeps the sourcemap alive through the whole pipeline and attributes every output byte back to the original `.ts`/`.html`, rolled up per file and per domain. Also prints the esbuild metafile.                                                                                                    |
| `dump-bundle.mjs`       | writes an unminified, externalized bundle for one entry, to grep for retained identifiers and to feed `retention.mjs`.                                                                                                                                                                                             |
| `retention.mjs`         | **why those bytes.** Splits an unminified bundle into top-level statements, builds the reference graph, and classifies each as a ROOT (initializer esbuild cannot prove pure ⇒ kept unconditionally) or PULLED. Per root: `reach` (bytes reachable) and `exclusive` (bytes reachable from that root and no other). |
| `inventory.mjs`         | counts the impure top-level declarations in the linked FESMs, grouped by the factory that initializes them. The "what would we have to change" list.                                                                                                                                                               |
| `make-pure-variant.mjs` | copies a cache and injects `/*#__PURE__*/` before top-level call initializers (tiers A/B/C), so a hypothetical fix can be measured before touching `libs/`.                                                                                                                                                        |
| `split-tuples.mjs`      | copies' rewrite: turns `const [a, b] = createRootProvider(…)` into a memoized per-binding shape. Simulates fixing the tuple-destructuring blocker.                                                                                                                                                                 |
| `wrap-literals.mjs`     | copies' rewrite: wraps top-level object literals containing a member access in a PURE IIFE. Simulates fixing the property-read blocker.                                                                                                                                                                            |
| `entries.example.json`  | the package floors plus one real feature entry. Default `--entries` for `measure-bundle.mjs`.                                                                                                                                                                                                                      |
| `check-goldens.mjs`     | **the regression guard.** Measures every entry in `goldens.json` and fails when one grew past the tolerance. `nx run treeshake:bundle-goldens` in CI; `…:update` rewrites the file. Unlike the rest of this folder it is not a diagnostic - it is wired into the build.                                            |
| `goldens.json`          | checked-in expected gz bytes per entry: the three package floors plus one real entry per big domain. A golden change is a deliberate, reviewable commit.                                                                                                                                                           |

### Why the rewrite scripts exist

esbuild keeps a top-level statement unless it can prove the initializer side-effect free, and there
are three distinct shapes it refuses, only one of which a comment can fix:

```js
const [provideX, injectX] = /*#__PURE__*/ createRootProvider(…);  // ❌ kept - array destructuring
const { provideX } = /*#__PURE__*/ makeThem();                    // ❌ kept - object destructuring
const t = /*#__PURE__*/ makeThem(); const provideX = t[0];        // ❌ kept - index/property read
const CONFIG = { [SIZES.SM]: 1, label: DEFAULTS.x };              // ❌ kept - property read
const provideX = /*#__PURE__*/ makeProvider(…);                   // ✅ droppable
```

Destructuring invokes the iterator protocol and a bare property read may invoke a getter, so both
count as side effects. `make-pure-variant.mjs` measures the annotation-only fix; `split-tuples.mjs`
and `wrap-literals.mjs` measure the shape fixes. Run them against a **copy** of a cache and point
`measure-bundle.mjs --cache` at the copy to get before/after numbers without editing `libs/`.

## Examples

Measure the floors and one real feature (the default entries file):

```bash
npx nx build core query components
node tools/treeshake/measure-bundle.mjs --external
```

Measure your own entries, machine-readable:

```bash
node tools/treeshake/measure-bundle.mjs --external --entries /tmp/my-entries.json --json
```

Find out where the `@ethlete/components` import floor goes:

```bash
node tools/treeshake/decompose.mjs --name floor --top 25 \
  --entry "import { paginate } from '@ethlete/components'; console.log(paginate);" \
  --dump floor-unmin.js
```

…and why it is retained:

```bash
node tools/treeshake/retention.mjs /tmp/ethlete-treeshake/floor-unmin.js --top 25
```

List what pins it, by factory:

```bash
node tools/treeshake/inventory.mjs --cache /tmp/ethlete-treeshake/linked-<fingerprint>
```

Measure a hypothetical fix without touching `libs/` (cache fingerprint is printed by
`measure-bundle.mjs`):

```bash
BASE=/tmp/ethlete-treeshake/linked-<fingerprint>
node tools/treeshake/make-pure-variant.mjs "$BASE" /tmp/ethlete-treeshake/variant B
node tools/treeshake/split-tuples.mjs /tmp/ethlete-treeshake/variant
node tools/treeshake/measure-bundle.mjs --external --cache /tmp/ethlete-treeshake/variant \
  --label "tuple-split + tier-B PURE"
```

Grep a bundle to confirm something really is gone:

```bash
node tools/treeshake/dump-bundle.mjs --cache "$BASE" --out bracket.js \
  --entries tools/treeshake/entries.example.json --name bracket-single-elimination
grep -c 'SwissGrid' /tmp/ethlete-treeshake/bracket.js
```

## The regression guard

Everything above diagnoses a problem once. `goldens.json` is what keeps it fixed:

```bash
npx nx run treeshake:bundle-goldens          # CI runs this; fails on unexplained growth
npx nx run treeshake:bundle-goldens:update   # accept new sizes, then commit goldens.json
```

The target builds `core`, `query` and `components` first, so it is self-contained. Tolerance is 2 % or
512 B, whichever is larger - FESM linking is deterministic, but a dependency bump moves a few bytes. A
new entry with `"gzip": 0` is recorded rather than failed, which is how you add one.

When it fails, the cause is almost always a module-scope statement that stopped being droppable: an
unannotated call (`ethlete/no-impure-top-level-provider` catches most of these), a computed key or
property read inside a top-level literal, or a destructured factory result. `decompose.mjs` on the
failing entry names the file.

## Ground rules for an audit

- **Skip `libs/cdk`** (maintenance mode) and legacy query (`libs/query/src/lib/legacy/**`, the
  reactive-forms `query-form/`).
- **Breaking changes are fine in `components` and `query`.** Breaking `@ethlete/core` needs an Nx
  migration generator shipped in the same release - the SDK is in a changesets major pre-release, so
  there is no deprecation cycle. Precedents: `@ethlete/core:migrate-to-v5`,
  `@ethlete/query:migrate-query-client-features`.
- **Build variants with `nx build <lib> --skip-nx-cache`.** Nx has restored a cached `dist` for a
  reverted tree three times and produced bogus baselines - once badly enough that a stale `query`
  build made `components` fail to compile against it.

### What a split costs at the top end

Every opt-in has a price paid by the consumer who opts back in, and it is consistently larger than a
line count suggests:

- **A registration seam costs 10-30 % of the slice it frees.** The 2026-08-04 table decomposition
  predicted 2,309 / 554 / 1,130 B and banked 2,026 / 440 / 999 once the registry, the row-VM field, the
  outlet and the dev-mode error were paid for.
- **A registry plus provider objects is not free either.** The RTE DOM-feature split costs **+844 B**
  at the all-tools entry. Both sides want a golden so neither drifts.
- **Raw-byte CSS duplication is a poor proxy for gz cost.** gzip already collapses two near-identical
  sheets, and the audit's line-count estimates came in 4-5× over the measured bytes every time. Only
  split _distinct_ CSS slices.
- **A styles-only component is the wrong home for a feature's CSS unless the feature already uses the
  style manager.** Routing the table's 48 lines of sticky CSS through one measured **955 B gz worse**
  for a table that does pin, against the **113 B** they cost every table by staying in the base sheet.
  The slider/range-slider dedupe was implemented and reverted for the same reason.
- **Build a dev-only error inside the `ngDevMode` branch, not in a helper it is passed to.** Routing
  call sites through `requireDomFeature(feature, method, provider)` kept the two string literals per
  call through minification (the `throw` did not) - ~70 B gz. `if (ngDevMode) throw missing(…)` lets
  esbuild drop the strings with the branch.

## Settled - do not re-open

Measured and rejected during the 2026-07-31 / 2026-08-01 / 2026-08-04 rounds:

- **Injection-only CSS candidates.** The on-demand `injectStyleManager()` mounts shipped
  (`2c0d3c9f7`); freeing the remaining bytes needs a breaking per-domain provider and they are
  392 B (`choice-field`), 452 B (`carousel`) and 217 B (`cascader`).
- **Per-feature RTE label defaults - 526 B**, for a new layering mechanism in `core`, a split of a
  documented public constant and a second way to localize one domain.
- **The table's per-cell sticky bindings - a further ~360 B.** Only the machinery moved out of the
  base; the `[class.et-table-sticky-*]` / `[style.inset-inline-*]` bindings stayed, because no seam
  lets a feature contribute an attribute to a cell the table draws. Cutting them needs a per-cell
  decorator lookup - a method call inside a per-cell binding, which that component is built to avoid.
- **`@floating-ui/dom` as an optional peer.** Anchored positioning is already opt-in at the bundle
  level (`registerAnchoredPositionSetup`), so there is nothing to win in bytes; tooltip, menu,
  toggletip and the RTE all reach for it, so the only gain is install footprint for a
  dialog/drawer-only app - against a failure mode that is a build error rather than an install
  warning. `date-fns` is optional because only the date stack uses it; not a precedent.
- **`select` / `cascader` decomposition.** Nothing is retained a select does not use; the weight is
  `components/forms` plus the overlay it genuinely needs. The lever is an RTE-style feature split.
- **Bracket rounds-list-only layout** (~2 kB spread for an API split), **`FORM_FIELD_IMPORTS` barrel
  split** (unlocks ~0.6 kB of affix CSS, breaking), **overlay strategy registration**, **`defineOverlay`
  retention**, **`PHONE_COUNTRIES`**, **the date-picker stack**, **`injectRenderer`**,
  **icon-button→spinner**, **notification and stream-manager barrel splits**, **query snapshot
  laziness**, **gql over the query client**.
- **Third-party import hygiene** (swept 2026-08-01): `date-fns` is imported per-function from the root
  entry, rxjs uses modern paths outside story/debug files, `@angular/cdk` uses secondary entry points,
  and core and components duplicate no implementations.

## Reading the numbers

- **Compare gz, not min.** The `min` column is useful only for sourcemap attribution, where gzip
  cannot be split per module.
- **A feature's cost is its entry minus the package floor.** While the floor is large, per-feature
  deltas for anything the floor already pins read as ~0 and are meaningless - fix the floor first.
- **An unknown export is a hard esbuild error**, which makes the entries file a decent typo check.
- `<unmapped>` in `decompose.mjs` output is esbuild's own module glue plus the entry, not library
  code.
- **`decompose.mjs` attributes a component's compiled CSS to its `.html`/`.ts` row**, because that is
  where the sourcemap points. So `overlay-container.component.html` at "16.9 kB" and
  `table.component.html` at "19.1 kB" are really their stylesheets, not their templates.
- **A number from `--external` says nothing about third-party retention.** Re-measure with
  `--third-party` before concluding a dependency shakes out.
