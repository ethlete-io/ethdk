# `et update` findings from fifagg-frontend

Reported on 2026-10-30 by the session `fifagg-frontend-a5`, with `@ethlete/cli` 3.0.0-next.23 and
`@ethlete/core` 5.0.0-next.69. Tom: the Studio builder session does these, in its queue.

## 1. Codemods fail without `ts-morph` - done

- **Pain:** `yarn et update --tag next` failed in the codemod `@ethlete/core surface-interaction-swatch`:
  "Cannot find package 'ts-morph' imported from
  node_modules/@ethlete/core/generators/migrate-surface-interaction-swatch/interaction-swatch.js".
- **Cause:** `ts-morph` is only an optional peer of `@ethlete/core`, and `et update` does not install it. Five
  core generators import it: interaction-swatch, legacy-color-themes, tailwind-4-surface-theme,
  tailwind-4-color-theme, color-theme-variants.
- **Fix options:** `et update` installs `ts-morph` before it runs a codemod that needs it, or the generator fails
  with a clear "add ts-morph" message.
- **As built (2026-10-30):** a migration declares `requires: ["ts-morph"]` in `migrations.json` (only
  `surface-interaction-swatch` needs it). `et update` and `et migrations run` add a missing one as a dev dependency
  with the repo's package manager, in its own commit, before the codemods; the version comes from the package's
  peer range. A failed add fails the codemod with "the generator needs ts-morph: add it as a dev dependency".
  Reaches fifagg only with a new core release. Verified: specs that fail without the fix. Not verified: a real run.

## 2. `et update --continue` commits foreign changes - done

- **Pain:** the user ran `yarn add -D ts-morph` and did not commit it. `yarn et update --continue` then put the
  `package.json` and `yarn.lock` change into its own commit "chore(deps): Sync the ethlete agent rules", which
  had no agent-rules change.
- **Fix:** commit only the paths `et update` wrote itself, or refuse on a dirty tree.
- **As built (2026-10-30):** cause: `--continue` reused the snapshot of the stopped run, so the user's later edits
  counted as the next step's change. `resumeCommits` adds those paths to the user's baseline; they are never
  committed, and a step that touches one is reported as blocked. Verified: a spec that fails without the fix.

## 3. `@nx/devkit` peer range - done

- **Pain:** `@ethlete/core` 5.0.0-next.69 declares the peer `@nx/devkit ^24`, but the migration guide names
  Nx 23.3.1 as the floor.
- **Fix:** make the peer range and the guide agree.
- **As built (2026-10-30):** the guide (`apps/docs/migrating-from-v4.md`) says Nx `^23.0.0`; 23.3.1 is in no doc.
  The peer is `>=23.0.0` in core, query, components, contentful and cdk. The libs use only devkit APIs that exist
  in Nx 23 (by reading, not installed).

## 4. The cdk `to-v5` codemod renames `theme` on app components - done

- **Pain:** reported 2026-10-30 by `fifagg-frontend-a5`, `@ethlete/cdk` 5.0.0-next.44. The codemod `to-v5` renamed
  `[theme]` to `[color]` and `theme=` to `color=` on about 219 template sites. It matched only the attribute name,
  so it also renamed app components with their own `theme` input (selectors `fifa-gg-*`, `gg-*`, app button
  directives). About 150 bindings now go nowhere, and ngc does not flag most of them.
- **Expected:** rename only on elements that the SDK button and component selectors match.
- **Evidence:** commit `f920736122` in fifagg-frontend, branch `chore/ethlete-next`.
- **As built (2026-10-30):** cause: `TEMPLATE_REPLACEMENTS` in `libs/cdk/generators/migrate-to-v5/color-themes.ts`
  ran `[theme]=` and `[altTheme]=` as plain `replaceAll` over every template. Now `renameSdkColorInputs` renames
  `theme`, `[theme]`, `altTheme`, `[altTheme]` only in start tags with `et-button`, `et-fab`, `et-icon-button` or
  `et-text-button` (the only SDK hosts that had `theme`), in `.html` and inline templates. The other renames are
  SDK-only names. Verified: specs that fail without the fix. Not verified: a run on fifagg-frontend.

## 5. `et migrations` does not list four migration generators - done

- **Pain (fifagg-frontend-c3, 2026-11-05):** `yarn et migrations` does not show `@ethlete/query:migrate-from-ngrx-toolkit`;
  fifagg still has `@tomtomb/ngrx-toolkit` in 475 files.
- **Cause:** no entry in `libs/query/migrations.json`. The same holds for core `migrate-create-destroy`,
  `migrate-color-theme-variants` and `migrate-legacy-color-themes`.
- **Fix (Tom OK):** an entry for each (`optional` while the old API still works, else `required`), and a check in the
  pre-push Checks and CI that fails on a generator that is neither in `migrations.json` nor marked as a scaffold
  generator in `generators.json`.

- **As built (2026-11-05, c874d9dd2):** three optional entries (core `create-destroy`, `color-theme-variants`; query
  `from-ngrx-toolkit`); `legacy-color-themes` was already listed through its scan entry. Five generators carry
  `"scaffold": true`. `tools/scripts/check-migration-entries.mjs` runs in CI; pre-push runs `yarn lint:migration-entries` (054231e81). 93e816bec fixed the pre-commit spec copy (finding 447). Not pushed.

## 6. `migrate-to-query-v3` imports `@ethlete/query-devtools` but does not add it - done

- **Pain (fifagg-frontend-c3, 2026-11-05, query 6.0.0-next.61):** the codemod rewrites
  `import { QueryDevtoolsComponent } from '@ethlete/query'` to `'@ethlete/query-devtools'` in three app components,
  but `package.json` does not get the package. The build fails on an unresolved import.
- **Fix:** the migration declares the package it needs (like `requires: ["ts-morph"]` in finding 1), and `et update`
  adds it with the same tag as `@ethlete/query` before the codemod; if the add fails, the codemod prints a manual
  task that names the package.

- **As built (2026-11-05, d98b915e4):** a migration lists the packages its output imports in `adds` (separate from
  `requires`, which fails the codemod). `et update` adds a missing one as a dev dependency first; an `@ethlete/*`
  package gets the dist tag of the migrating package. A failed add prints "Adding <pkg> failed: ... Add it as a dev
  dependency yourself" and the codemod still runs. Documented in `apps/docs/cli/update.md`. Narrowed in b478e76d2:
  `addsWhenFound` adds it only when a `.ts` file names `QueryDevtoolsComponent`.

## 7. `migrate-to-query-v3` leaves 141 TS errors in fifagg - done (B385)

