# consumer-ea — DX scan 2026-10-02

Scope: the consumer repo `/Users/tom/dev/ea-frontend` (read-only), checked against the current SDK
source in `libs/`. Consumer paths are relative to `ea-frontend/`, SDK paths to `ethlete-sdk/`.

Usage profile: `@ethlete/cdk` is still imported in 314 files (`libs/domain` 256, `libs/uikit` 51);
`@ethlete/components` in 175 (mostly `libs/domain/hub`). `@ethlete/query` mixes the legacy layer
(`createLegacyQueryCreator` ×43, `QueryDirective` ×92, `queryStateResponseSignal` ×80) with the new
creators. Casts, `@ts-expect-error` and `eslint-disable` around SDK APIs are rare (one cast, two
disables). The friction sits in hand-written wrappers and CSS overrides.

| ID    | Sev    | Kind | Decision | Title                                                                                         |
| ----- | ------ | ---- | -------- | --------------------------------------------------------------------------------------------- |
| EA-01 | High   | bug  | yes      | Unsaved-changes `confirm` has no default, and an Observable confirm outlives the abort        |
| EA-02 | Medium | dx   | yes      | No busy state on an overlay: the app writes its own close guard + `aria-busy` directive       |
| EA-03 | Medium | bug  | no       | No public URL on a query: the consumer reads `_routeWithParams`, which `LegacyQuery` lacks    |
| EA-04 | Medium | dx   | yes      | No app-wide time zone for date controls: a UTC app needs two wire formats + 3 converters      |
| EA-05 | Medium | bug  | no       | Tri-state boolean inputs have no transform; the lint rule steers toward the inverted value    |
| EA-06 | Medium | dx   | no       | `notification.promise` rejects legacy queries, so the app keeps its own `pushQuery` service   |
| EA-07 | Low    | dx   | no       | `retryableStatusCodes` can only replace the defaults; http and auth defaults disagree on 500  |
| EA-08 | Low    | dx   | no       | Button icon and segmented-button sizes have no tokens; the app overrides raw properties       |
| EA-09 | Low    | dx   | no       | Table: no token for header ink or the selected-row tint; the app copies the private-var rules |
| EA-10 | Low    | dx   | no       | eslint-plugin: hand-composed configs silently drop `recommendedSpec`                          |

## EA-01 Unsaved-changes `confirm` has no default, and an Observable confirm outlives the abort

- Where (consumer): 12 `confirm: () => this.confirmDiscard()` sites, e.g.
  `libs/domain/hub/src/lib/partners/partners-view/partner-detail-view/partner-detail-sidebar/partner-general-infos-overlay/partner-general-infos-overlay.component.ts:77-83`,
  `.../partner-logo-overlay/partner-logo-overlay.component.ts:70-79`,
  `.../compare-asset-overlay/compare-asset-overlay.component.ts:228-250`,
  `libs/domain/hub/src/lib/people/people-add-overlay/people-add-person-overlay.component.ts:82,115`.
  Only two sites wire the abort signal by hand:
  `libs/domain/hub/src/lib/shared/bulk-edit/bulk-edit-page-guard.ts:17-37` and
  `.../widget-edit-overlay/widget-edit-page-guard.ts:18`.
- Where (SDK): `libs/core/src/lib/unsaved-changes/unsaved-changes-tracker.ts:45` (`confirm` required),
  `:110-114` (`firstValueFrom(result.pipe(take(1)…))`, never unsubscribed on abort),
  `libs/core/src/lib/unsaved-changes/unsaved-changes-coordinator.ts:12-24` (the JSDoc asks every
  caller to close its dialog on `abort`),
  `libs/components/src/lib/overlay/utils/overlay-unsaved-changes-guard.ts:44-61`.
- Problem: every guard needs a `confirm`, so the app writes a "Discard changes? / Keep editing"
  dialog at each call site (plus `confirmDiscardPartnerEdit` and two page-guard factories). The SDK
  already ships the right dialog (`createAlertDialogOpener().confirm`, a cold observable that closes
  on unsubscribe), but the tracker turns an Observable into a promise with `firstValueFrom` and never
  unsubscribes when the session ends. So even a confirm written the SDK way stays on screen over the
  login page after a logout or `abandonAll()`. 10 of the 12 consumer sites ignore `signal`, so they have
  this defect today.
