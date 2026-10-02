# consumer-fifagg — DX scan 2026-10-02

Scope: consumer repo `/Users/tom/dev/fifagg-frontend` (branch `feature/20260819_bracket-challenge`), read-only.
It is on `@angular/core` 19.2.4, TS 5.7.3, Nx 21.1.2, Tailwind 3.4.17, `@ethlete/cdk` 4.56.1, core 4.28.0,
query 5.43.0, contentful 3.9.0, types 1.10.1, `@ethlete/theming` 2.6.1, `@ethlete/dsp` 0.2.0
(`package.json:42-173`). Question: what does it take to move it to core 5 / query 6 / components / contentful 4 /
the current theming, and what in the SDK (libs, `et` migrations, `apps/docs`) is missing for that.

Usage weight (named imports, `apps` + `libs`): cdk in 680 files, core 527, query 494, theming 268, contentful 65,
types 39, dsp 0. Top symbols: `QueryDirective` 260 (375 `*etQuery` template sites), `ProvideThemeDirective` 238,
`createDestroy` 232, `PictureComponent` 203, `queryComputed` 156, `queryStateResponseSignal` 124,
`SkeletonImports` 91, `InputImports` 80, `RepeatDirective` 71, `QueryErrorComponent` 64, `controlValueSignal` 62,
`QueryForm` 48, `createOverlayHandler` 40. Reactive forms: 223 files build `FormControl`/`FormGroup`, 273 files bind
`[formControl]`/`formControlName`/`[formGroup]`.

What is in good shape: every heavy core/query/contentful/theming symbol either still exists in the current libs or has
a codemod (core `to-v5`, cdk `to-v5`, query `to-query-v3`/`prep-for-query-v3`, contentful `to-contentful-v5`), and
every cdk v5 export the app uses has a row in `libs/cdk/migration-map.json`. The gaps are in the order of operations,
the parts no codemod reports, and the forms/styling rewrite.

| ID    | Sev    | Kind | Decision | Title                                                                                                  |
| ----- | ------ | ---- | -------- | ------------------------------------------------------------------------------------------------------ |
| FG-01 | High   | bug  | no       | Every published lib peers on exact versions (`@angular/core` `22.1.6`, `rxjs` `7.8.2`, TS `6.0.3`, …)  |
| FG-02 | High   | dx   | no       | `et update` keeps a v4-line repo on `latest` 4.x and never mentions the v5 line                        |
| FG-03 | High   | dx   | no       | No end-to-end guide for moving a v4-line app; the prerequisite order is spread over six pages          |
| FG-04 | High   | dx   | no       | `nx g @ethlete/cdk:migrate-from-cdk` and its task file are documented nowhere in `apps/docs`           |
| FG-05 | High   | dx   | yes      | No path from reactive forms to the signal-forms components, the app's biggest migration cost           |
| FG-06 | High   | dx   | no       | `migrate-from-cdk` ignores app stylesheets that restyle cdk classes (3147 lines, 182 `et-*` selectors) |
| FG-07 | Medium | dx   | no       | cdk 4-only symbols are in no map; `OVERLAY_STATE` is migrated by nothing                               |
| FG-08 | Medium | dx   | no       | core `to-v5` removed-export report misses `ObserveResizeDirective`, `ScrollObserverScrollState`, …     |
| FG-09 | Medium | dx   | no       | Legacy runtime theming → Tailwind 4 + surface themes has a one-paragraph guide and no codemod          |
| FG-10 | Medium | dx   | no       | `report-legacy-query-apis` does not list `*etQuery`, the app's most-used SDK API (375 sites)           |
| FG-11 | Low    | bug  | no       | `@ethlete/components` makes the test tool `@analogjs/vitest-angular` a peer of every app               |
| FG-12 | Medium | dx   | no       | The bracket challenge forked components@next.59 although `@ethlete/bracket` is framework-free          |
| FG-13 | Medium | dx   | yes      | `@ethlete/bracket` has no helper for "which participants can fill this standing-rank side" (swap)      |
| FG-14 | Low    | dx   | yes      | `createDestroy` (232 sites) is still exported undeprecated, with no codemod to `takeUntilDestroyed`    |
| FG-15 | Low    | dx   | no       | `JsonLD` moved from `@ethlete/types` to `@ethlete/core` with no codemod and no note                    |
| FG-16 | Low    | dx   | no       | Contentful docs say "Upgrading from v4? Run migrate-to-contentful-v5" for a lib whose next major is 4  |