Reported by fifagg-frontend-c3 on 2026-11-05 (query 6.0.0-next.61, 462 files, exit 0; all 5 apps fail to build). Log:
`/home/tom/dev/fifagg/fifagg-frontend/.claude/handoffs/query-v3/build.clean.log`, branch `chore/query-v3-migration`. Not triaged by fifagg.

- **Auth wiring:** call sites of `QueryClientRef.setAuthProvider` (12), `clearAuthProvider` (8) and `authProvider$` (8)
  stay as they are (fifagg `libs/core/src/lib/auth/auth.ts`, `libs/store/src/lib/interceptors/jwt.interceptor.ts`, which
  mix V2Query and LegacyQuery). The scaffolded auth provider in `gg-api.client.ts` names `postRefreshToken` and
  `AUTH_COOKIE_DOMAIN` without importing or defining them; also "Property 'token' does not exist on type '{}'" and
  `RequestRetryFn` vs `ShouldRetryRequestFn`. The guide ("Configure the auth provider") says the adapters come behind
  TODOs, so the provider is partly a known manual step; the old call sites with no task and the undefined names are
  codemod gaps.
- **GraphQL:** `gqlQuery` is missing on the migrated client ref (36 errors, `gg-graphql/*/*.queries.ts`); the `country`
  params become implicit any (TS7006).
- **Duplicate import:** TS2300 "Duplicate identifier 'AnyLegacyQuery'" (6): the codemod adds an import that exists.
- **Task list:** `query-v3-migration-tasks.md` has 68 tasks, none for the auth wiring call sites.
- **Fix direction:** reproduce each error class on a fixture taken from the fifagg shape (generic names), then: emit
  a task per old auth call site, define or import every name the scaffold uses, migrate or task `gqlQuery`, dedupe
  imports. Goal: the codemod leaves no TS error it does not name in a task.

Audit (ff, 2026-11-05): done - auth hook call-site tasks (4d824041d), scaffold imports and locals for
`postRefreshToken` and `AUTH_COOKIE_DOMAIN`, the duplicate `AnyLegacyQuery` import (3f23222d4). Partly - `gqlQuery`
gets a task only for `const x = <client>.gqlQuery(...)`; inline calls, class properties, calls in functions and client
aliases get none, and TS7006 is not named (ff builds it). Open - "Property 'token' does not exist on type '{}'" from
the untyped response in `auth-provider-scaffold.ts:299` (ff builds it).

Done (ff, 2026-11-05, not pushed): 0d9802845 - the scaffold's `extractTokens` casts the adapter result to
`{ token: string; refreshToken: string }` (spec checks the emitted text; not compiled against fifagg). 8c060133c -
every v2 `gqlQuery`/`gqlMutate` call shape (variable, inline property, class property, in a function or arrow, import or
local alias, untraceable ref wrapper) gets a "Rewrite the GraphQL creator X by hand" task that names TS7006, and
`createGqlQueryViaGet` when GET applies. The GraphQL part is task-only; the migration is REST-only. Next for ff: item 27
pins (gaps 1, 2, 4, 5, 6), then 000 part 2.

## 8. More `migrate-to-query-v3` gaps from fifagg - mostly done (B385)

Reported by fifagg-frontend-c3 on 2026-11-05 (query 6.0.0-next.61). Full list with file:line:
`/home/tom/dev/fifagg/fifagg-frontend/.claude/handoffs/query-v3/findings.md` (9 items; 1, 5 and 8 repeat section 7).

- **Token mapping:** the scaffold's `extractTokens` returns `{ token, refreshToken }`; it must map the v2
  `responseAdapter` to `{ accessToken, refreshToken }`. `buildArgs` reads `token.refreshToken` on a string.
- **Remember-me:** the scaffold omits `defaultRememberMe: true`. v2 wrote a 30-day cookie by default, v3 a session
  cookie. Set it when v2 had `cookieEnabled` unset or true.
- **Shared cookie across sibling hosts:** the generator maps v2 `cookieDomain` to `cookie.domain` silently, but v3
  obfuscates the cookie with a per-origin localStorage key, so a sibling host cannot read it. At least a task that
  names the behaviour change; whether v3 should support it is a product question for Tom.
- **Auth interceptors:** an `HttpInterceptor` that sets `Authorization` now also sees query requests and sends the
  bearer twice. Emit a task per such interceptor.
- **Client `retryFn`:** the v2 `RequestRetryFn` is copied unchanged into `createQueryClient` (type error). Port it or
  emit a task.
- **GraphQL:** `client.gqlQuery` calls (9) are not migrated, and v2 `request.gql.transferVia: 'GET'` is dropped
  silently; pick `createGqlQueryViaGet` from it.
- **Contentful client:** the generator adds `withEthleteApiErrors()` to a non-Ethlete GraphQL client (Contentful).
- **Done (ff audit):** token mapping, `defaultRememberMe`, interceptor tasks, the `retryFn` task (bcc5b4440),
  `transferVia: 'GET'` to `createGqlQueryViaGet` (0c02de9b1), no `withEthleteApiErrors` on Contentful, Shopify and
  Bynder clients (bcc5b4440), the docs bullet below (`migrating-from-v2.md:389-392`). The cookie bullet is superseded
  by B387 in section 9: `cookie.domain` shares on load (f0561a80e, a5f32c6a0), so the docs line 392 is right.
- **Docs (`apps/docs/query/migrating-from-v2.md`):** name two behaviour changes: proactive refresh retries up to 8 times
  with backoff and ends the session only on a definite failure (v2 dropped tokens and cookie on any failure); secure
  queries wait for a token instead of going out without one (check what the guide already says).

## 9. Tom's answers on the v3 behaviour changes (through fifagg-frontend-c3, 2026-11-05)

- **Cross-host cookie is a v3 gap (B387, built f0561a80e + 3bf4f45db, unpushed):** `withPersistentAuth` stores the cookie with a per-origin key, so apps on
  sibling hosts under one parent domain cannot share a login. v2 `cookieDomain` could. v3 must support it again; the
  SDK session proposes the design before it builds. The section 8 task for `cookieDomain` stays until then.
  Design proposal (ff, 2026-11-05): `withPersistentAuth` already has `cookie.domain` (default host-only); with
  `domain: '.fifa.gg'` sibling hosts share the cookie, and other scopes are adopted on start (a5f32c6a0). Only the
  migration scaffold sets no domain (warning QV3-054). Not solved by the cookie: multi-tab leadership and
  BroadcastChannel are per origin; remember-me is in per-origin localStorage; a refresh token that rotates on host A
  makes host B fail its next refresh with 401 and delete the shared cookie. Open grill questions for Tom (collected
  while afk): Q1 share on load only (migration writes `cookie.domain` from v2 `cookieDomain`) or live sync; Q2 on a
  refresh 401, re-read the cookie and retry once; Q3 share remember-me through a second cookie. ff recommends: load
  only, yes, no.
  **Decision (Tom, 2026-11-05, "q2ok"): share on load only.** No live sync across hosts; the migration writes
  `cookie.domain` from v2 `cookieDomain` into the scaffold. Technical defaults (doc agent, Tom did not object): on a
  refresh 401, re-read the cookie and retry once with the fresh token before the cookie is deleted (test: two hosts, A
  rotates, B refreshes); remember-me is not shared across hosts.
