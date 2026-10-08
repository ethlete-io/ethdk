# CR-09 audit: `@internal` per member before `stripInternal`

Decision (user): turn on `stripInternal` for the prod build of the published libs. A real internal keeps
`@internal` and is stripped. A member a consumer is meant to reach loses the tag. This file is the
audit and the check design. No source file was edited.

Method: a TypeScript checker pass over every lib source file (`tsconfig.base.json` paths). It finds
each declaration whose leading comment contains `@internal`, which is the same test `stripInternal`
uses, and records every reference from another ng-packagr entry point. The same pass ran over all
2162 `.ts` files of `~/dev/ea-frontend`, with `@ethlete/*` mapped to SDK source; it resolved 19,742
SDK identifiers. Then `ngc` emitted `libs/components/src/index.ts` with `stripInternal: true` into
`/tmp`, and `tsc` checked the emitted `.d.ts` with `skipLibCheck: false`. Docs: grep of `apps/docs`
for every internal member name, reviewed by hand. Scripts are in `/tmp/cr09/` (outside the repo).

## 1. How the libs build, and where the flag goes

- Every published lib builds with `@nx/angular:package` (ng-packagr). The `production` configuration
  (the default) uses `libs/<lib>/tsconfig.lib.prod.json`, which extends `tsconfig.lib.json`.
  `dependsOn: ["^build"]` builds upstream libs first, and the executor points `@ethlete/*` at their
  **`dist/` output**, not at source. **So a downstream lib compiles against the stripped `.d.ts` of an upstream lib.**
- ng-packagr also builds a secondary entry point (`/toggle`, `/lazy`, `/testing`, `/devtools-contract`)
  against the **built** `.d.ts` of its sibling entry points. A stripped member used across entry
  points therefore breaks the build too.
- The `.d.ts` are bundled by `rollup-plugin-dts` into `dist/libs/<lib>/types/ethlete-<lib>.d.ts`.
  A named import of a stripped declaration fails the bundle. Shape errors (`implements`, abstract
  members) are not type-checked, and both repos set `skipLibCheck: true`, so they ship silently.
- **`libs/query/tsconfig.lib.prod.json` already has `"stripInternal": true`.** It is the precedent:
  its cross-entry transport goes through `ɵ`-prefixed aliases (`libs/query/devtools-contract/index.ts`),
  never through an `@internal` declaration. Its `dist` d.ts has 6 `@internal` left, all constructor
  parameters, which TS cannot strip.

Where the flag goes: `"stripInternal": true` under `compilerOptions` in

- `libs/components/tsconfig.lib.prod.json`
- `libs/core/tsconfig.lib.prod.json`
- `libs/bracket/tsconfig.lib.prod.json`
- `libs/query-devtools/tsconfig.lib.prod.json` (covers all three entry points)
- optional, for uniformity (0 tags today): `types`, `cdk`, `contentful`. `timetrack` is private.

Only the prod config: `tsconfig.lib.json` (development build), the spec configs and the apps
(Storybook, timetrack-app, ethlete-studio) resolve `@ethlete/*` to source, so they never see stripping.

### Traps, and what was found

