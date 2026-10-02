# DX scan 2026-10-02 — final report

The scan plan is `README.md`. Each domain file in this folder holds the findings, with a `Status:` and a `Review:` line per ID. The scan found 216 findings. The fix and review agents closed most of them. All work is committed on `next` (from `bb56ef294`). Nothing is pushed or published.

## 1. Human steps

- **FG-02:** retag `@ethlete/components` `latest` on npm. An agent cannot do this.
- **ea-frontend has uncommitted edits from the agents.** Review them in `~/dev/ea-frontend`, then commit or discard them. `git -C ~/dev/ea-frontend status --short` shows:
  - `apps/hub/eslint.config.mjs`
  - `libs/domain/hub/eslint.config.mjs`
  - `libs/domain/hub/src/lib/list-view/hub-list-view-saved-views-menu.component.html`
  - `libs/domain/hub/src/lib/list-view/hub-list-view.form.spec.ts`
  - `libs/domain/hub/src/lib/shared/utils/utc-date-time.provider.ts`
  - `libs/domain/platform/src/lib/campaign/squad-detail-view/components/player-item/core/renderer-state-event.provider.ts`
  - `libs/queries/hub/eslint.config.mjs`
  - `libs/queries/platform/src/lib/fut-api/fut-api.client.ts`
  - `libs/theme/src/lib/shared/ethlete-components/button.css`
  - `libs/theme/src/lib/shared/ethlete-components/segmented-button-group.css`
  - `libs/theme/src/lib/shared/ethlete-components/table.css`

## 2. Open user decisions (41)

The domain file of each ID has the full problem and the proposed fix.

| ID      | Question                                                                                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEL-04  | `et-select` has `error` (panel load error) and `errors` (validation). Rename `error` to `loadError` or `optionsError`?                                                                                                    |
| SEL-06  | Which one vocabulary for the select and the tag input: `maxSelection`/`maxTags`, `normalizeCustomValue`/`normalizeTag`, `separators`? Add `afterOpen`/`afterClose` to the select?                                         |
| QA-03   | Creators that share a cache entry use the options of the first one. Hash `responseType`/`withCredentials` into the key; and policy options (`retryFn`, `reportErrors`, `reportProgress`): split, or resolve per consumer? |
| QA-06   | A bare `execute()` on a parked `withArgs` query: no-op with a dev-mode warning, or throw a new code (breaking)?                                                                                                           |
| QA-09   | Each query creates 10 `toObservable` effects. A lazy variant changes the first-emission timing. Needs a design (one shared watcher in place of one effect per signal).                                                    |
| QA-13   | Move about 165 devtools-contract exports from `@ethlete/query` to a new entry point such as `@ethlete/query/devtools-contract`?                                                                                           |
| QB-02   | The ws client does not follow the auth session. Add an `authProvider` option? Must a token rotation force a reconnect?                                                                                                    |
| QB-12   | `latestExecutedQuery` / `latestNonInternalQuery`: move to the `subtle` namespace, or document them?                                                                                                                       |
| TG-01   | `tableRowsFromQuery` owns its state. Accept external writable signals (`sort`, `filters`, `page`, `quickFilter`) and add `pageSize`? How does it interact with `isResetBy`?                                               |
| TG-03   | Server sort/filter state is untyped. Options: (a) generic column key, (b) `sortKey`/`filterKey` on `TableColumn`, (c) a `filterValues<V>()` helper.                                                                       |
| TG-04   | Add `CHART_LABELS` / `provideChartLabels` for the 15 English chart defaults? Which keys, and which key-hint signature?                                                                                                    |
| TG-07   | Add a `(markActivate)` output to the four charts? Which payload shape?                                                                                                                                                    |
| SS-02   | How does `<et-scheduler>` take custom edit-surface fields: a `directives` option on `provideSchedulerEditSurface()`, or an `editSurfaceDirectives` input?                                                                 |
| SS-03   | Default views in a bare `[etScheduler]` render empty badges. Options: (a) a registry-backed feature host, (b) fall back to built-in adornments, (c) a dev-mode error only.                                                |
| SS-04   | `TExtra` is lost at `<et-scheduler>`. A generic component needs `appointments` renamed in `SchedulerFeatureHost` (for example `visibleAppointments()`, breaking). Do it?                                                  |
| SS-05   | The stream PiP slot placeholder is off by default. Options: (a) `provideStreamPip()` defaults it, (b) add it to `STREAM_DEFAULT_COMPONENTS`.                                                                              |
| BR-06   | `BracketRuntimeError` is now exported with a `code`. Is a soft-fail mode on `<et-bracket>` or a `validateBracketSource()` API wanted?                                                                                     |
| BR-08   | Add `bracketSlot.*` constructors for `BracketSlotSource`? Make it a discriminated union per `kind` (breaking)?                                                                                                            |
| RTE-05  | Give the multi-language editor a `triggers` input and expose the inner editor (`insertToken`, palette)?                                                                                                                   |
| RTE-06  | Move paste/drop/undo/autoformat/tool-hook handling from the component into the headless `[etRichTextEditor]`, or only correct the docs?                                                                                   |
| RTE-07  | The trigger popup puts `aria-expanded` on `role="textbox"`. The file marks it Decision: no, but it is not fixed. Confirm the fix (drop `aria-expanded`, set `aria-controls` only while open).                             |
| MISC-07 | The fix agent kept only `QueryDevtoolsComponent`, `QUERY_DEVTOOLS_IMPORTS`, `QUERY_DEVTOOLS_VERSION` in the panel entry. Confirm, and say if the about/settings components must be embeddable.                            |
| MISC-08 | The rich-text renderer cannot render a GraphQL rich-text field. Input shape: a `[gqlRichText]` input with `{ json, links }`, or a `createContentfulIncludeMapFromGqlLinks()` helper?                                      |
| MISC-13 | Contentful asset components: static `et-contentful-*` classes everywhere (drop the inputs), or string class inputs everywhere?                                                                                            |
| CR-05   | Spinner and progress bar invert the determinate flag and differ in `color`. One shape: `mode: 'determinate' \| 'indeterminate'`, or "determinate when `value` is bound"?                                                  |
| CR-06   | Tree `value` is `T \| T[] \| null`. Split into `value` / `values`, or a generic mode parameter? Apply the same rule to select and cascader.                                                                               |
| CR-09   | 537 `@internal` members ship as public API. Turn on `stripInternal`, or make members `protected`, after a check per member?                                                                                               |
| DT-05   | `timeRangeOrder` rejects overnight ranges. Add `allowOvernight`, or invert the default?                                                                                                                                   |
| DT-06   | Add `timeBounds()` / `timeRangeBounds()` validators?                                                                                                                                                                      |
| CORE-16 | Pointer capture is fixed. Rename `ResizeMoveEvent` fields to `totalDx`/`totalDy` and make `resizeEnded` emit the final event (breaking)?                                                                                  |
| FI-01   | The dev-mode warning for an empty error message shipped. Ship default texts for the built-in signal-forms kinds through `FORM_FIELD_LABELS`?                                                                              |
| OV-03   | Closing a query-param overlay pushes a history entry. Match the overlay router (`location.back()` when the open was ours, else `replaceUrl`)?                                                                             |
| OV-05   | Add `component` to `NotificationManagerConfig` for custom toast UI, or cut the guide section?                                                                                                                             |
| OV-06   | Typed overlay data: (a) a result marker `overlayResult<T>()`, (b) a typed `inputs` option on `open()`?                                                                                                                    |
| OV-14   | Overlay family names: `undefined` for both result paths, rename to `createCommandPaletteOpener`, add the transforms. Which names win?                                                                                     |
| EA-01   | Unsaved-changes `confirm`: add `provideUnsavedChangesConfirm()` and a default alert dialog with `UNSAVED_CHANGES_LABELS`, so `confirm` becomes optional?                                                                  |
| EA-02   | Overlay busy state: an `overlayRef.busy` signal or `setBusy(boolean)`, which blocks close sources and disables `etOverlayClose`?                                                                                          |
| EA-04   | Add `provideDateTimeZone(zone)` as an app-wide default for date controls? It was not part of the DT-01/04 token split.                                                                                                    |
| FG-05   | Reactive forms to signal forms: the report section and the guide are proposed. Is the reactive/signal forms interop of Angular a supported bridge?                                                                        |
| FG-13   | Add `standingRankSides()` / `swapStandingRank()` to `@ethlete/bracket`? Does the swap UI belong in components?                                                                                                            |
| FG-14   | Deprecate `createDestroy`, with an `auto` migration to `takeUntilDestroyed`?                                                                                                                                              |