- **Refresh `maxAttempts` 8 (B385):** v3's retry is right, but the default 8
  (`libs/query/src/lib/auth/bearer-auth-query-builders.ts:102`, `:293`) has no stated reason. The docs name the reason,
  and the generator's scaffold writes `maxAttempts` explicitly so the app sees it.
- **Secure queries wait for a token:** accepted as an improvement. No finding.
- **Devtools always lazy (Tom, 2026-11-05, B385):** "ich denke auch wir sollten immer zu query devtools lazy migrieren".
  The v3 codemod rewrites the legacy `QueryDevtoolsComponent` to the `@ethlete/query-devtools/lazy` entry point, not to
  the eager one.
- **V2 client loses its legacy panel (f29e3f679, open question to Tom):** the codemod rewrites every legacy
  `QueryDevtoolsComponent` and `<et-query-devtools>` to the lazy shell. A client that stays on `V2QueryClient` after
  the migration loses its panel; the docs tell the user to mount it by hand.
- **Decision (Tom, 2026-11-05): keep it as built.** "es sollte nach der migration kein v2 mehr geben sonst hat die
  migration fehler gemacht". The codemod always rewrites to the lazy panel. A `V2QueryClient` left after the migration
  is a migrator defect, not a supported state: the docs stop describing it as one, and the migration report flags a
  leftover `V2QueryClient` as a migrator error to report.

## 10. More migrator findings from fifagg, items 10-26 (fifagg-frontend-c3 and -3d, 2026-11-05) - open

Full text with file:line in `fifagg-frontend/.claude/handoffs/query-v3/findings.md`, items 10 to 13. After hand fixes,
all five fifagg apps build on `chore/query-v3-migration`.

- **10. Union rename:** the codemod renames `AnyV2Query` to `AnyLegacyQuery` also inside `AnyV2Query | AnyLegacyQuery`.
  The result is a duplicate import and a narrowed type. Fix: keep `AnyV2Query` where the union already names
  `AnyLegacyQuery`.
- **11. Creator as a property value:** `queryCreator: getCompetitionMatches` (passed to `createInfinityQueryConfig`)
  keeps the v3 name, while every `.prepare` and `.createSignal` call site gets `legacyX`. Fix: rename every value
  reference to a migrated creator, not only member access.
  **Closed, fixed in 968337761 (ff).** The current generator on a copy of fifagg at 6ff3142096~1 left
  `match-rail.component.ts` unchanged. Cause: the legacy wrapper registry was keyed by creator name, and
  `getCompetitionMatches` exists in `apps/web-components` and in `libs/queries`; the last one won, and the app
  consumer failed the resolve check. Fix: a list of registrations per name; the spec fails without it. Lesson: the
  synthetic specs (e1f1aa645, bbe25129c) each had one creator per name and passed; only the run on the real repo
  found the name clash. A migrator finding that does not reproduce in a spec gets a run on a copy of the real repo
  before it is called not reproducible.
- **12. Wrong creator set into a signal (no migrator fix: the generators parse with `ts.createSourceFile`, no Program, and `tsc` already flags it; ff, 2026-11-05):** a PATCH query goes into a signal made from a POST creator. v2 typing allowed
  it; `LegacyQuery` args typing does not. Not a generator bug. The generator could list `createSignal()` signals that
  get `.set()` with the query of another creator.
- **13. Devtools in the initial bundle:** the codemod keeps a static `QueryDevtoolsComponent` import. The panel ships
  in production even behind `@if (isDev)` and pulls about 240 kB of `@ethlete/components` into the initial bundle
  (public 5.47 MB, admin 5.41 MB; budget 5 MB; on `next` 4.69 and 4.72 MB). `@defer` with `<et-query-devtools-lazy>`
  did not help: `libs/query-devtools/toggle/query-devtools-shortcut.ts:1` imports `detectKbdPlatform` from the
  `@ethlete/components` barrel. fifagg fixed it with a dynamic import behind `ngDevMode` and `NgComponentOutlet`. SDK
  fix: import from a leaf entry point. Generator fix: emit the dynamic-import form, or a task that names the bundle
  cost. SDK fix f4cd1b908 (toggle leaf import; a spec fails on any `@ethlete/components` import in `toggle/` or `lazy/`); finding 10 fixed by ff, not pushed. Cause, measured by fifagg-frontend-c3 on 319a70679c (esbuild metafile): the barrel was shaken (5 MB flat file to a 248 kB shared initial chunk); most of it came from the eager panel `ethlete-query-devtools.mjs` (14 menu and select symbols), which the codemod had kept as a static import. The toggle added only `detectKbdPlatform`; contentful adds `PictureComponent`. The earlier claim "lazy did not help" came from an unmeasured subagent run, so the golden had no gap. The real fix is the lazy rewrite in f29e3f679; the toggle leaf import is hygiene. Tool fix (ff default): a golden that fails when any `@ethlete/components` module is in the initial chunk of the lazy entry: built in 3ac97382b (`forbidInitial` in `goldens.json`); it failed on the old dist and passes after the fix. Goldens now lazy 4002 B, toggle 1782 B gz.