- Fix: (1) in `unsaved-changes-tracker.ts`, add `takeUntil(fromEvent(signal, 'abort'))` when the
  confirm returns an Observable. Unsubscribing then closes an alert dialog by itself. Add a
  core scenario (logout while the confirm is open → no dialog left). (2) Add an app-wide default
  confirm, e.g. `provideUnsavedChangesConfirm(fn)` in core, and in components a
  default that uses `createAlertDialogOpener().confirm` with labels from an `UNSAVED_CHANGES_LABELS`
  token (title, message, "Discard", "Keep editing", `destructive: true`). `confirm` then becomes optional.
- Breaking: no (optional field). Decision: yes (new provider + default dialog copy).

## EA-02 No busy state on an overlay

- Where (consumer): `libs/domain/hub/src/lib/shared/directives/overlay-submitting/overlay-submitting.directive.ts:10-22`,
  used in `cancel-opportunity-overlay.component.ts:30-37,67,84-99` and `permission-menu.component.ts`.
  Every user also has to disable the `etOverlayClose` button by hand
  (`cancel-opportunity-overlay.component.ts:30`).
- Where (SDK): `libs/components/src/lib/overlay/overlay-ref.ts:64` (`registerCloseGuard` is the
  only hook), `OverlayMainDirective` / `OverlayCloseDirective`.
- Problem: an overlay that runs a mutation must not be dismissed halfway through by Escape, an outside
  click or a drag, and it should report `aria-busy`. The app builds this from `registerCloseGuard` plus an
  `event.source === 'api'` exemption, and disables the close button separately. This is a common need,
  and each piece is easy to get wrong.
- Fix: add `overlayRef.busy` (a writable signal, or `setBusy(boolean)`). While it is `true`: block
  every close source except `api`, set `aria-busy="true"` on the pane, and have `etOverlayClose`
  render disabled. Document it in `apps/docs/components/overlays.md`.
- Breaking: no. Decision: yes (new public API shape).
- Status: fixed (2026-10-06, `OverlayRef.busy` writable signal; d0f2410b9; e2e case in `dialog.e2e.ts`)

## EA-03 No public URL on a query

- Where (consumer): `libs/domain/platform/src/lib/campaign/squad-detail-view/components/player-item/core/renderer-state-event.provider.ts:248`
  - `url: (query as unknown as { _routeWithParams: string })._routeWithParams` on an `AnyLegacyQuery`.
- Where (SDK): `libs/query/src/lib/legacy/interop/legacy-query.ts:138-260`. The `LegacyQuery` that
  `createLegacyQueryCreator` returns has no `_routeWithParams` and no URL accessor at all. Only the
  old `V2Query` had it (`libs/query/src/lib/legacy/query/query.ts:114`). The new `Query` has no public
  resolved-URL signal either.
- Problem: the installed `node_modules` (query next.34) still types `_routeWithParams` on `V2Query`. On
  the current SDK the cast compiles, but the value is `undefined` at runtime, so the renderer's
  "loading query X" context silently loses its URL. The consumer only reached into a private
  field because there is no public way to ask a query which URL it is loading.
- Fix: expose a read-only `url: Signal<string | null>` (the last resolved request URL) on the new
  `Query`, and forward it from `LegacyQuery` (`get url() { return this.newQuery.url(); }`). Add a spec
  that checks the URL with path params and query params. Consumer migration: replace the cast.
- Breaking: no. Decision: no.
- Status: fixed - `Query.url()` (and `asReadonly().url()`) reads the bound request's full URL; `LegacyQuery.url` forwards it. Spec in `legacy-query-creator.spec.ts`; docs in `query/queries.md`, `query/migrating-from-v2.md`. Consumer cast replaced.
- Review: ok

## EA-04 No app-wide time zone for date controls

- Where (consumer): `libs/domain/hub/src/lib/shared/utils/wire-date-time.ts:1-110` (two value formats,
  `toFormDateTime` / `toFormInstant` / `toApiDateTime`, 29 call sites),
  `libs/domain/hub/src/lib/shared/utils/utc-date-time.provider.ts:15-18`, and `timeZone="UTC"` repeated
  on each `et-date-time-input` (5 sites).
- Where (SDK): `libs/components/src/lib/forms/date-time/date-input/headless/date-input.directive.ts:30-62`
  (no `timeZone` input), `date-time-input/headless/date-time-input.directive.ts:58` and
  `date-time-range-input/headless/date-time-range-input.directive.ts:65` (`timeZone` per instance
  only), `date-time-formats.ts:32` (`provideDateFormat` is the only app-wide knob).