## FG-01 Every published lib peers on exact versions

- Where: `libs/core/package.json:8-17`, `libs/components/package.json:10-24` (same in query, cdk, contentful).
  Published as-is: `npm view @ethlete/core@5.0.0-next.61 peerDependencies` →
  `"@angular/core": "22.1.6", "rxjs": "7.8.2", "typescript": "6.0.3", "@nx/devkit": "23.1.0", "ts-morph": "21.0.1",
"@floating-ui/dom": "1.8.0"`; components adds `"date-fns": "4.4.0", "@date-fns/tz": "1.5.0"`.
- Problem: the peers are the workspace's own exact versions (synced by `@nx/dependency-checks`). An app on Angular
  22.1.7 or 22.2.0, rxjs 7.8.1 (fifagg today, `package.json`), or date-fns 4.1 gets a peer conflict on every
  install - an error under npm's strict peers, a warning wall under Yarn. A consumer cannot take an Angular patch
  without a matching SDK release, and an upgrade from Angular 19 has to land on exactly 22.1.6.
- Fix: publish ranges. Either set the dependency-checks rule's peer strategy to a range, or rewrite peers at
  release time (`^22.1.0` / `>=22.1.0 <23` for Angular, `^7.8.0` rxjs, `^4.0.0` date-fns, `^1.6.0` floating-ui).
  Add a release check (`tools/`) that fails on an exact peer. Mark `@nx/devkit`/`ts-morph`/`typescript` optional in
  every lib that ships generators, as core already does.
- Breaking: no. Decision: no.
- Status: fixed - every published lib peers on ranges (`^22.1.0`, `^7.8.0`, …); `tools/scripts/check-peer-ranges.js` runs in `yarn versions:check` (CI + pre-push) and fails on an exact peer.
- Review: ok

## FG-02 `et update` keeps a v4-line repo on `latest` 4.x and never mentions the v5 line

- Where: `libs/cli/src/lib/update/registry.ts:256-265` (`tagForInstalled` → `'latest'` for a stable version),
  `libs/cli/src/lib/update/plan.ts:68-70`; docs `apps/docs/cli/update.md:61`.
- Problem: today's dist tags are cdk `latest 4.72.0 / next 5.0.0-next.37`, core `4.32.0 / 5.0.0-next.61`, query
  `5.44.0 / 6.0.0-next.54`, contentful `3.9.0 / 4.0.0-next.12`, components `latest 0.0.1`. fifagg running
  `yarn et update` (the docs say "Never bump an `@ethlete/*` range by hand") lands on 4.72/4.32/5.44, crosses none of
  the `to-v5`/`prep-for-query-v3`/`to-contentful-v5` migrations, and is told nothing about the line its migrations
  live on. It also does nothing for `@ethlete/components`, which the app does not have yet.
- Fix: in the plan output, print per package "a newer major is on `next`: 5.0.0-next.61 - run
  `et update --tag next`" when another dist tag holds a higher major. Point the line at the guide from FG-03.
  Consider retagging `@ethlete/components` `latest` (0.0.1 is a placeholder).
- Breaking: no. Decision: no.
- Status: fixed - `et update` prints `a newer major is on "next": … - run et update --tag next` per package with a link to the new guide, also when up to date. Retagging components `latest` is a registry action, left to a human.
- Review: ok

## FG-03 No end-to-end guide for moving a v4-line app

- Where: `apps/docs/cdk/index.md:34-41` (cdk `to-v5`), `apps/docs/core/index.md:43` (core `to-v5`),
  `apps/docs/query/migrating-from-v2.md`, `apps/docs/query/legacy.md`, `apps/docs/contentful/index.md:9`,
  `apps/docs/core/theming.md:427-429`, `apps/docs/cdk/migration.md`.