- **14. Legacy `prepare()` outside an injection context (fifagg-frontend-3d):** a full E2E run (`clock.runFor`) throws
  ET950: `"legacyGetNewsListByIds".prepare() was called outside of an injection context`. v2 needed no injector there;
  the legacy interop layer does. The codemod does not warn, and the migration doc does not list it as a behaviour
  difference. Call site not found yet. No API change (ff): `prepare({ injector })`, `createSignal` and
  `behaviorSubject` already take `{ injector }`, and `provideLegacyPrepareFallback()` already stashes the root injector
  (browser only; the query then lives as long as the app). The docs list it (`migrating-from-v2.md:304-352`). A
  codemod cannot wrap a call in `runInInjectionContext`, because a DOM handler or RxJS callback has no injector. Fix:
  the migrator reports each `.prepare(`, `.createSignal(` and `.behaviorSubject(` on a migrated creator outside a
  constructor, field initializer or `inject()` function, with the action "pass `{ injector }` or add
  `provideLegacyPrepareFallback()`". Tom (2026-11-05): "der migrator macht das schon nur wohl noch nicht gründlich genug der case muss also untersucht und ergänzt werden". ff finds what the migrator already does for out-of-context calls, why the `tap()` call site slipped through, and extends that handling to cover it. Result (ff): `legacy-prepare-migration.ts` already adds `injector: this.injector` by the innermost callback (the
  ESLint rule `no-legacy-prepare-without-injector` uses the same classification); the `tap()` shape is covered. The
  fifagg site slipped because fifagg commit 9482f80947 renamed gql consumers to `legacy*` by hand after the generator
  run (finding 8), so the prepare migration never saw them; a generator re-run fixes them. The `queryComputed` site is
  in context. Real gaps: `createSubject`, `createSignal` and `behaviorSubject` threw the same ET950 and were ignored
  (fixed in f9357ecbb, spec bites); a receiver that is not a plain `legacy*` identifier (`this.creators.legacyX`) is
  not seen (open, needs type info). B385 f gql part: 0c02de9b1 (`createGqlQueryViaGet` when v2 used `transferVia:
'GET'`).
- Bundle cost of v3 over `next`: about 90 kB `@ethlete/query` and 50 kB `@ethlete/core`.
- **Decision (Tom, 2026-11-05): the devtools panel mounts itself from a provider.** A first answer ("q1c ist
  tatsächlich smart": a `devOnly` helper) was reopened by Tom: apps already gate the provider in app config
  (`...(environment.production ? [] : [provideQueryDevtools()])`), so only the template element ships in production.
  Asked again; Tom: "q1ok" to the recommendation. `@ethlete/query-devtools` gets a provider that attaches the panel to
  the root component through a dynamic import; it sits in the same production gate as `provideQueryDevtools()`, so no
  template element is needed and nothing ships in production. The migrator removes `<et-query-devtools-lazy>` and the
  import, and adds the provider inside the existing gate. Docs show it as the default. Name and shape: ff. Built (ff,
  69b6f2adc, unpushed): runtime part. `provideQueryDevtools()` cannot import `@ethlete/query-devtools` (nx task-graph
  cycle query -> query-devtools -> query), so the app passes a loader: `provideQueryDevtools({ ui: () =>
import('@ethlete/query-devtools/lazy') })`; new export `mountQueryDevtools` in `/lazy` mounts after the first render
  and skips when a devtools UI is on the page (spec bites). Devtools e2e not run. Migrator part built (ff, 00137ba55,
  unpushed): with a legacy provider call in the project, it writes the `ui` loader and removes `<et-query-devtools>`
  (inline and `.html`) and the component from `imports`. Without a legacy provider call there is no gate to put the
  provider in, so it keeps the lazy tag and no app loses its devtools. Devtools e2e ran (4 passed).
- **15. Legacy creators report every error to `ErrorHandler` (fifagg-frontend-3d, built f0561a80e, unpushed):** v3 `http-request.ts:682` calls
  `ngErrorHandler.handleError` unless `reportErrors === false`. `createLegacyQueryCreator`
  (`legacy/interop/legacy-query-creator.ts:272-280`) does not pass `reportErrors: false`, and the migrator does not add
  it. v2 never reported. About 73 fifagg E2E tests fail on "Console errors or 5xx" (401 on `POST /auth/login`, 404 on
  public queries; `libs/queries/src/lib/gg-api/auth/auth.queries.ts:18`). fifagg workaround b30a5fba72: a helper that
  clones with `reportErrors: false`. **Decision (Tom, 2026-11-05, "q1ok"):** the migrator writes
  `reportErrors: false` visibly into every migrated creator (v2 behaviour, explicit in code, a team can switch it on
  per creator); the legacy interop default does not change.
- **16. Legacy `state$` replays a stale Success after `execute()` (fifagg-frontend-3d, not yet confirmed in a
  browser):** `legacy/interop/legacy-query.ts:231-238` builds `state$` from `toObservable(executionState)` plus
  `shareReplay`. A new subscriber right after `execute()` gets the old Success; v2 switched to Loading synchronously.
  fifagg: `libs/core/src/lib/auth/user-state.ts:102` (`refreshUserSuccessfully` with `take(1)` takes the old roles),
  used in `create-team-with-organization-overlay.component.ts:407-420`; `dashboard.spec.ts:178` fails. Fix (ff): v2
  parity in the interop layer, with a query scenario that bites.
  **Closed, fixed in 3ade7f27f (ff).** Cause: the `shareReplay` buffer on legacy `state$` held the old Success until
  the `toObservable` effect ran; the native v2 client already gave Loading. Fix: no `shareReplay`, so each subscriber
  starts from the current execution state. Scenario `libs/query/src/scenarios/legacy-state-replay.scenario.spec.ts`
  runs on both clients and failed on interop before. Lesson: no scenario compared the interop layer with the native
  v2 client, so a parity gap showed up only in a consumer E2E run. A legacy interop behaviour gets a scenario that
  runs on both clients. Full `nx test query` after the fix: 225 files, 3607 passed, 4 skipped, 0 failed.
- **17. More out-of-context `prepare()` shapes (fifagg-frontend-3d, extends 14):** no injector is added for
  `prepare()` in `ngOnInit` (`widget-link.component.ts:59`), in async validators after `timer`/`switchMap`
  (`gamer-tag.async.validator.ts:24`), in a plain `computed` (`edit-match-data.provider`), or in callback config
  functions (`events.component` `searchPreviewQueryFn`). Hand fixes in fifagg c9170f0d06. Fix (ff): extend
  `legacy-prepare-migration.ts` to these shapes, or report each one it cannot fix.
  **Result (ff):** the class shapes (`ngOnInit` RxJS callback, plain `computed` in a method, callback config function
  in a class field) already pass with the current generator on a fifagg copy at 6ff3142096~1; fifagg probably ran a
  build from before f9357ecbb. `widget-link.component.ts` uses a gql creator that fifagg rewrote by hand (QV3-046), so
  the migrator never saw it. The standalone shapes (gamer-tag validator, edit-match-data provider, playtime-tracker,
  upload-handler) get a manual-review task each, by design: a function with no `inject()` call can run outside an
  injection context, so the migrator cannot add one safely. Remaining work (ff): the task text proposes the concrete
  fix, `const injector = inject(Injector)` at the top of the factory and `{ injector }` at the call. **Closed in 0289807a8 (ff):** the task text now names this fix, with the caller injector, `queryComputed()` and `provideLegacyPrepareFallback()` as the other ways; the spec checks the text.
- **18. Legacy success before the store write (fifagg-frontend-3d, built a05cd7282, unpushed):**
  `legacy/interop/legacy-query.ts:230-258` announces success before the entity store is written, so a store read in
  the success callback returns null and `.onSuccess` gets no response. fifagg: broadcast create
  (`create-broadcast-overlay.component.ts:236`, dialog stays open), admin "New Collection", probably the
  competition-manager "without a reload" tests. Workaround fda4c3d8ad (the fifagg legacy helper waits for the store
  write). Fix (ff): v2 order in the interop layer, with a scenario on both clients. Root cause (fifagg-frontend-3d, item 22): `legacy-query.ts:238`
  creates the store sync effect without `injector: newQuery.subtle.injector`, so it runs as a view effect after the
  root `destroyOnResponse` effect (`legacy-query-creator.ts:295`); the query is destroyed before the store `set`, and
  the success is never published. One chain with 21. fifagg workaround now 6a2535c739 (store write once per response
  in `get`), proven in E2E.
- **19. Legacy `prepare()` returns a new wrapper for the same arguments (fifagg-frontend-3d, built in the working tree, commit after the push):**
  v2 returned the cached one. A `queryComputed` fed a fresh object on every check loops (NG0103).
  fifagg: `competition-consistency-rank.component.ts:50`, fed by a getter at `layout-dynamic-types.component.ts:112`.
  Workaround bdfe14a6cc (string ids). Fix (ff): v2 cache parity for equal arguments, with a scenario on both clients.
  Built rules (ff): reuse only inside one injector scope (WeakMap keyed by the host DestroyRef), only when `canBeCached`
  and not `skipQueryStore`; key = `queryStoreCacheKey` + sorted args without authorization; the entry leaves when the
  query's own injector DestroyRef fires. v2 `query.ts:228` refetch on an expired success already matches v3, so
  `execute()` is unchanged.
- **20. Devtools pill over app buttons in E2E (fifagg-frontend-3d):** `#et-query-devtools-pill`
  (`query-devtools-pills.ts`) sits on the body at the top z-index, bottom-right, over Save and Submit; hiding
  `et-query-devtools` does not hide it. About 25 E2E tests failed on blocked clicks. Workaround 76e304cb41: the apps
  load devtools only when `ngDevMode` and not `navigator.webdriver`. **Decision (Tom, 2026-11-05, "q3ok"):** the SDK does not show the devtools when
  `navigator.webdriver` is true; an option on the devtools provider switches them on again. The docs name the
  behaviour.
  **Proven in 2da18aaca (cb), browser proof only, no product change:** story `Automation` provides the devtools
  without `showInAutomation`; e2e group "query devtools / automation" checks on desktop and touch that pill, toggle and
  panel are hidden, nothing overlaps the app button and a plain click lands once; on `Default` the toggle is visible.
  Bite: with `Automation` set to true the hidden check fails. 9 passed, 5 skipped (keyboard on touch). Not verified:
  static Storybook build, CI shard selection. Lesson: every story set `showInAutomation: true` in the meta decorator,
  so no story showed Playwright the default automation behaviour. A default that only shows under automation gets a
  story that keeps the default.
- **21. Migrator adds `destroyOnResponse` wrongly (fifagg-frontend-3d, built 1bcd056ba + c034f6726, unpushed):**
  `legacy-prepare-migration.ts:1212-1223` `shouldAddDestroyOnResponse` checks only for polling, so a query kept in a
  signal, executed again, or bound to a template still gets `config: { destroyOnResponse: true }`; after the first
  response every later `execute()` does nothing. fifagg: `competition-data-participants.service.ts:107`
  (refreshQualificationSpots and Retry do nothing, hand fix eb1e122834, 3 E2E tests), `broadcast-live-layouts.component.ts:82`;
  56 sites got it, not audited. Fix (ff): add it only where the query is provably one-shot (not stored, not executed
  again, not in a template); otherwise leave it out, with a spec per shape.
  Audit (fifagg-frontend-3d, 816193c23a, not yet proven in E2E): `shouldAddDestroyOnResponse` returns `!hasPolling`
  and ignores containers, templates, return values and re-execution. 36 sites in 23 files were wrong; about 20 local
  fire-and-forget sites keep it.
- **Not an SDK defect:** `match-lobby-dispute.spec.ts:65` is no migration regression. It comes from fifagg commit
  826a6c6473 on `next` (elimination guidance needs a confirmation), fixed on the branch in 581a73f544.
- **22. ET800 loop is an app defect (fifagg-frontend-3d), no SDK fix:** `match-overlay-host.component.ts:542`
  `pollingStop$` starts a timer after every match success; for a match whose expected end is past it fires at once,
  and the refresh at :740-745 executes the match query again. v2 refetched too; v3's ET800 check exposes the old
  hidden loop. Fixed in fifagg 31f009d9aa. Docs task (ff): the migration guide says that ET800 can surface old loops.
- **25. Codemod splits an eslint-disable comment from its member (fifagg-frontend-3d; built 35bc8ca58 with the ET800 guide line):** the injector field goes
  between `// eslint-disable-next-line @angular-eslint/no-input-rename` and the aliased `@Input`, so the directive
  points at the wrong line: 3 lint errors plus an unused-directive warning
  (`navigation-cards/{country,nation,organizer}-navigation-card/*.component.ts:30-33`, fixed by hand 7374cc7b95).
  Fix (ff): insert the field before the leading comments of the next member, with a spec.
- **Receiver gap (item 14), decided by ff and the doc agent:** no type checker in the migrator. It reports every
  `.prepare` / `.createSignal` / `.behaviorSubject` whose receiver ends in a property named `legacy*`, with file:line
  and the action "pass `{ injector }` or add `provideLegacyPrepareFallback()`". Built after item 26.
- **26. A 401 hangs when the refresh returns the same token (fifagg-frontend-3d, their item 14):** the v3 client
  retries a 401 only when the access token changed (dist `ethlete-query.mjs:4675`). A refresh in the same second can
  return the identical JWT (whole-second `iat`, no `jti`); then no retry runs, no error surfaces, and the app's loader
  waits forever. Rare in production, but the silent hang is the defect. Fix (ff): a failed or same-token refresh
  surfaces the original 401 as an error; scenario with a same-token refresh. fifagg works around it in one e2e spec.
  Not reproduced (ff): same token, refresh 500 and a delayed 401 all end with `error().code` 401 and loading false
  (`auth-secure-query.scenario.spec.ts:90`). Asked fifagg for the build, the waiting loader, and legacy or native.
  Interop repro as fifagg described (ff): after 8 s `loading()` and `response()` are null, the 401 settles as the
  error state, no hang. The fifagg loader treats an empty response as loading and never reads the error. Closed as an
  app defect: read `queryStateErrorSignal` or `state$`. The receiver-gap report is built (6aeabe6ff).
- **27. Interop parity audit (ff, 6d8a002e9, unpushed):** `legacy.scenario.spec.ts` runs 28 tests on both clients;
  interop passes 21, the 7 gaps are pinned with `it.fails`: (1) `abort()` shows Cancelled only after a tick; (2)
  `execute({ cancelPrevious: true })` in one tick drops the Cancelled and the second Loading state (the request does
  abort); (3) an expired unused query stays `isInUse` until its prepare injector dies; (4) no refetch on window focus;
  (5) smart polling does not pause on blur; (6) `*etQuery` `triggeredVia` is `program`, not `auto` (cause of 4); (7)
  `prepare()` ignores the `mock` arg. 3 is by design; 7 is a defect (ff fixes it). The legacy `<et-query-devtools>`
  throws with the interop client: by design under Tom's "no V2 after the migration" decision (section 9). Open grill
  question for Tom (collected while afk): does the interop client get v2's focus refetch and blur polling pause (4, 5,
  6), and v2's synchronous state order (1, 2)? Recommendation: yes for both, so a migrated app keeps its behaviour.
  **Decision (Tom, 2026-11-05):** no parity for 4, 5, 6 - "neuladen und polling pause wurde in jedem projekt
  deaktiviert". 1, 2 ("q2bok"): keep the interop behaviour; the two specs pin it and the migration guide names it in
  one sentence. Built (ff, 088ef29fb, unpushed): gaps 1, 2, 4, 5, 6 are pinned as passing interop specs in
  `legacy.scenario.spec.ts` (88 passed, 2 skipped), with a bullet in `migrating-from-v2.md`; lint and tsc not run yet.