- Problem: an app that shows every date as a UTC wall clock has to (a) drop the offset from the
  date-only format so date-fns does not shift the digits into the viewer's zone, (b) give
  `et-date-time-input` a different, offset-carrying format plus `timeZone="UTC"` on every instance,
  and (c) convert values both ways at every form seed and submit. The consumer's JSDoc spends about 60
  lines on this.
- Fix: add `provideDateTimeZone(zone)` (app-wide default for every date, date-range, date-time and
  date-time-range control; the instance `timeZone` input wins), and give date-only controls the
  zone-aware wall clock too. This overlaps with the DT-01/DT-04 decision (date-only wire format by
  default). Fold it into that work rather than adding it separately.
- Breaking: no on its own. Decision: yes (it lands with the DT-01/DT-04 token split).
- Status: fixed (2026-10-06, `provideDateTimeZone()`; date-only controls follow the zone when the value format carries a time; 2a2190f7c; open: `dateBounds`/`dateRangeBounds` still compare on the runtime calendar)

## EA-05 Tri-state boolean inputs have no transform

- Where (consumer): `libs/domain/hub/src/lib/list-view/hub-list-view-saved-views-menu.component.html:23`
  (`eslint-disable-next-line ethlete/prefer-static-boolean-properties -- closeOnActivate is tri-state`).
- Where (SDK): `libs/components/src/lib/menu/headless/menu-item.directive.ts:47`
  (`closeOnActivate = input<boolean | undefined>(undefined)`), and the same shape in
  `overlay/headless/overlay.directive.ts:51` (`hasBackdrop`), `pagination/pagination.component.ts:106`
  (`compact`), `match/match-participant.component.ts:119` and `match/headless/match-card.directive.ts:146`
  (`interactive`). The rule: `libs/eslint-plugin/src/rules/prefer-static-boolean-properties.js:59-66`.
- Problem: `[closeOnActivate]="true"` triggers the lint rule's "use a static attribute" suggestion.
  If the developer follows it, `<et-menu-radio-item closeOnActivate>` passes `''`, which is falsy, so
  the menu now stays open: the opposite of what they wrote, with no error. The rule cannot see the
  missing transform, so the consumer has to disable it.
- Fix: add an `optionalBooleanAttribute` transform to `@ethlete/core`
  (`v === undefined || v === null ? v : booleanAttribute(v)`) and use it on the five inputs above. Then
  the static attribute works and the rule's advice is correct. Add a spec per input for
  `closeOnActivate=""` → `true`.
- Breaking: no. Decision: no.
- Status: fixed - `optionalBooleanAttribute` in `@ethlete/core`, used on all five inputs, with a spec each; the SDK's own `[closeOnActivate]` disables and the column chooser's `KEEP_MENU_OPEN` field are gone. Consumer disable removed.
- Review: ok

## EA-06 `notification.promise` rejects legacy queries

- Where (consumer): `libs/uikit/src/lib/core/services/notification.service.ts:25-58` (`pushQuery` over
  `AnyLegacyQuery`, a `BehaviorSubject` store; 96 references to the service).
- Where (SDK): `libs/components/src/lib/notification/notification-promise.ts:58-80`. The overloads accept
  `ReadonlyQuery`, and `isQuery` tests `'executionState' in work`. A `LegacyQuery` has no
  `executionState` (it wraps one in `newQuery`, `libs/query/src/lib/legacy/interop/legacy-query.ts:200`).
  It fails both the query check and the promise/observable shape, so it is not accepted.
- Problem: the SDK already has the loading → success/error toast that the app re-implemented. But a
  codebase that still runs on `createLegacyQueryCreator` cannot pass its queries to it without knowing
  about the `.newQuery` escape hatch, so the custom service stays.
- Fix: accept `AnyLegacyQuery` in `NotificationPromiseFn` and unwrap it with `isLegacyQuery(work) ? work.newQuery : work`
  (`isLegacyQuery` already exists at `legacy-query.ts:117`). Add a spec. `queryButtonSourceFromV2Query`
  already does the same for buttons.