- Problem: the move has a hard order the docs never write down in one place: Angular 19 → 22.1.6, TS 5.7 → 6,
  Nx 21 → 23 and Tailwind 3 → 4 (every lib peers on them, FG-01); then core `to-v5` and cdk `to-v5` (cdk 4 → 5;
  the dialog/bottom-sheet merge, theming move, `*etLet` removal live there); query `prep-for-query-v3`; contentful
  (which now peers on components); only then `migrate-from-cdk` into components; and reactive → signal forms
  (FG-05) is a precondition for every form control. Each page covers its own lib and links one neighbour. A team
  reading `cdk/migration.md` first (the obvious entry) runs `migrate-from-cdk` against a cdk 4 tree.
- Fix: add `apps/docs/migrating-from-v4.md` (linked from the docs index, `cli/update.md` and each lib's migration
  section): the dependency floor, the codemod order with the exact commands (`et update --tag next` then the
  optional ones via `et migrations`), what each step leaves in which `*-tasks.md` file, and a "you are done when"
  checklist. Cite the fifagg numbers as a size reference.
- Breaking: no. Decision: no.
- Status: fixed - `apps/docs/migrating-from-v4.md`, linked from the docs index, `cli/update.md`, `cdk/index.md`, `core/index.md` and `query/migrating-from-v2.md`.
- Review: ok (sidebar entry under CDK)

## FG-04 `migrate-from-cdk` and its task file are documented nowhere

- Where: generator `libs/cdk/generators/migrate-from-cdk/migration.ts`, manifest `libs/cdk/migrations.json`
  (`from-cdk`, `from-cdk-decisions`, both `optional`), instructions `libs/cdk/migrations/from-cdk-decisions.md`.
  `grep -rn migrate-from-cdk apps/docs` → nothing. `apps/docs/cdk/migration.md:1-60` describes the map but no command.