- **Devtools mount (ff item 000):** part 1 built fc98d3dae (`navigator.webdriver` hides panel, lazy shell and pills;
  provider option `showInAutomation`), per Tom's item 20 decision. Part 2 open: a new entry point with a dynamic
  import plus a codemod for `<et-query-devtools-lazy>`; ff proposes the name `@ethlete/query-devtools/mount`. Open
  grill question for Tom (collected while afk): the entry point name.
  **Decision (Tom, 2026-11-05, "q1ok"):** `provideQueryDevtools()` mounts the panel itself with a dynamic import; the
  migrator removes `<et-query-devtools-lazy>` from templates. Tom: "ist devtools nicht schon ein eigenes package?" -
  the entry-point shape (a fourth entry or a mount export from `/lazy`) is ff's call by the bundle goldens; `/toggle`
  never imports `/lazy`.
- **E2E proof (fifagg-frontend-3d, MR !1978):** 765 passed, 9 failed (7 WebKit environment, 2 season-wrap-up 500s
  from old API data). Items 15 to 21 are proven with the app workarounds (reportErrors helper, store write in get,
  devtools off under webdriver, destroyOnResponse removed at 36 sites).
- **23. `toQuerySignal` subscribes a cold source twice (fifagg-frontend-3d; built by ff in the working tree, `shareReplay` with refCount, scenario on both clients; commit after the push):**
  `data.utils.ts:277-279`. The template shows an unmanaged query; the container manages a second query that never
  executes. In fifagg: per keystroke on 3 filter-overlay pages and on 5 navigation cards (8 call sites). Fix: share
  the source in the SDK; fifagg's workaround is `queryComputed`.
