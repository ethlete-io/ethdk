# Bracket tree-shakeable layouts

Status: **complete** (2026-07-31). Layouts became opt-in value objects; consumers only bundle the
renderers they register.

## What changed

- New `BracketLayout` contract (`libs/components/src/lib/bracket/bracket-layout.ts`): a plain value
  carrying `mode`, `dataLayout`, `createGrid`, `drawEdges`, optional `listGrouping` / `listSection` /
  `components` / `styles`. Registered via `provideBracketConfig({ layouts: [...] })` or the `layouts`
  input on both hosts; first `mode` match wins; unregistered mode throws `ET3413` (never a wrong render).
- Factories (`layouts/`): `singleEliminationBracketLayout()`, `doubleEliminationBracketLayout()`,
  mirrored variants of both, `swissBracketLayout({ colors?, matchComponent?, roundHeaderComponent? })`.
  The old `layout` input / `BracketConfig.layout` and `BracketConfig.swiss` are gone (major changeset).
  Mirrored is a layout, not a string flag — a future layout (e.g. stacked double elimination) is one new
  factory file, zero base changes.
- The mode `switch` in `computeBracketGrid`, the `drawMan`/`drawSwissMan` branch, and the
  `drawing/`+`drawing/grid/` barrels were removed; `bracketNaturalWidth`/`bracketFitsWidth` take
  `layouts` on their config. Swiss group-border CSS moved to a styles-only component mounted by the
  swiss layout via the style manager.

## Measured

Gzip, `@ethlete/*`-only, esbuild after the linker+optimizer babel passes — see
`plans/table-tree-shaking.md` for the pipeline. Baseline = HEAD `568e9379c`.

| entry                                 |  baseline | refactored |   delta |
| ------------------------------------- | --------: | ---------: | ------: |
| import floor (`provideBracketConfig`) |   91.5 kB |    91.5 kB |   +56 B |
| `BracketComponent`, no layout         | 117.5 kB¹ |   109.2 kB | −8.2 kB |
| + single elimination                  | 117.5 kB¹ |   113.8 kB | −3.7 kB |
| + SE + double elimination             | 117.5 kB¹ |   115.3 kB | −2.3 kB |
| + SE + swiss                          | 117.5 kB¹ |   116.3 kB | −1.3 kB |
| both components + all 5 factories     |  118.2 kB |   118.8 kB | +0.6 kB |

¹ baseline `BracketComponent` always bundled all three renderers.

Cost model after: base bracket +17.2 kB over the floor (was +25.4), then SE +4.5 kB, DE +1.4 kB,
swiss +2.4 kB; mirrored variants are free (+12 B, shared builders). Verified by grep of the
unminified bundles: `createSwissGrid`/`drawSwissMan`/swiss-group code appear **only** when
`swissBracketLayout` is imported; DE builder only with its factory.

**Since `plans/bracket-stacked-double-elimination.md` shipped, `mirroredDoubleEliminationBracketLayout()`
is no longer free**: it has a builder of its own (`grid/double-elimination-stacked.ts`) rather than
sharing the left-to-right one, so expect ≈ +1.5 kB gz for that factory. The left-to-right DE factory is
unchanged — it actually shrank, since the folded-back pass it used to carry is gone. The seam is what
made a second builder cheap to add: one new file, referenced only by the mirrored factory.

## Known trade-offs / follow-ups

- **Rounds-list-only consumers pay +3.9 kB**: the list resolves a layout for grouping/sectioning/cards,
  and the SE factory's object also references `createGrid`/`drawEdges` the list never calls. A split
  list-only layout value would win those ~4 kB back; deferred until list-only consumers exist.
- **The library-wide import floor is ~89 kB gz** (was 50 kB at the table plan, 2026-07-25): ~74
  top-level `createLabels`/`createStaticRootProvider`/`createRootProvider` calls esbuild can't prove
  pure, several retaining component classes (overlay strategies). `/*#__PURE__*/`-annotating those
  factories is the highest-leverage bundle fix in the library — it dwarfs everything in this table.
- DE arms inside the shared relations engine (~300 LOC) stay in base by design — extracting them means
  parameterizing ~1,200 LOC of relation logic for ~1-2 kB.
- Measurement harness lives in the session scratchpad (`measure-bundle.mjs`), not committed — same
  convention as the table plan; re-run instructions in its `bracket-bundle-baseline.md`.
