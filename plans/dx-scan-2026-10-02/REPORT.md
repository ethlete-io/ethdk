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

## 2. Open user decisions (21)

The domain file of each ID has the full problem and the proposed fix.

| ID      | Question                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SS-03   | Default views in a bare `[etScheduler]` render empty badges. Options: (a) a registry-backed feature host, (b) fall back to built-in adornments, (c) a dev-mode error only.                                                                                  |
| SS-04   | `TExtra` is lost at `<et-scheduler>`. A generic component needs `appointments` renamed in `SchedulerFeatureHost` (for example `visibleAppointments()`, breaking). Do it? (The edit-field half is decided in `plans/scheduler-edit-surface-composition.md`.) |
| RTE-05  | Give the multi-language editor a `triggers` input and expose the inner editor (`insertToken`, palette)?                                                                                                                                                     |
| MISC-07 | The fix agent kept only `QueryDevtoolsComponent`, `QUERY_DEVTOOLS_IMPORTS`, `QUERY_DEVTOOLS_VERSION` in the panel entry. Confirm, and say if the about/settings components must be embeddable.                                                              |
| CR-06   | Tree `value` is `T \| T[] \| null`. Split into `value` / `values`, or a generic mode parameter? Apply the same rule to select and cascader.                                                                                                                 |
| CR-09   | 537 `@internal` members ship as public API. Turn on `stripInternal`, or make members `protected`, after a check per member?                                                                                                                                 |

## 3. Calls the coordinator made

A human can reverse each of these.

- **CR-01:** tab persistence is opt-in. With `sessionMemoryKey`, the stored tab wins over the initial `selectedIndex`.
- **FI-06:** a nested `provideFormFieldDefaults()` replaces the outer one. It does not merge.
- **OV-01:** `closeOnNavigation` closes an overlay only on a path change. A query or fragment change keeps it open.
- **Dropzone:** the label inputs moved to one `labels` input. Breaking.
- **DATE_FORMAT:** the default is now `yyyy-MM-dd`. Breaking.

## 4. Known gaps

- The scheduler stories Headless, CustomBadgeAdornment and CustomEditField wait on SS-03 and `plans/scheduler-edit-surface-composition.md`.
- Overlay router (`syncUrl: true`): after overlay B closes, the stale param of overlay A can come back from the old history entry of A. The browser cannot remove that entry.
- Commit `b53c99304` has the subject `test(components)` but also holds the SEL-02 source fix.

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

## 6. Endgame session 2026-10-03

| Item                                                                       | Commit(s)                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RTE-07 textbox ARIA                                                        | `f8d2982dc`                                                                                                                                                                                                                                                                     |
| Overlay URL param after a guard-cancelled navigation, and two review fixes | `df80a8246`, `046b1f89e`, `65448bd42`                                                                                                                                                                                                                                           |
| FG-09 `legacy-color-themes` migration (level `recommended`)                | `3a398122f`, `9fca6f2a5`, `291b82272`                                                                                                                                                                                                                                           |
| Error-codes check: bare literals, query, duplicates                        | `24ee259dd`, `a6654f5da`, `afe82a1ec`, `bf94fb6b1`                                                                                                                                                                                                                              |
| FI-05 `hidden` and `warnings` on every form control                        | `abc205668`, `95282ceee`                                                                                                                                                                                                                                                        |
| SEL-02 `aria-busy` on selection groups                                     | `b53c99304`                                                                                                                                                                                                                                                                     |
| Scenario tests (core, query)                                               | `4dc86c66c`, `8367ae41e`, `4378e96b7`                                                                                                                                                                                                                                           |
| Spec tests (components, cli, agent-rules, eslint-plugin, contentful)       | `81b05a500`, `f1f645a21`, `df12895c7`, `0b5fe2196`, `ece6ffb5b`, `d5084bdfe`, `e5e26bb88`, `7bd260292`, `c882d0978`, `4aee7c12d`, `2dcf74ad1`                                                                                                                                   |
| Storybook e2e: new suites and less flaky tests                             | `2262c6e2e`, `59ab99ab8`, `aa3a876e6`                                                                                                                                                                                                                                           |
| Docs audit                                                                 | `dc95a6a4d`, `a9f0c8adc`, `57f1abc2b`, `412d09301`, `1319dfc58`, `fce2af577`, `2368f8bd9`, `ce7b9034a`, `69e29adaa`, `c1a4f0ba8`, `de91bfd65`, `8873946c6`, `72a9d76d9`, `07d00881a`, `f67792cd8`, `6b9ed6ad0`, `bd94c9ee8`, `2e6257f30`, `6caa43285`, `ff7a991f9`, `f1bacbecf` |
| CI: export coverage, bundle goldens, sdk-docs skill                        | `8fe221099`, `29eb40ada`, `8dd9db72b`, `630403d4b`                                                                                                                                                                                                                              |

## Verification

All checks ran on 2026-10-03 against `next`. Nothing is pushed.

| Check                                                       | Result                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `nx test components` (quiet machine)                        | `Test Files 493 passed (493)`, `Tests 6225 passed \| 12 skipped (6237)`                                               |
| `nx test query`                                             | `Test Files 199 passed (199)`                                                                                         |
| `nx test core`                                              | `Test Files 124 passed (124)`                                                                                         |
| `nx test bracket`                                           | `Test Files 19 passed (19)`                                                                                           |
| format, `agents:check`, `versions:check`, `lint:changesets` | pass                                                                                                                  |
| `docs:error-codes:check`                                    | `All 268 error codes are documented.`                                                                                 |
| export coverage (query, core, components)                   | pass                                                                                                                  |
| affected typecheck, lint, test, build (base `main`)         | pass                                                                                                                  |
| treeshake bundle goldens                                    | pass (all entries within tolerance)                                                                                   |
| `nx build docs`, `build-storybook:ci`                       | pass                                                                                                                  |
| `test-storybook`                                            | `Tests 684 passed (684)`                                                                                              |
| storybook-e2e                                               | Changed suites pass with `--repeat-each=5`. Run the full suite in CI: on this Mac, some tests flake under heavy load. |