- **24. Question: `queryComputed` and two changes in one tick (fifagg-frontend-3d; answered 083d98174: no leak on both clients, no code change):** `toObservable` plus
  `pairwise` may drop an intermediate query; that query is then never destroyed. Needs a scenario.
- **21b. Migrator, extends 21 (fifagg-frontend-3d; built 8985c2711: computed -> `queryComputed`, async validator -> `destroyOnResponse`):** it leaves `prepare()` in a plain `computed` (about 8 sites, one
  unmanaged query per input change) and in async validators (a POST per keystroke) with no `destroyOnResponse` and no
  container. fifagg fixes its sites by hand.

## 11. fifagg on next.62 (fifagg-sdk-findings-2026-11-06.md, 2026-11-06) - done (b89cae997)

Source: `plans/fifagg-sdk-findings-2026-11-06.md` (consumer handoff, German; deleted when done, in git at 99fb4e322). Installed: query 6.0.0-next.62, core
5.0.0-next.73, query-devtools 1.0.0-next.17, cdk 5.0.0-next.48.

- **16 reopened (high):** the fix 3ade7f27f does not cover the consumer flow. A `keepAlive` subscriber stays on
  `state$`; `execute()`, first response flushed; `execute({ skipCache: true })`; a second subscriber subscribes at
  once, before the second response. Expected `["LOADING"]`, received `["LOADING", "SUCCESS"]` (old data). Impact:
  `refreshUserSuccessfully` (`filterSuccess(), take(1)`) takes the old roles. fifagg works around it with
  `filter(() => !isQueryStateLoading(query()?.rawState))`; its spec
  `fifagg-frontend/libs/queries/src/lib/legacy-query-creator.spec.ts` is green only with that filter. Cause not
  verified. Fix: port the repro without the filter into `legacy-state-replay.scenario.spec.ts` on both clients, with the
  live subscriber, make it bite, then fix. Done when no old Success reaches any subscriber before the second response.
  Why the first fix missed it: its scenario covered a fresh subscriber only, not the consumer's exact steps; the item
  was closed without replaying the consumer repro. Process fix: a consumer-reported query bug closes only when the
  consumer's steps are ported one to one into a scenario (add this to the `query-scenario-tests` skill).
  **Built 105d2fe92 (cb, unpushed).** Cause: `toObservable(executionState)` keeps its own `ReplaySubject(1)`, so the old
  Success stayed buffered until its effect ran; 3ade7f27f removed only the outer `shareReplay`, and its scenario checked
  only `late[0]`. Fix: `state$` reads from an effect that feeds a plain `Subject`. The consumer scenario bit on the
  interop client (`['LOADING','SUCCESS']`), native v2 passed before and after. Rule 12 in `query-scenario-tests`. Not
  verified: the full query suite, and fifagg's own spec against a built package.