- Problem: the lookup table is the only page a consumer finds, so 600+ rows get applied by hand. The codemod that
  rewrites every `move`/`rename` row and writes `migrate-from-cdk-tasks.md`, and the `since` gating ("Successors that
  need a newer package"), are invisible. Because both entries are `optional`, `et update` never runs them; only
  `et migrations` lists them.
- Fix: add a "Run the codemod" section at the top of `apps/docs/cdk/migration.md` (command, `--projects`/`--include`
  scoping if supported, that cdk `to-v5` must have run, that `@ethlete/components` must be installed first, the task
  file and the assisted `from-cdk-decisions` step) and link it from `cdk/index.md` "Superseded by".
- Breaking: no. Decision: no.
- Status: fixed - "Run the codemod" section in `apps/docs/cdk/migration.md`, linked from `cdk/index.md`.
- Review: ok

## FG-05 No path from reactive forms to the signal-forms components

- Where: consumer - 223 files with `new FormControl`/`FormGroup`/`FormBuilder`, 273 files binding them; cdk form
  imports `InputImports` 80, `SelectionListImports` 29, `SelectImports` 26, `SlideToggleImports` 25,
  `CheckboxImports` 20, `SegmentedButtonImports` 17, `ComboboxImports` 11, `RadioImports` 9; `QueryForm` 48;
  `controlValueSignal` 62. SDK - `apps/docs/cdk/index.md:76` ("If your app is still on reactive forms, the CDK form
  controls are the ones to use"); `apps/docs/components/forms.md` has no section for an app coming from reactive forms.
- Problem: components controls only bind through `[formField]` (known decision, no CVA). For this app that means
  every form control, every `QueryForm` filter bar, `provideValidatorErrorsService` (23) → schema messages, and the
  `controlValueSignal` call sites move together, or the screen stays on cdk. Nothing in the SDK tells the team how
  to do that per screen: no guide, no `migrate-from-cdk` report entry for "this cdk control is bound to a reactive
  `FormControl`", no example of mixing a cdk-reactive screen and a components-signal screen in one app.
- Fix: (a) `migrate-from-cdk` report: list every cdk form control bound with `formControl`/`formControlName`/
  `[formGroup]` as one section "needs signal forms first", grouped by component. (b) A guide
  `apps/docs/components/forms.md#coming-from-reactive-forms`: `FormGroup` → `form(model, schema)` mapping,
  validators → schema rules, `QueryForm` → `defineQueryForm`, server violations, and the screen-by-screen strategy.
  (c) Decide whether Angular's reactive/signal forms interop (if it fits the Angular 22 API) is a documented,
  supported bridge for a `FormControl` bound into an `et-*` control.
- Breaking: no. Decision: yes (c - whether an interop bridge is supported).

## FG-06 `migrate-from-cdk` ignores app stylesheets that restyle cdk classes

- Where: consumer `libs/theme/src/lib/ethlete-sdk/*.scss` - 3147 lines, 182 distinct `.et-*` selectors over 28 cdk
  components (`et-button.scss`, `et-input.scss`, `et-overlay.scss`, `et-select-combobox/`, `et-table.scss`, …).
  SDK `libs/cdk/generators/migrate-from-cdk/report.ts:194-209` (`scanStyleSheet`) and
  `libs/cdk/generators/migrate-from-cdk/templates.ts:161-162` only handle the legacy spinner colour variable.
- Problem: `apps/docs/cdk/index.md:24` tells cdk apps to do all visual design through the `et-` classes - so every
  cdk app has such a sheet. After the move, components render different class names and take their look from
  surface/colour tokens and component CSS variables; the old sheet silently matches nothing (or half of it matches
  and fights the new CSS). No report lists the dead selectors and no doc maps cdk classes to the components'
  tokens/variables.
- Fix: in `migrate-from-cdk`, scan `.css`/`.scss` for `.et-[a-z-]+` selectors and report each one that no
  components stylesheet defines (build the known-class set from `libs/components/src/**/*.css` at generator build
  time), grouped by component with a link to that component's Theming section. Add a "Your cdk styles" section to
  `apps/docs/cdk/migration.md` explaining tokens/CSS variables vs class overrides.
- Breaking: no. Decision: no.
- Status: fixed - `migrate-from-cdk` reports every app `.et-*` selector no components stylesheet defines, grouped by component; the known set is `components-classes.ts`, kept in sync by a file-snapshot spec. "Your cdk styles" docs section added.
- Review: ok (class snapshot regenerated)

## FG-07 cdk 4-only symbols are in no map; `OVERLAY_STATE` is migrated by nothing

- Where: consumer `libs/domain/shared/bynder/src/libs/services/bynder-media.service.ts:3,98`
  (`OVERLAY_STATE.OPEN`, `getState()`), plus `DialogRef`, `BottomSheetRef`, `DIALOG_DATA`, `BOTTOM_SHEET_DATA`,
  `provideDialog`, `DynamicOverlayService`, `OverlayBreakpointConfigEntry` (5). SDK `libs/cdk/migration-map.json`
  (none of these keys), `apps/docs/cdk/migration.md:9-13` ("a symbol missing here means the map is out of date").
- Problem: the map only knows cdk v5 exports. The v4-only names are handled by cdk `to-v5`
  (`libs/cdk/generators/migrate-to-v5/dialog-bottom-sheet.ts`, `overlay-positions.ts`) - except `OVERLAY_STATE`,
  which no generator, map row or doc mentions. A consumer looking up a v4 name reads "the map is out of date".
- Fix: add a "Removed before v5" block to the map (or the docs table) for the v4-only names, pointing at cdk `to-v5`
  and, for `OVERLAY_STATE`/`OverlayRef.getState()`, at the components `OverlayRef` state API. Reword the docs
  sentence to "every cdk v5 export".
- Breaking: no. Decision: no.
- Status: fixed - "Removed before v5" table in `apps/docs/cdk/migration.md` (the map spec allows only cdk v5 exports, so not in the map), `OVERLAY_STATE` pointed at `afterOpened()`/`afterClosed()`; sentence reworded to "every cdk v5 export".
- Review: ok

## FG-08 core `to-v5` removed-export report misses symbols

- Where: `libs/core/generators/migrate-to-v5/removed-exports.ts:6-34` (only `Memo*` and the props module).
  Consumer: `ObserveResizeDirective` in
  `libs/domain/public/competition/src/lib/views/bracket-challenge/bracket-challenge-save-bar.component.ts:14,81`,
  `bracket-challenge-bracket-panel.component.ts:13,67`,
  `libs/domain/shared/broadcaster/src/lib/partials/broadcast-iframe-preview/broadcast-iframe-preview.component.ts:3`;
  `ScrollObserverScrollState` from `@ethlete/core` in
  `libs/domain/public/competition/src/lib/partials/competition-short-news/competition-short-news.component.ts:12`;
  `SEO_DIRECTIVE_TOKEN` in `libs/domain/public/core/src/lib/directives/canonical.directive.ts:2`.
- Problem: all three are gone from core 5. `ObserveResizeDirective` is only mentioned in `libs/core/CHANGELOG.md:770`
  ("Use `signalElementDimensions()` instead"); `ScrollObserverScrollState` has a row only in the cdk map
  (`ScrollableScrollState`), which `migrate-from-cdk` applies to `@ethlete/cdk` imports only;
  `SEO_DIRECTIVE_TOKEN` is not in `libs/core/migrations/seo-directive-removed.md`. Also `LetDirective` and
  `IsActiveElementDirective` (core exports) are migrated only by the **cdk** `to-v5`, so an app without cdk that runs
  core `to-v5` is left with broken imports and no warning. The result is a compile error with no pointer.
- Fix: add every core 4.x export missing from core 5 to `REMOVED_EXPORTS` with its successor text (diff the 4.32
  `index.d.ts` against the current barrel in a spec so the list cannot drift), and move the `LetDirective`/
  `IsActiveElementDirective` import cleanup into core `to-v5`.
- Breaking: no. Decision: no.
- Status: fixed - `REMOVED_EXPORTS` covers all 113 core 4.32 exports core 5 dropped, with successor text; a spec diffs a checked-in 4.32 export list against the current barrel. `LetDirective`/`IsActiveElementDirective` are reported with a pointer, not rewritten (the rewrite stays in cdk `to-v5`).
- Review: ok

## FG-09 Legacy runtime theming → Tailwind 4 + surface themes: no guide, no codemod

- Where: consumer `apps/{admin,management,public,login}/src/app/app.config.ts` (`provideColorThemes(THEMES)` at
  `:65/:63/:63/:38`), `tailwind.config.ts:11,78` (`createTailwindColorThemes(THEMES, 'gg')`, Tailwind 3),
  `libs/uikit/presentation/src/lib/theming/themes.ts`. SDK `libs/core/src/lib/theming/legacy-theming.ts:233-236`,
  `apps/docs/core/theming.md:427-429` (one paragraph), `apps/docs/components/setup.md:55-74`.
- Problem: the theme data carries over (RGB triplets, `isDefault` - `ColorTheme` in `color-theme.util.ts:43`), but
  the setup does not: components want `provideColorThemesWithTailwind4` + `provideSurfaceThemesWithTailwind4`, the two
  Tailwind 4 generators and generated CSS. The app has no surface themes at all, a Tailwind 3 config built from the
  legacy helpers, and 98 `var(--et-color-*)` reads in its own CSS. The docs say only "deprecated, new apps should use
  the generator-based setup"; cdk `to-v5` moves the imports to core but leaves `provideColorThemes` in place.
- Fix: a "Migrating from runtime theming" section in `apps/docs/core/theming.md`: Tailwind 3 → 4 config, running both
  generators on the existing theme file, deriving a first surface theme set from an app's existing neutrals, which
  `--et-color-*` variables survive (the generator still emits them) and what `createTailwindColorThemes` becomes.
  Optionally an `assisted` core migration that rewrites `provideColorThemes(X)` → `provideColorThemesWithTailwind4(X)`
  and writes a task for the surface themes.
- Breaking: no. Decision: no.
- Status: fixed (docs) - "Migrating from runtime theming" section in `apps/docs/core/theming.md`. The optional assisted codemod was not built.
- Review: ok

## FG-10 `report-legacy-query-apis` does not list `*etQuery`

- Where: `libs/query/generators/report-legacy-query-apis/migration.ts:27-36` (collections, infinity, entity store
  only). Consumer: 260 `QueryDirective` imports, 375 `etQuery` template sites. SDK `libs/query/src/lib/legacy/
directives/query.directive.ts:77` (`QueryDirectiveType = AnyV2Query | AnyLegacyQuery | AnyQueryCollection`),
  `apps/docs/query/migrating-from-v2.md:177`.
- Problem: `*etQuery` is legacy-only by design and accepts no current-system query, so converting a creator off the
  interop breaks every template that renders it through `*etQuery`. The report that exists to list "what still needs
  a hand edit" skips the API with the most call sites, so the team cannot size or track the work.
- Fix: add a `*etQuery` / `[etQuery]` template scan and a `QueryDirective` import scan to the report, one task per
  template with the replacement from `migrating-from-v2.md#templates-read-signals-not-directives`.
- Breaking: no. Decision: no.
- Status: fixed - `report-legacy-query-apis` adds one task per `*etQuery` / `[etQuery]` template site of a component importing `QueryDirective`.
- Review: ok

## FG-11 `@ethlete/components` makes `@analogjs/vitest-angular` a peer of every app

- Where: `libs/components/package.json:10` (peer `"@analogjs/vitest-angular": "2.6.3"`, published so in
  1.0.0-next.66), source of it: `libs/components/src/test-setup.mjs:1-2`.
- Problem: a spec setup file makes the dependency check add a test runner as a peer; it is `optional` in
  `peerDependenciesMeta` (`package.json:27`), so an app on Jest (fifagg: `jest.config.ts`) is not blocked, but an app
  that has a different analog version installed gets a pinned-peer warning for a package the shipped code never
  imports.
- Fix: add `{projectRoot}/src/test-setup.mjs` to `ignoredFiles` of `@nx/dependency-checks` in
  `libs/components/eslint.config.mjs`, drop the peer, `yarn install`.
- Breaking: no. Decision: no.
- Status: fixed - peer dropped, `src/test-setup.{js,mjs,ts}` ignored by dependency-checks.
- Review: fixed - the same test-config peers (`vite`, `@analogjs/vite-plugin-angular`) dropped from cdk and query, `vite.config.*` ignored by their dependency-checks.

## FG-12 The bracket challenge forked components@next.59 although `@ethlete/bracket` is framework-free

- Where: consumer `libs/domain/public/competition/src/lib/views/bracket-challenge/bracket/*.ts` (785 lines, each
  headed "Copied from @ethlete/components@1.0.0-next.59 (MIT) … replace once this frontend runs Angular 22"),
  `bracket-challenge-pick-migration.ts` (200 lines), `bracket-challenge-slot.ts:3-4`. SDK `libs/bracket/package.json`
  (no peers, published `1.0.0-next.2`), `libs/bracket/src/lib/linked/migrate-bracket-picks.ts`,
  `apps/docs/bracket/index.md:47-74`, `apps/docs/components/bracket-prediction.md:231-290`.
- Problem: the app copied the old model (`createBracket(source, { previousMatchIds })`) and reimplemented
  `migrateBracketPicks` (same `pickByMatchId`/`movedFromByMatchId`/`strandedByMatchId` result) and
  `isBracketSlotPredictable` by hand, because it assumed the bracket needs Angular 22. The data/graph/prediction part
  is in `@ethlete/bracket`, which peers on nothing - but `apps/docs/bracket/index.md` never says it is usable without
  `@ethlete/components`/Angular 22, nor which TypeScript it needs (it is built with TS 6.0.3 / ng-packagr), and has no
  "from the components@next.59 model" note (source shape changed to slot sources).
- Fix: in `apps/docs/bracket/index.md`, state the support floor (no Angular, minimum TS - verify the `.d.ts` against
  TS 5.7 in a CI type-check fixture) and add a short "coming from `createBracket(source, { previousMatchIds })`"
  section. For fifagg the path then is: swap `bracket.ts`, `bracket-source.ts`, the pick migration and slot
  predicates for `@ethlete/bracket` now; keep the local renderer (`bracket.component.ts`, grid, edges) until Angular 22,
  then use `<et-bracket>` + `<et-bracket-pick-card>` + `et-standings-pick` (the group table).
- Breaking: no. Decision: no.
- Status: fixed - `apps/docs/bracket/index.md` gains "Use it without Angular" (no peers, ESM only, TS 5.0+ - the built `.d.ts` checked by hand with TS 4.9 and 5.0-5.9 under bundler and node16) and "Coming from the components@1.0.0-next.59 model". No CI type-check fixture added.
- Review: ok

## FG-13 No helper for "which participants can fill this standing-rank side"

- Where: consumer `bracket-challenge.component.ts:628-647` (`swapColumnsByMatchId`) and
  `bracket-challenge-swap-teams-overlay.component.ts` (`BracketChallengeSwapColumn { groupStageId, position,
candidates }`). SDK `libs/bracket/src/lib/linked/resolve-bracket-slot.ts` resolves forward only.
- Problem: the challenge lets a viewer change a knockout side whose source is `standing-rank` ("group A, 2nd") by
  picking another participant of that group, which rewrites the group order. The SDK resolves a slot to one
  participant but has no inverse: list the slots of a match whose source is a standing rank, with the standing id,
  rank and the participant set that could stand there, and apply a choice back to the group order. Every prediction
  app with groups + knockout will rebuild this.
- Fix: add to `@ethlete/bracket` a `standingRankSides({ bracket, matchId })` (side, standingId, rank) and a pure
  `swapStandingRank({ order, rank, participantId })` that returns the new order; optionally surface it on
  `<et-bracket-pick-card>`. Needs a design call on whether the swap UI belongs in components.
- Breaking: no. Decision: yes.

## FG-14 `createDestroy` is still exported undeprecated, with no codemod

- Where: `libs/core/src/lib/utils/angular/destroy.ts:4-17`. Consumer: 232 imports, used as
  `takeUntil(this._destroy$)`.
- Problem: core 5 is signals-first and Angular has shipped `takeUntilDestroyed()` since 16; `createDestroy` duplicates
  it with a `Subject<boolean>`, carries no `@deprecated`, and the core `to-v5` codemod does not touch it, so the
  largest single block of boilerplate in the app survives the migration unnoticed.
- Fix: decide whether to deprecate it. If yes: `@deprecated` with the replacement, and an `auto` migration that
  rewrites `private _destroy$ = createDestroy()` + `takeUntil(this._destroy$)` into `takeUntilDestroyed(this._destroyRef)`
  (field-initializer uses become plain `takeUntilDestroyed()`), reporting non-`takeUntil` uses.
- Breaking: no (deprecation only). Decision: yes.

## FG-15 `JsonLD` moved from `@ethlete/types` to `@ethlete/core` with no codemod

- Where: consumer `libs/domain/public/home/src/lib/views/home-page/home-page.component.ts:14,73`
  (`import { JsonLD } from '@ethlete/types'`). SDK `libs/core/src/lib/seo/json-ld.ts`,
  `apps/docs/core/seo.md:105-114`; `libs/types` has no `migrations.json` and `apps/docs/types/index.md` does not
  mention the move.
- Problem: on types 2 the import fails with "has no exported member 'JsonLD'" and nothing points at core.
- Fix: a `migrations.json` in `libs/types` with an `auto` import rewrite (`JsonLD` → `@ethlete/core`), or at least a
  line in the types guide and the types changelog.
- Breaking: no. Decision: no.
- Status: fixed - notes in `apps/docs/types/index.md` and `apps/docs/migrating-from-v4.md`, a types changeset. No codemod: `migrate-to-v5` has no import-rewrite map (only the one-off `createProvider` mover).
- Review: ok

## FG-16 Contentful docs name the wrong major

- Where: `apps/docs/contentful/index.md:9` ("Upgrading from v4? Run the codemod: `nx g
@ethlete/contentful:migrate-to-contentful-v5`"), `libs/contentful/migrations.json` (`to-contentful-v5` at
  `4.0.0-next.7`), `libs/contentful/package.json` (`4.0.0-next.12`).
- Problem: the lib's next major is 4 and fifagg is on 3.9. "From v4 … v5" reads as "not for you".
- Fix: reword to "Upgrading from 3.x to 4" and keep the generator name (or alias it `migrate-to-contentful-4`).
- Breaking: no. Decision: no.
- Status: fixed - the real line is 3.9 -> 4.0.0-next.12; the docs say "Upgrading from 3.x to 4" and name the generator's v5 as a misnomer; the generator's log line and report heading say 4. Generator and report file names kept.
- Review: ok