## 3. Calls the coordinator made

A human can reverse each of these.

- **CR-01:** tab persistence is opt-in. With `sessionMemoryKey`, the stored tab wins over the initial `selectedIndex`.
- **FI-06:** a nested `provideFormFieldDefaults()` replaces the outer one. It does not merge.
- **OV-01:** `closeOnNavigation` closes an overlay only on a path change. A query or fragment change keeps it open.
- **Dropzone:** the label inputs moved to one `labels` input. Breaking.
- **DATE_FORMAT:** the default is now `yyyy-MM-dd`. Breaking.

## 4. Known gaps

- A navigation that a guard cancels leaves a stale overlay URL param.
- `yarn docs:error-codes:check` does not find error codes written as bare literals.
- FG-09: the assisted codemod is not done.
- The scheduler stories Headless, CustomBadgeAdornment and CustomEditField wait on SS-02 and SS-03.

## 5. What shipped

| Slice / item                                     | Commit(s)                                        |
| ------------------------------------------------ | ------------------------------------------------ |
| Release: Slack post skip without `slack-channel` | `52942c6e6`                                      |
| tooling                                          | `ed748cbcc`                                      |
| core                                             | `c90e4bbb9`                                      |
| query-a + query-b                                | `b6d8257d2`                                      |
| date-time                                        | `28276b407`                                      |
| select                                           | `f07ff79d2`                                      |
| rte                                              | `6a51a78ce`                                      |
| table-grid                                       | `87baf34a3`, `3d41fb723`                         |
| overlay                                          | `5a882d464`                                      |
| components-rest                                  | `075b0cd50`, `e197788c8`                         |
| bracket                                          | `f5b2e2370`, `2c35b3503`                         |
| misc-libs                                        | `2e6ce9277`                                      |
| sched-stream                                     | `818852bcb`, `06170a002`                         |
| form-inputs                                      | `0f30fdd97`, `d4a89e927`                         |
| DT-01/DT-04 date token split                     | `1f7fc5956`                                      |
| OV-01 `closeOnNavigation`                        | `d21962d18`, `31b53825c` (synced overlay router) |
| CR-02 `@ethlete/components/testing`              | `1e45567af`                                      |
| FI-06 `provideFormFieldDefaults()`               | `9b9be8ac1`                                      |
| consumer-fifagg                                  | `3b9a0107c`, `16bfd40e6`                         |
| consumer-ea                                      | `99fee2240`                                      |
| Changesets within the word bar                   | `1d51e5323`                                      |
| CR-12 error-codes page + CI check                | `1a6f5c22e`, `84f738d78`                         |

## Verification

Pending: full test run and ci-check (coordinator fills this in).