- **16 as built (ethlete-sdk-cb, 2026-11-06):** cause: `LegacyQuery.state$` read `toObservable(executionState)`, whose
  `ReplaySubject(1)` holds the previous Success until its effect runs; a subscriber that attaches right after
  `execute()` got Loading from `startWith`, then the buffered old Success. 3ade7f27f removed only the `shareReplay`, so
  the inner buffer stayed. Fix: `legacy-query.ts` feeds a non-replaying `Subject` from an effect instead of
  `toObservable`. Scenario `legacy-state-replay.scenario.spec.ts` ("keeps the previous Success from every subscriber
  until the refresh responds") ports the consumer steps with a permanent keepAlive subscriber and a
  `filterSuccess(), take(1)` subscriber on both clients; it bit on the interop client (`['LOADING','SUCCESS']`),
  native passed before and after. Rule 12 in the `query-scenario-tests` skill. Verified: the 20 legacy scenario files
  and the interop unit specs (332 passed), lint, typecheck, prettier, `query:export-coverage`. Not verified: the
  full query suite, the fifagg spec against a built package.
- **20 as built (ethlete-sdk-cb, 2026-11-06):** browser proof, no product change. A new story `Automation` provides the
  devtools without `showInAutomation`; `provideQueryDevtools` reads its options on its first call, so the stories now
  provide it per rendered story through a lazy decorator. `query-devtools.e2e.ts` "query devtools / automation": on
  `Automation` the pill, toggle and panel are hidden, none overlaps the app button, a plain `click()` lands once
  (desktop, touch), and the shortcut does not open the panel (desktop); on `Default` (`showInAutomation: true`) the
  toggle is visible. Bite: `Automation` with `true` failed with the pill visible. Verified: the devtools e2e folder
  against the dev Storybook (9 passed, 5 keyboard cases skipped on touch), lint and prettier. Not verified: the
  static Storybook build and the CI shard selection.
- **Migrator replay as built (ethlete-sdk-cb, 2026-11-06):** the current generator (SDK 9efe2aa41 builds wired into a
  clone) on fifagg bb07c334ed (parent of the migration 6ff3142096): 464 files, 74 tasks. tsc over app and lib sources
  115 baseline errors (dead dummy data, missing modules), 149 after, so 34 new; ngc the same 33, no template-only
  errors; ESLint 0 errors before and after, 43 to 55 warnings (unused vars). The 34: gql creators (9 + 3 implicit
  any, tasked, REST-only by decision), v2 auth wiring (17, tasked), the scaffolded auth provider (3, tasked as
  QV3-052/054/055), item 12 (1, decided), and one new gap: `QUERY_CLIENTConfig.get(` in
  `et-combobox-storybook.constants.ts:35` - `query-client-migration.ts:332` renames the client in its own file before
  `analyzeLegacyQueryCreators` matches the old name, so a creator next to its client is neither migrated nor tasked.
  Items: 10, 11, 13, 21, 25 proven fixed; 14, 17 as designed; 15 by decision; 21b partly - the async validator in
  `gamer-tag.async.validator.ts:25` still gets no `destroyOnResponse` (`isInsideAsyncValidator` checks only the
  innermost function, here a `switchMap` callback in an untyped factory); 16, 18-20, 22-24 not observable statically.
  Lint-warning gaps: unused renamed client imports in three `app.config.ts`, unused `computed` after the
  `queryComputed` rewrite. Not run: fifagg's jest and e2e, per-project `nx lint`.
- **Replay gaps as built (ethlete-sdk-cb, 2026-11-06):** A - `legacy-query-creator-migration.ts` maps the renamed
  `XConfig` back to `X` in the client's own file, so a creator next to its client migrates. B (21b) -
  `isInsideAsyncValidator` walks every enclosing function and also accepts a factory returning `AsyncValidatorFn` or
  an `Observable`/`Promise` of `ValidationErrors`; a validator `prepare()` without an injector in reach gets
  `destroyOnResponse: true` and keeps its task; a local `inject(Injector)` is reused instead of declaring a second
  one. C - the devtools and `queryComputed` rewrites drop an import only when they removed its last use. Each fixture is
  the trimmed fifagg shape and failed before its fix. Replay (465 files, 74 tasks): tsc 148 (115 baseline, so 33 new,
  all tasked or decided; the combobox error is gone), ESLint 0 errors, 42 warnings (baseline 43). Verified: the 21
  generator spec files, lint, prettier, `query:export-coverage`. Not verified: ngc, fifagg's jest and e2e, a runtime
  check of the validator, gql calls on a same-file client.
- **Rule (2026-11-06):** a migrator gap found in a consumer replay gets its spec fixture from that consumer's real code,
  trimmed, not a hand-written one, and the fixture fails before the fix.
- **18 confirmed on next.62:** entity store before `onSuccess`, both `destroyOnResponse` values. fifagg removed its
  workaround.
- **15 stays by decision:** `reportErrors: false` from the migrator; fifagg keeps `createSilentLegacyQueryCreator`.
- **20 needs a browser proof:** under Playwright `#et-query-devtools-pill` must not cover save/submit buttons, and
  `showInAutomation: true` must keep the UI. A devtools e2e case, not the contract alone.
- **Migrator items 10-25 (section 10) are not re-proven:** fifagg's tree carries hand fixes. Proof needs a replay of
  the migrator on the pre-migration fifagg commit, then tsc and lint on the result.
- **No SDK work:** 26 (consumer must read the error state), 22, 12, Swiss seeding, the V2 bearer cookie domain, 27
  (accepted interop differences).

## 12. fifagg ngrx-toolkit migration (fifagg-sdk-findings-2026-11-06-ngrx-toolkit.md, 2026-11-06) - open

Source: `plans/fifagg-sdk-findings-2026-11-06-ngrx-toolkit.md` (consumer handoff, German). query 6.0.0-next.62,
generator `@ethlete/query:migrate-from-ngrx-toolkit` on fifagg `chore/ngrx-toolkit-to-query-v3` (MR !1978): 44 of 49
features, 151 creators written, 98 tasks. Built by the third session of ADR 0200 (the builder stays on the perf block).

- **T1 (high): the generator leaves 217 new ngc errors** (315 -> 484; TS2345 83, TS2344 49, TS2339 40, TS2739 30,
  TS2684 4). Consumer types still expect the old handle where a `MappedEntityState<QueryCreator<...>>` now arrives
  (`NTK-UNCONVERTED-ACTION-GROUP` 35, `NTK-DUPLICATE-ROUTE-MISMATCH` 26), and a route with `pathParams` needs
  `withArgs()` (TS2684). The guide says the action-group task is "resolved by re-running"; here it was not. Doc agent
  decision: the generator rewrites those consumer types itself where the feature's group is not a toolkit group, adds
  `withArgs()` for a `pathParams` route, and the guide line is corrected for what stays a task.
- **T2 (medium): `moduleResolution: node` does not resolve `@ethlete/query/ngrx-toolkit`** (libs env, queries,
  uikit-mocks). Doc agent decision: the generator reads each affected project's effective `moduleResolution` and emits
  a named task (`NTK-MODULE-RESOLUTION`, with the tsconfig path) for `node`/`node10`; it does not edit tsconfigs.
- **T3 (medium): `NTK-FACADE-ON` has no interop replacement** (13 tasks, 31 type errors). fifagg built the same small
  service twice (emit when a handle's `callState$` reaches SUCCESS). Tom decided (ADR 0214): a public interop helper
  (`toolkitOnSuccess(handle)`), and the generator rewrites `NTK-FACADE-ON` sites to it.
- **T4 (low-medium): ET800 hits a test with fast `skipCache` reloads** (11 faked errors, each `reload()` ->
  `execute({ skipCache: true })`; the 7th request never went out, 5 of 8 runs red). The guide line on ET800 exists
  (35bc8ca58). Doc agent decision: no runtime change; the ET800 message names the query and says that repeated
  `execute({ skipCache: true })` calls count, and the guide line names tests that fake responses in a tight loop.
- **T5 (low): task texts.** `NTK-SERVICE-HEADERS` names the condition a header is set under (`isPlatformServer` ...);
  a barrel that still exports a deleted action group gets its own task (60 errors came from one stage-actions barrel,
  only `NTK-STORE-FILE-KEPT` was named once).
- **Why no tool caught T1/T2/T5:** the toolkit generator was never replayed on a real consumer with a type-check
  baseline; its specs use hand-written fixtures. The section 11 rule (fixture from the consumer's real code, fails
  before the fix) applies. Tool fix: a replay on the pre-migration fifagg commit with an ngc baseline diff is the done
  check of this section: every new error is either fixed or covered by a named task, and each fix gets a trimmed
  fifagg fixture.
- **T2 as built (9581d1af9, ethlete-sdk-62):** `module-resolution.ts` follows the `extends` chain of each project's
  tsconfig.lib/app/spec.json that imports `@ethlete/query/ngrx-toolkit` and records `NTK-MODULE-RESOLUTION` for
  `node`/`node10` with the tsconfig path. Spec from fifagg's real configs at 116a0d9afa; guide step 4 + Leftovers row.
  Not replay-verified. Lesson: generator specs never had tsconfigs in the tree.
- **T3 runtime as built (252c4d796, ethlete-sdk-62):** `toolkitOnSuccess(creator | creators[], { injector? })` in
  `toolkit-call.ts`; each handle reports a new success state to a per-EnvironmentInjector subject. Scenarios: any
  handle, array form, silent on failure, one emission for a joined request. Open: T1, T4, T5; the final replay.
- **T3 generator as built (48d952ee9, ethlete-sdk-62):** on a migrated facade `facade.on(x.success)` ->
  `toolkitOnSuccess(x, { injector })`, the array form likewise; the injector field is reused or added (resolver shared
  with toolkitSelect). A creator counts only when its import resolves to a converted file. `once()`, `.failure`, mixed
  arrays and unconverted creators stay `NTK-FACADE-ON`. Spec from a trimmed fifagg roster fixture, failing before.
  Replay at 116a0d9afa: 13 listeners rewritten, 0 `NTK-FACADE-ON` left, new ngc errors 107 -> 91 (16 TS2339 gone, none
  added). Harness: `.claude/handoffs/agent-results/fifagg-replay/`.
- **T1 cause A as built (9db874bd9, ethlete-sdk-62):** a consumer file naming converted and unconverted groups moves
  to the interop; only the unconverted `MappedEntityState`/`ActionCallArgs` refs become aliased
  `ToolkitMappedEntityState`/`ToolkitActionCallArgs` from `@tomtomb/ngrx-toolkit`. Spec from trimmed
  registration-details, failing before. Replay: new ngc errors 91 -> 29, none added. Lesson: "whole file stays on the
  toolkit" was designed, and no spec mixed both kinds of groups.
- **T1 cause B (doc agent decision, built 42a619e55, ethlete-sdk-62; replay 29 -> 7 new ngc errors, none added; spec
  of the VenueService shape failing before; lesson: the old fixture asserted the whole-feature keep, and nothing
  type-checked a real consumer):** a kept feature (`stage`, ~34 errors) keeps per file, not per feature:
  the files referenced from outside plus their in-feature import closure; the rest converts (actions, reducer, effects,
  selectors deleted, barrel -> queries, registration unhooked). If the closure reaches actions/reducer, everything is
  kept as today. `NTK-STORE-FILE-KEPT` names each kept file with its outside user (`layout.effects.ts:14`). A barrel
  exporting both actions and queries was rejected (TS2308).
- **Legacy `rawState` type as built (d76c6f151, ethlete-sdk-62):** `LegacyQuery.rawState` was `Success<unknown>`
  (the cf15ca5b8 mock-state signal typed `V2QueryState<unknown>`); now the wrapped creator's response. Type spec fails
  before. Lesson: no spec asserted the response type of the legacy state.
- **T5 part 1 as built (39eaeeb9c):** `NTK-SERVICE-HEADERS` names the headers, their source and the condition
  (`isPlatformServer(...)`), with the line. Open: T5 part 2 (barrel exporting a deleted group), T4.
- **Replay at 4 new errors, all covered by `NTK-SELECT-BY-ACTION-ID` (sharing):** the 3 `match-rail.component.html`
  errors were a harness artifact, not an SDK regression: the worktree held a copy of `@ethlete/query`, while cdk,
  components, contentful and query-devtools were symlinks into the main checkout and resolved a second declaration of
  `LegacyQuery` (private members, so not assignable). `run-generator.sh` now copies those dependents too. Lesson for
  any replay: every dependent of a swapped package is swapped as a copy too.
- **T4 as built (1518330a1):** the ET800 message names the route and says repeated `execute({ skipCache: true })`
  calls count (e.g. a test faking responses in a tight loop); route passed through `circularQueryDependencyChecker`
  in http, secure and gql execute. Scenarios: http-lifecycle asserts the route; legacy-state-replay runs 6x skipCache.
  errors.md row and the migrating-from-v2 ET800 bullet updated. Lesson: no test read the message, only
  `/circular dependency/`.
- **T5 part 2 closed (doc agent):** after cause B a barrel keeps an actions export only when the whole feature is
  kept, and then the group is live, not deleted; the replay has 0 such rows, and `NTK-STORE-FILE-KEPT` already lists
  every outside user. No real case, so no fixture (section 11 rule) - no new task.
- **Final replay (SDK 1518330a1, ethlete-sdk-62, 172 s):** fresh setup at 116a0d9afa, ngc over 65 tsconfigs vs
  baseline: 4 new errors (consumer's first run: 217), all in `libs/domain/shared/sharing` and covered by
  `NTK-SELECT-BY-ACTION-ID`; 74 tasks (first run: 98). Not run: fifagg jest, e2e, per-project lint, app boot, the
  package.json swap. Open: `NTK-MODULE-RESOLUTION` fired 0 times although the consumer hit it in env, queries and
  uikit-mocks and the baseline's TS2307 rows point at `node` resolution - explain before the section closes. Follow-up:
  an `NTK-DUPLICATE-ROUTE-MISMATCH` row says `{ phaseId?: PhaseId }` is not `{ phaseId?: PhaseId }`
  (getCompetitionStageBySlug): a mismatch must name what differs (declaration files of two same-named types), and two
  equal types raise no task.
