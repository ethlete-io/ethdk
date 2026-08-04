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

## Reading the numbers

- **Compare gz, not min.** The `min` column is useful only for sourcemap attribution, where gzip
  cannot be split per module.
- **A feature's cost is its entry minus the package floor.** While the floor is large, per-feature
  deltas for anything the floor already pins read as ~0 and are meaningless - fix the floor first.
- **An unknown export is a hard esbuild error**, which makes the entries file a decent typo check.
- `<unmapped>` in `decompose.mjs` output is esbuild's own module glue plus the entry, not library
  code.