| Trap                                                                | Found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stripped member used by another `@ethlete/*` package                | **1**: `@ethlete/bracket` `createStackedDoubleEliminationGrid`, imported by `libs/components/src/lib/bracket/layouts/double-elimination-bracket-layout.ts:9,75`. The components build fails.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Stripped member used across entry points of one package             | **2**: `@ethlete/query-devtools/toggle` `QUERY_DEVTOOLS_VIEW_STATE_KEY` (used by the panel, `query-devtools.component.ts:208,336`) and `wasQueryDevtoolsOpen` (used by `/lazy`, `query-devtools-lazy.component.ts:17,68`). The query-devtools build fails.                                                                                                                                                                                                                                                                                                                                             |
| Stripped declaration still referenced by a public `.d.ts` signature | **3**: `BracketComponentOverrides` and `BracketLayoutSettings`, both referenced by the public `BracketLayout` / `BracketDrawEdgesContext` (`bracket-layout.d.ts` imports them). And `ResolvedScrollableChrome`, re-exported by name from `scrollable/headless/index.ts:5`. All three fail the rollup-dts bundle.                                                                                                                                                                                                                                                                                       |
| Stripped class member that implements a non-stripped interface      | **7 classes**: `FormFieldDirective` → `FormFieldDirectiveBase` (12 members), `SliderDirective` / `RangeSliderDirective` → `SliderHostBase` (`registerThumb`, `unregisterThumb`), `MenuSelectionGroupDirective` → `MenuSelectionGroupDirectiveBase` (`labelId`, `registerItem`, `unregisterItem`), `SelectionListDirective` → `SelectionListDirectiveBase` (`findTypeaheadMatch`), `DatePickerInputFieldDirective` / `DateRangePickerInputFieldDirective` → `InputMaskHost` (`suppressNativeSync`, `resumeNativeSync`). The bundle still builds, but a consumer with `skipLibCheck: false` gets TS2420. |
| Stripped override of a non-stripped abstract member                 | **3**: `duplicateFieldError` in `DateRangeInputFieldDirective`, `DateTimeRangeInputFieldDirective` and `TimeRangeInputFieldDirective`. The base `DateRangePickerInputFieldDirective.duplicateFieldError` (line 46, `protected abstract`) is untagged. Result: TS2515.                                                                                                                                                                                                                                                                                                                                  |
| Stripped input / model / output (breaks a consumer's AOT template)  | **0**. No `input()`, `model()`, `output()` or `@Input`/`@Output` carries the tag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Stripped static template guard                                      | **2**: `CalendarHeaderDirective.ngTemplateContextGuard` (`calendar/calendar-header.directive.ts:32`) and `DatePickerSurfaceDirective.ngTemplateContextGuard` (`forms/date-time/picker/date-picker-surface.directive.ts:30`). ngtsc reads the guard from the `.d.ts`. Stripped, a consumer's `let-` variables silently become `any`, with no error.                                                                                                                                                                                                                                                     |
| `exportAs` + template ref in a consumer reading an internal         | **0**. ea-frontend uses `#editor="etRichTextEditor"` (passed whole as an input) and `#csv="etTableCsvExport"` (reads `exporting`, `export`, both public). query-devtools `#rootMenu="etMenu"` reads no internal member.                                                                                                                                                                                                                                                                                                                                                                                |
| `ɵ`-prefixed exports                                                | Only `@ethlete/query/devtools-contract`. Their declarations are untagged, so stripping cannot reach them. This is the pattern to copy for the two cross-entry and one cross-package cases above.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Tags that do nothing                                                | components 7: `breadcrumb/breadcrumb-manager.ts:32,35,39,42` and `notification/notification-ref.ts:170` are object-literal members of an inferred return type, and `notification-ref.ts:131,156` are function locals. query 6 constructor parameters. All stay visible in the `.d.ts` whatever the flag says.                                                                                                                                                                                                                                                                                          |
| `tools/export-coverage`                                             | Reads source and counts runtime exports, so stripping does not change its result. A stripped top-level export still ships at runtime, so the tool keeps asking for its coverage. 14 allowlist entries are `@internal` declarations (13 query, plus components `optionalBooleanAttribute`). Optional follow-up: skip `@internal` declarations as it already skips `ɵ`.                                                                                                                                                                                                                                  |
| "API generator" tooling                                             | `tools/api-models` generates the OpenAPI model types. It never reads lib `.d.ts`, so it is unaffected. `apps/docs` has no d.ts-driven API reference.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

ea-frontend: **0** references to any `@internal` declaration, in TS or in templates. fifagg-frontend:
not exposed at all. It pins the v4 lines (`core 4.28.0`, `query 5.43.0`, `cdk 4.56.1`,
`contentful 3.9.0`) and has no `@ethlete/components`.

## 2. `@internal` count per published lib

Grep count of tag lines, excluding specs, scenarios, testing and stories:

| Lib                          | Tags | Prod build strips today | Note                                                                                                                                       |
| ---------------------------- | ---: | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `components`                 |  537 | no                      | 532 on a declaration, 5 on object-literal members (no-op). 6 are in `scheduler` (re-audit after the scheduler rewrite). 142 are top-level. |
| `query`                      |  113 | **yes**                 | 6 constructor parameters (no-op). No action.                                                                                               |
| `query-devtools`             |   13 | no                      | 2 in `/toggle`, 11 in the panel.                                                                                                           |
| `bracket`                    |    4 | no                      |                                                                                                                                            |
| `core`                       |    1 | no                      | `injectScrollRestorationHolds`, not used outside core.                                                                                     |
| `types`, `cdk`, `contentful` |    0 | no                      |                                                                                                                                            |

## 3. Members that need an action

Paths are relative to `libs/components/src/lib/` unless a lib is named.

| Lib            | File:line                                                                                              | Member                                                                                                                                                              | Reason                                                                                                                                      | Action                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| bracket        | `libs/bracket/src/lib/drawing/grid/double-elimination-stacked.ts:145`                                  | `createStackedDoubleEliminationGrid`                                                                                                                                | Imported by `@ethlete/components`. The components build would fail.                                                                         | Drop the tag and export it as `ɵcreateStackedDoubleEliminationGrid` (query pattern), or drop the tag and leave it public. Update the import site. |
| query-devtools | `libs/query-devtools/toggle/query-devtools-view-state.ts:8`                                            | `QUERY_DEVTOOLS_VIEW_STATE_KEY`                                                                                                                                     | Used by the panel entry point. The secondary-entry build would fail.                                                                        | Drop the tag, re-export as `ɵ…` from `toggle/index.ts`, update 1 import.                                                                          |
| query-devtools | `libs/query-devtools/toggle/query-devtools-view-state.ts:15`                                           | `wasQueryDevtoolsOpen`                                                                                                                                              | Used by `/lazy`.                                                                                                                            | Same as above.                                                                                                                                    |
| components     | `bracket/bracket-components.ts:20`                                                                     | `BracketComponentOverrides`                                                                                                                                         | Type of the public `BracketLayout.components`, the custom-layout API.                                                                       | Drop tag.                                                                                                                                         |
| components     | `bracket/bracket-grid.ts:11`                                                                           | `BracketLayoutSettings`                                                                                                                                             | Type of the public `BracketDrawEdgesContext.settings`, which a custom `drawEdges` receives.                                                 | Drop tag.                                                                                                                                         |
| components     | `scrollable/headless/scrollable-chrome.ts:42`                                                          | `ResolvedScrollableChrome`                                                                                                                                          | Re-exported by name from `scrollable/headless/index.ts:5`. Only the internal `activeChrome` uses it.                                        | Keep the tag and remove it from the `export type { … }` line.                                                                                     |
| components     | `forms/form-field/headless/form-field.directive.ts:68-80,246-298`                                      | `registeredControl/Hint/Counter/Label/ControlSuffix`, `register/unregisterControl`, `register/unregisterHint`, `register/unregisterCounter`, `unregisterLabel` (12) | Implements `FormFieldDirectiveBase`, whose members are untagged (TS2420). Registration is undocumented plumbing.                            | Keep. **Add** `@internal` to the same 12 members of `FormFieldDirectiveBase` (`forms/form-field/headless/form-field.tokens.ts:113-124`).          |
| components     | `forms/slider/headless/slider.directive.ts:213,218`, `range-slider.directive.ts:252,257`               | `registerThumb`, `unregisterThumb`                                                                                                                                  | Implements `SliderHostBase` (TS2420).                                                                                                       | Keep. Add the tag to the 2 members in `forms/slider/headless/slider.tokens.ts`.                                                                   |
| components     | `menu/headless/menu-selection-group.directive.ts:42,68,73`                                             | `labelId`, `registerItem`, `unregisterItem`                                                                                                                         | Implements `MenuSelectionGroupDirectiveBase` (TS2420).                                                                                      | Keep. Add the tag to the 3 members in `menu/headless/menu-selection-group.tokens.ts`.                                                             |
| components     | `forms/selection-list/headless/selection-list.directive.ts:146`                                        | `findTypeaheadMatch`                                                                                                                                                | Implements `SelectionListDirectiveBase` (TS2420).                                                                                           | Keep. Add the tag to the member in `forms/selection-list/headless/selection-list.tokens.ts`.                                                      |
| components     | `forms/date-time/{date-range,date-time-range,time-range}-input/headless/*-input-field.directive.ts:35` | `duplicateFieldError` (3)                                                                                                                                           | Overrides an untagged `protected abstract` (TS2515).                                                                                        | Keep. Add the tag to `forms/date-time/internals/date-range-picker-input-field.directive.ts:46`, or make the 3 overrides `protected`.              |
| components     | `forms/input/headless/input.directive.ts:91,96`                                                        | `InputDirective.suppressNativeSync`, `resumeNativeSync`                                                                                                             | The documented `InputMaskHost` contract (`apps/docs/components/text-inputs.md:406-410`, "Custom hosts").                                    | Drop tag.                                                                                                                                         |
| components     | `forms/date-time/internals/date-picker-input-field.directive.ts:111,116`                               | `suppressNativeSync`, `resumeNativeSync`                                                                                                                            | Same contract; also TS2420 against `InputMaskHost`.                                                                                         | Drop tag.                                                                                                                                         |
| components     | `forms/date-time/internals/date-range-picker-input-field.directive.ts:164,169`                         | `suppressNativeSync`, `resumeNativeSync`                                                                                                                            | Same.                                                                                                                                       | Drop tag.                                                                                                                                         |
| components     | `calendar/calendar-header.directive.ts:32`                                                             | `static ngTemplateContextGuard`                                                                                                                                     | Compiler API. Stripped, consumer `let-` bindings silently turn into `any`.                                                                  | Drop tag.                                                                                                                                         |
| components     | `forms/date-time/picker/date-picker-surface.directive.ts:30`                                           | `static ngTemplateContextGuard`                                                                                                                                     | Same.                                                                                                                                       | Drop tag.                                                                                                                                         |
| components     | `query-error/query-error.component.ts:44`                                                              | `QueryErrorComponent.queryError`                                                                                                                                    | Its own JSDoc calls it "the handle for a consumer reaching in with `viewChild`". This is the CR-04 `CarouselComponent.carousel` case again. | Drop tag. Add it to the query-error guide.                                                                                                        |
| components     | `forms/select/headless/select.directive.ts:1007`                                                       | `SelectDirective.requestLoadMore`                                                                                                                                   | Named in `apps/docs/components/select.md:305`. A headless select with its own load-more row has nothing else to call.                       | Drop tag. Its JSDoc already reads as API.                                                                                                         |
| components     | `breadcrumb/breadcrumb-manager.ts:32,35,39,42`, `notification/notification-ref.ts:131,156,170`         | `registerSegment`, `unregisterSegment`, `registerOutlet`, `unregisterOutlet`, `replacementCount`, `markDismissed`                                                   | The tag does nothing: object-literal member of an inferred return type, or a function local.                                                | Leave as is, or give the factory an explicit return type that omits them. Low priority.                                                           |
| components     | `scheduler/**` (6 tags)                                                                                | `injectSchedulerClock`, `SchedulerBadge*Component` ×5                                                                                                               | Compiles and strips cleanly today, but the scheduler is being rewritten.                                                                    | **Re-audit after the scheduler rewrite.**                                                                                                         |

Judgment calls kept as `@internal` (CR-09 named some of them; none is referenced by a consumer, the
docs or another package):

- `TabGroupDirective.panels`, `managesPanelsInternally`, `restoredSessionMemoryKey`, `registerPanel`
  (`tabs/tabs/headless/tab-group.directive.ts:36-42,146`): registration plumbing for `et-tab-group`. Keep.
- `ButtonDirective.registerLoadingSource` / `unregisterLoadingSource` (`button/headless/button.directive.ts:116,121`) and
  the `ButtonLoadingSource` type: only same-lib callers. Keep. Drop them together if a consumer-facing loading
  source is ever wanted.
- `CarouselDirective.currentIndex`: CR-04 made `activeIndex` the API. Keep.
- `ScrollableDirective.suspendSnap` / `scrollToOffsetUnsnapped` (`scrollable/headless/scrollable.directive.ts:276,294`)
  and `ScrollbarDirective.startThumbDrag` (`scrollbar/headless/scrollbar.directive.ts:267`): their JSDoc reads like API,
  but only carousel and `etScrollbarThumb` call them. Keep, and trim the JSDoc in the edit phase if it stays internal.

### Keep `@internal` (stripped), by lib

| Lib            | Keep | Of which top-level                                                                                                                                      |
| -------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| components     |  512 | ~132: styles-only components, `mount*Styles`, table/menu sub-components, bracket/form helpers. Excludes 12 dropped tags, 7 no-ops and 6 scheduler tags. |
| query-devtools |   11 | 10 internal sub-components and styles components                                                                                                        |
| bracket        |    3 | `createBracketSlotResolver`, `createFoldedThirdPlaceSection`, `rowSpanMatchCount` (type member)                                                         |
| core           |    1 | `injectScrollRestorationHolds`                                                                                                                          |
| query          |  113 | already stripped                                                                                                                                        |

Tags added on interface and abstract members to match their implementations: 12 + 2 + 3 + 1 + 1 = **19**.

## 4. Verification

```bash
export NX_NO_CLOUD=true

# 1. Build every published lib with the prod config (the flag lives there). This catches the
#    cross-package and cross-entry traps, and stripped names a d.ts still imports (rollup-plugin-dts).
npx nx run-many -t build -p types,bracket,core,query,components,query-devtools,cdk,contentful --skip-nx-cache

# 2. Check the built .d.ts against themselves, which neither build does (skipLibCheck: true everywhere).
#    This catches the implements and abstract mismatches. Run it from a dir with node_modules linked to
#    the repo's, with paths @ethlete/<lib> -> dist/libs/<lib>/types/ethlete-<lib>.d.ts
#    (plus the entry-point bundles).
npx tsc -p /tmp/cr09-dts/tsconfig.json   # {"compilerOptions":{"noEmit":true,"strict":true,"skipLibCheck":false,...},"files":[dist/libs/*/types/*.d.ts]}

# 3. Expect only the known no-op tags to survive (components 7, query 6).
grep -c "@internal" dist/libs/*/types/*.d.ts

# 4. Template guards survived.
grep -c "ngTemplateContextGuard" dist/libs/components/types/ethlete-components.d.ts

# 5. Consumer: swap dist into ea-frontend and run its AOT prod build (strictTemplates type-checks
#    templates against the stripped d.ts), then load the app.
yarn release:smoke --skip-sdk-build
```

Notes on step 5:

- `tools/release-smoke/config.json` has `"root": "../fut-frontend"`, and that directory does not exist
  on this machine; the app is `~/dev/ea-frontend`. Symlink `../fut-frontend` to it, or fix the
  config, before running.
- The smoke builds only `platform`. Most of the components surface ea-frontend uses lives in `hub`
  (rich text editor, table CSV export). After swapping, also run
  `npx nx run-many -t build -c production -p hub,platform` in ea-frontend. Or swap by hand
  (`node_modules/@ethlete/*` ← `dist/libs/*`) and run `npx tsc -p apps/<app>/tsconfig.app.json --noEmit` per app.

Make step 2 permanent: a small `tools/scripts/check-dts.mjs` run in CI after the build. Without it, the
next class member that is tagged while its interface member is not will ship a `.d.ts` that fails
`skipLibCheck: false` consumers.

## Edit-phase size

About 20 files and 50 one-line edits, plus 4 changesets (components, bracket, query-devtools, core)
and 2 docs touches (query-error guide, select guide). One sonnet agent can do it. The four builds plus
the d.ts check are the slow part (~15 min). The scheduler re-audit is separate and comes after the
rewrite lands.
