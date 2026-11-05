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

## 7. `migrate-to-query-v3` leaves 141 TS errors in fifagg - open (B385)

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

## 8. More `migrate-to-query-v3` gaps from fifagg - open (B385)

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
- **Docs (`apps/docs/query/migrating-from-v2.md`):** name two behaviour changes: proactive refresh retries up to 8 times
  with backoff and ends the session only on a definite failure (v2 dropped tokens and cookie on any failure); secure
  queries wait for a token instead of going out without one (check what the guide already says).

## 9. Tom's answers on the v3 behaviour changes (through fifagg-frontend-c3, 2026-11-05)

- **Cross-host cookie is a v3 gap (B387):** `withPersistentAuth` stores the cookie with a per-origin key, so apps on
  sibling hosts under one parent domain cannot share a login. v2 `cookieDomain` could. v3 must support it again; the
  SDK session proposes the design before it builds. The section 8 task for `cookieDomain` stays until then.
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

## 10. More migrator findings from fifagg, items 10-13 (fifagg-frontend-c3, 2026-11-05) - open

Full text with file:line in `fifagg-frontend/.claude/handoffs/query-v3/findings.md`, items 10 to 13. After hand fixes,
all five fifagg apps build on `chore/query-v3-migration`.

- **10. Union rename:** the codemod renames `AnyV2Query` to `AnyLegacyQuery` also inside `AnyV2Query | AnyLegacyQuery`.
  The result is a duplicate import and a narrowed type. Fix: keep `AnyV2Query` where the union already names
  `AnyLegacyQuery`.
- **11. Creator as a property value:** `queryCreator: getCompetitionMatches` (passed to `createInfinityQueryConfig`)
  keeps the v3 name, while every `.prepare` and `.createSignal` call site gets `legacyX`. Fix: rename every value
  reference to a migrated creator, not only member access.
- **12. Wrong creator set into a signal:** a PATCH query goes into a signal made from a POST creator. v2 typing allowed
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
  import, and adds the provider inside the existing gate. Docs show it as the default. Name and shape: ff.