- Breaking: no. Decision: no.
- Status: fixed - a third `NotificationPromiseFn` overload takes `AnyLegacyQuery` and follows its `newQuery`. Spec + `notification.md` row. The consumer's `pushQuery` service (96 references) is left for its own migration.
- Review: ok

## EA-07 `retryableStatusCodes` can only replace the defaults

- Where (consumer): `libs/queries/platform/src/lib/fut-api/fut-api.client.ts:36-45` restates
  `[0, 408, 425, 429, 500, 502, 503, 504]` just to add `500`.
- Where (SDK): `libs/query/src/lib/http/query-retry-utils.ts:59-65,84-85` (the http default excludes 500, and
  `retryableStatusCodes` replaces the whole default), and
  `libs/query/src/lib/auth/bearer-auth-query-builders.ts:288` (the auth refresh default includes 500).
- Problem: adding one status means copying the default list, and the copy is already out of date: it
  drops 501 and 505+, which the http default retries. The two defaults also disagree on 500, so "what
  does the SDK retry" has two answers.
- Fix: let `retryableStatusCodes` also take `(status, isRetryableByDefault) => boolean`, or add
  `additionalRetryableStatusCodes`. Pick one rule for 500 in both defaults, or document why they differ.
  Consumer migration: the comment at `fut-api.client.ts:41-42` ("the policy cannot see the request
  method") is stale. `ShouldRetryRequestOptions.idempotent` (`query-retry-utils.ts:17`) already skips
  mutations.
- Breaking: no. Decision: no.
- Status: fixed - `retryableStatusCodes` also takes `(status, isRetryableByDefault) => boolean`; the refresh default keeps `500` and its JSDoc and `auth.md` say why. Spec added. Consumer `restartTolerantRetry` uses the predicate, stale comment dropped.
- Review: ok

## EA-08 Button icon and segmented-button sizes have no tokens

- Where (consumer): `libs/theme/src/lib/shared/ethlete-components/button.css:14-56` (sets `.et-button-icon`
  `font-size` per `data-size`), `segmented-button-group.css:1-35` (sets `height`, `font-size`, `gap`
  straight on `et-segmented-button`).
- Where (SDK): `libs/components/src/lib/button/button.component.css:158-170` (icon sized only by the
  inherited `em`), `libs/components/src/lib/forms/selection-list/segmented-button-group/segmented-button.component.css:60-62`
  (`font-size: 14px` hard-coded), `segmented-button-group.component.css:84-104` (sizes set `font-size`
  directly).
- Problem: the button exposes padding, font-size and gap tokens but not an icon size, and the segmented
  button has no height, font-size or gap token. So the app restyles internal elements and raw
  properties, which breaks on the next markup change.
- Fix: add `--et-button-icon-size` (default `1em`), and `--et-segmented-button-font-size`,
  `--et-segmented-button-height` and `--et-segmented-button-gap`, with the per-size blocks setting the
  tokens rather than the properties.
- Breaking: no. Decision: no.
- Status: fixed - `--et-button-icon-size` (font size of `.et-button-icon`, default `1em`) and `--et-segmented-button-font-size` / `-height` / `-gap`, which the size and tabs blocks now set. Docs in `button.md`, `choice-inputs.md`. Consumer CSS moved to the tokens.
- Review: ok

## EA-09 Table: no token for header ink or the selected-row tint

- Where (consumer): `libs/theme/src/lib/shared/ethlete-components/table.css:47-50` (header `color`),
  `:53-102` (six selected / hover / active rules copied with the SDK's own 12/18/26% values, reading the
  private `--_et-table-row-surface`), `:41-45` (`min-block-size` on cells as a row-height floor).
- Where (SDK): `libs/components/src/lib/table/table-select-cell.component.css:37-80`,
  `table.component.css:612-622`, and the token list in `table.component.css` (no
  `--et-table-header-color`, no `--et-table-row-selected-*`, no row min-height).
- Problem: to change the selection tint, or only to re-assert it under the cards appearance, the app
  copies the SDK's internal cascade, including a private custom property. Header ink and row height
  have no knob either. The copied values are identical to the SDK's, which suggests the app was working
  around an ordering problem with the cards sheet. A fix agent should check that in Storybook
  (cards + selection + hover) before adding tokens.
- Fix: add `--et-table-row-selected-tint` (with hover and active steps derived from it),
  `--et-table-header-color` and `--et-table-row-min-block-size`, and make the selected-row rules in
  `table-select-cell.component.css` outweigh the base hover/active rules instead of only tying with
  them (both are 0,3,0 today).
- Breaking: no. Decision: no.
- Status: fixed - confirmed the ordering bug in headless Chromium: with the base sheet re-appended after the select-cell sheet, a selected striped row lost its tint and a hovered one turned grey. Selected rules now use `.et-table-row.et-table-row--selected`. New `--et-table-row-selected-tint`, `--et-table-header-color`, `--et-table-row-min-block-size` (reaches skeleton rows). Docs in `table.md`. Consumer copies removed.
- Review: ok

## EA-10 eslint-plugin: hand-composed configs silently drop `recommendedSpec`

- Where (consumer): `libs/domain/hub/eslint.config.mjs:25-54` spreads `recommendedTs` and
  `recommendedTemplate` and never adds `recommendedSpec`. Then
  `libs/domain/hub/src/lib/list-view/hub-list-view.form.spec.ts:1` disables `ethlete/no-async-await`
  in a spec. `:49-53` turns `ethlete/require-on-push-change-detection` off on Angular 22.
- Where (SDK): `libs/eslint-plugin/src/index.js:162-167`, `src/configs/recommended.js:434-460`,
  `apps/docs/eslint/index.md:32`.
- Problem: once an app needs to override `files` or rules, it composes the pieces itself and loses the
  spec relaxations with no warning. Then it disables rules inline in tests.
- Fix: in the README and the docs "Composing" example, list `recommendedSpec` as required whenever the
  pieces are used one by one. Optionally have `recommendedTs` carry the spec override as a second
  entry (an array), so it cannot be dropped. Consumer migration: the OnPush `off` is no longer needed,
  because the rule is inert on Angular 22+ (`recommended.js:347-349`).
- Breaking: no. Decision: no.
- Status: fixed - docs warning + README line: composing the pieces needs `recommendedSpec` last. The array-shaped `recommendedTs` was not done (it changes the export shape). Consumer: `recommendedSpec` added to hub, queries/hub and apps/hub configs, the OnPush `off` and the spec's inline disable dropped.
- Review: ok

## Already solved in the current SDK (consumer migration only)

- **cdk → components is fully mapped.** Every one of the ~80 cdk symbols the consumer imports has an
  entry in `libs/cdk/migration-map.json`, and the successors I spot-checked exist
  (`defineQueryParamOverlay`, `createUnsavedChangesGuard`, `injectRouterNavigationState`,
  `resolveFilterOverlaySubmitButton`, …). The `@ethlete/cdk:migrate-from-cdk` generator has not been run.
  The real blocker is forms: 139 of the cdk files use reactive forms (`FormControl`/`FormGroup`), and the
  components controls are signal-forms only (a known decision). The hub list-view table is the one
  named holdout (`apps/hub/src/app/app.config.ts:64-66`).
- `ValidatorErrorsService` (`libs/uikit/src/lib/forms/services/validator-error.service.ts`) →
  `provideFormErrorMessageResolver` (`libs/components/src/lib/forms/form-field/form-error.component.ts:13`).
- `confirmOverlay` (35 uses, `libs/uikit/src/lib/dialog/confirm-overlay/confirm-overlay.component.ts`) →
  `createAlertDialogOpener().confirm({ destructive })`. Its padding and width differ, which global
  `.et-overlay` tokens can cover.
- The overlay sizes repeated about 10 times (`width: '100%', maxWidth: '64rem'`), and the
  `--et-overlay-padding-*: 3.2rem` restated in 30 files → `provideDialogStrategyDefaults` and one global
  `.et-overlay` token block (both documented in `apps/docs/components/overlays.md`).
- `fut-query-button` (cdk `QueryButtonDirective`) → `etQueryButton` + `queryButtonSourceFromV2Query`
  (`libs/components/src/lib/button/headless/query-button-source-from-v2-query.ts`).
- The auth-flow workaround at `libs/domain/auth/src/lib/auth-flow.ts:123-129` (cookie auto-login rejected
  with 401 never logs out) is fixed by `isRejectedRestore` in
  `libs/query/src/lib/auth/bearer-auth-query-builders.ts:744-752`. The `query.state === 'error'`
  branch can go.
- `node_modules` is older than `package.json` (components next.43, query next.34, cdk next.28
  installed, against next.59 / next.45 / next.31 declared). Run an install before verifying anything
  against the consumer.
