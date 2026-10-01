# Gap 14: v3 replacements for the query button, collections, infinite scroll and EntityStore

Gap 14 of the v2 → v3 migration: v3 has no replacement for the cdk `QueryButtonDirective`, query collections,
the infinite-scroll trigger or EntityStore (dyn 45 / fut 39 buttons, dyn/dfb 27 / fifagg 54 collections, bvb 5 /
fifagg 16 triggers, bvb 13 / dyn 18 / fifagg 8 stores). The other gaps shipped. Research from 2026-09-27. Consumer evidence: fut
(`~/dev/ea-frontend`) and fifagg (`~/dev/fifagg-frontend`), both read-only. The hub (`apps/hub`,
`libs/domain/hub` in fut) is fut's v3-native code. The Dyn frontend is not checked out on this machine, so its
numbers are the ones the gap already names and are not verified. Paths start at the repo root of the app named.

| Item              | fut                          | fifagg                              | Decision                                                |
| ----------------- | ---------------------------- | ----------------------------------- | ------------------------------------------------------- |
| Query button      | 38 (legacy, uikit wrapper)   | not counted                         | `etQueryButton` directive, v3 and legacy sources        |
| Query collections | 4, all mutations             | 31 (30 in components, 1 auth)       | Build `createQueryGroup`, after the button              |
| Infinite scroll   | 0 (hub: 3 "load more" lists) | 20 legacy triggers in 16 components | Build `etPagedQueryTrigger`, medium priority            |
| EntityStore       | 1 store, dead code           | 8 stores (from the gap)             | No entity store; `invalidates`, tags, optimistic update |

## Decisions (user, 2026-09-27)

1. The query button has no success/failure flash. Loading and progress only. Results go to notifications.
2. `etQueryButton` accepts legacy (v2) queries, the same way the select and the dropzone do (see 1.2).
3. `createQueryGroup`: left to us. We build it (2.3).
4. `invalidates`, invalidation tags and optional `withOptimisticUpdate` instead of an entity store: accepted (4).

## 1. Query button

### 1.1 Usage and design

fut: 38 template uses in 30 components (dyn: 45, from the gap). All go through the uikit wrapper
`libs/uikit/src/lib/core/components/query-button/query-button.component.ts`, which hosts cdk
`QueryButtonDirective` on a native `<button>`. 26 run the query from `(click)`, 12 are `type="submit"`. About 25
also bind `[disabled]`. `skipSuccess` / `skipFailure` / `skipLoading` and `#x="etQueryButton"` are never used.
6 pick one member of a collection (`[query]="scope === 'x' ? query : null"`). The hub instead has 84
`[loading]="…"` bindings on `et-button` and shows a notification, not a flash.

Add a directive, not a new button. `ButtonDirective` already has `loading`, `progress`, `aria-busy`,
`aria-disabled` and the capture-phase click block. `ButtonDirective` gets an internal hook (self-registration,
as the architecture skill asks), so a sibling directive adds a loading source without overwriting the `loading`
input. `loading().progress` drives the determinate spinner. The directive only observes: the handler or the form
builds the args and runs the query, and confirmation stays in the handler.

```ts
// libs/components/src/lib/button/headless/query-button.directive.ts
export type QueryButtonSource = {
  loading: Signal<{ progress?: { percentage?: number } | null } | null | boolean>;
};

@Directive({ selector: '[etQueryButton]', exportAs: 'etQueryButton' })
export class QueryButtonDirective {
  /** A `Query`, `QueryBatch`, `QuerySequence`, query group, paged stack or v2 adapter. `null` = idle. */
  public query = input.required<QueryButtonSource | null>({ alias: 'etQueryButton' });
  /** Whether to show the upload/download percentage on the spinner. @default true */
  public showProgress = input(true, { transform: booleanAttribute });
}
```

```html
<button [etQueryButton]="deletePost" (click)="delete()" et-button>Delete</button>
<button [etQueryButton]="createPost.query" [disabled]="form().invalid()" et-button type="submit">Save</button>
```

It merges into `ButtonDirective.loading` / `progress`, so `data-loading`, `aria-busy` and the spinner come for
free. There is no `feedback` input, no `data-status` and no live region (decision 1).

### 1.2 Legacy queries: the select and dropzone approach

The select and the dropzone do not make the component input accept legacy queries. Each has one uniform,
structural shape that the component reads, and a separate `V2` factory that builds that shape from a legacy query
(paths under `libs/components/src/lib/`):

- Select: `selectOptionsFromQuery` and `selectOptionsFromV2Query` (`forms/select/select-options-from-v2-query.ts`)
  both return `SelectOptionsFromQuery<TOption>`.
- Dropzone: `createDropzoneUpload` and `createV2DropzoneUpload` (`forms/dropzone/headless/dropzone-upload.ts`)
  both return `AnyDropzoneUploadConfig<TValue>`, passed to the same `upload` input.
- Both V2 factories accept `AnyV2QueryCreator | AnyLegacyQueryCreator` (`V2QueryClient` creators and
  `createLegacyQueryCreator` interop wrappers). They read state with `queryStateSignal` from `@ethlete/query`
  (legacy utils, accepts `Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>`) and map it with
  `isQueryStateLoading` / `isQueryStateFailure`, including `progress.percentage`. They run in an injection
  context, because `queryStateSignal` uses `toObservable` and interop `prepare()` calls `inject`.
- `legacyQueryErrorSource` (`query-error/query-error-legacy.ts`) does the same for `et-query-error`.

The query button follows it. `QueryButtonSource` is the uniform shape. v3 queries fit it directly. Add one
factory next to the directive:

```ts
export const queryButtonSourceFromV2Query = (
  query: Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>,
): QueryButtonSource; // loading from queryStateSignal(query): true, or { progress } when the state has one
```

The button only observes, so the factory takes a query (not a creator), unlike the other two. Because
`AnyQueryCollection` fits too, fifagg's collections bind without change. The fut uikit wrapper can call the
factory on its own `query` input, so its 38 templates move to `et-button` without edits.

## 2. Query collections

### 2.1 Usage

fut has 4, all "one of N mutations, the latest wins" (`platform/.../user-view.component.ts:91`: create/edit/delete;
`graphics-actions.ts:47`: 7 actions; `public-link-overlay.component.ts:85`; `creator-suite.service.ts:90`).

fifagg has 31 collections: 27 `createQueryCollectionSignal`, 3 `createQueryCollection` (Subject), 1
`createQueryCollectionSubject` (auth). The gap's "54" counts lines, not collections. Shapes:

| Shape                                                     | Count | Example (under `libs/domain/`)                                                     |
| --------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| A. Action set, the latest wins (accept/decline, CRUD)     | 18    | `.../join-request-team-manager-overlay.component.ts`, `create-competition-sponsor` |
| B. One endpoint chosen by context (player/team, org/team) | 12    | `invite-manager-overlay`, `avatar-upload-overlay`, `match-lobby` (read)            |
| C. Auth (refresh, login, TFA)                             | 1     | `libs/core/src/lib/auth/auth.ts:71`                                                |

Use: about 20 feed one `*etQuery="collection(); loading as loading; error as error"` and bind
`<et-query-error [query]="collection()">`, so retry re-runs the member that ran last. About 10 places read one in
TS through `switchQueryCollectionState()`, `pushQueryCollection` (notify for the current member) or a
`type === '…'` check. No collection is a list or a keyed map of the same query; every one has fixed members.

### 2.2 Does plain fields + `computed` cover it?

- **B (12): yes.** The context (entity type, scope) is a signal, so
  `current = computed(() => isTeam() ? inviteTeam : inviteOrg)` selects the query. Nothing to track.
- **C (1): yes.** `createBearerAuthProvider` replaces it (`provider.executionState()`).
- **A (18 in fifagg, 4 in fut): only with hand-kept state.** No v3 query knows it was the last one run. Plain
  fields need a `last = signal<'accept' | 'decline' | null>(null)` that every handler sets, then `computed` for
  loading, error and the retry target: about 10 lines per site. If one handler forgets `last.set`, the page shows
  the other member's stale error, or retry runs the wrong request.

### 2.3 Recommendation: build `createQueryGroup`

Yes, but small, and after `etQueryButton`. The main reason is correctness, not line count: shape A is the most
common shape (22 of 35 known collections), and a group records "the member that ran last" inside `execute`, so a
handler cannot forget it. Secondary reasons: the group is one value that fits `et-query-error` (as a
`QueryErrorRetryTarget`) and `etQueryButton` (as a `QueryButtonSource`), and the ~22 migrations become
mechanical. Do not use it for shapes B and C; `migrating-from-v2.md` documents the `computed` pattern for B and
points C to the auth provider. Fixed members only, no `set()`, so it does not rebuild v2's swapping container.
Place it in `libs/query` (no UI), with a scenario test: "B fails, then A succeeds: `error()` is `null`".

```ts
const actions = createQueryGroup({
  accept: postAcceptInvitation(withArgs(() => null)),
  decline: postDeclineInvitation(withArgs(() => null)),
});

actions.members.accept.execute({ args }); // also records 'accept' as latest
actions.loading(); // any member loading (QueryButtonSource)
actions.error(); // error of the latest member only
actions.latest(); // { key: 'accept', response } | null
actions.execute(); // re-runs the latest member with its args (QueryErrorRetryTarget)
actions.succeeded$; // Observable<{ key; response }> - navigate, notify, refresh
```

## 3. Infinite scroll

### 3.1 Usage

fut: 0 triggers, 0 `createPagedQueryStack`. The hub's only paging UI is "load more" inside selects
(`hub-lookup-state.ts:83-120`, 3 uses, plus `selectOptionsFromQuery`); that stays a separate follow-up.

fifagg: 16 components with 22 legacy `createInfinityQueryConfig` + `*etInfinityQuery`, and 20
`etInfinityQueryTrigger` elements. 0 use `scrollContainerSelector`. Details:

- 18 triggers sit at the end of a horizontal `et-scrollable` (match rails, competition rails, galleries), 1 in a
  vertical `et-scrollable` (`public/profiles/.../related-teams.component.html:81`), 1 is a `<button>` (the
  legacy directive loads on click for buttons: `player-profile-gallery.component.html:59`).
- 18 of 20 are wrapped in `@if (canLoadMore && !loading)`. The trigger is destroyed and created again after every
  page, which forces a new observer callback. The apps work around the "still visible after load" problem by
  hand (see 3.2, point 1).
- 1 trigger switches between two queries in one rail: upcoming, then completed
  (`shared/competition/.../premium-match-rail.component.html:119`, `infinityQueryOverride`).
- 10 of 16 components also set `pollingInterval` on the infinite query.
- Hand-written paging: 2. The chat (`management/shared/.../chat.component.ts:415`) loads older messages at the
  top, prepends them and restores `scrollTop` from the `scrollHeight` delta; it is not query-based.
  `public/competition/.../competition-short-news.component.ts:81` loads on `ScrollObserver` `isAtEnd`.
- The other 8 `IntersectionObserver` uses are carousels, a marquee, picture-in-picture and a save bar. No
  virtual scroll anywhere. Dyn: not available locally; the gap names bvb 5.

### 3.2 Verdict: build `etPagedQueryTrigger`, medium priority

It is worth it. fifagg has 20 triggers on a deprecated API (removal in v7) and no v3 replacement. The value is
not the `IntersectionObserver` call. It is three details that a hand-written version gets wrong, and fifagg shows
all three:

1. An observer only fires on change. When a page loads and the sentinel is still visible, nothing fetches
   again. The directive re-checks when `canFetchNextPage()` turns `true`, so the `@if` workaround goes away.
2. It gates on `canFetchNextPage()`, which is already `false` while loading and on the last page.
3. `root` defaults to the nearest `et-scrollable`, so `rootMargin` pre-fetches inside a horizontal rail. With
   the viewport as root (fifagg today), the margin does nothing inside the rail.

Scope from the data: horizontal and vertical containers (the observer does not care about the axis), a
signal-bound input so `a.canFetchNextPage() ? a : b` covers the two-query rail, and no special button mode: a
button is `(click)="stack.fetchNextPage()"` with `[etQueryButton]`. `direction: 'previous'` stays in the API
(the stack supports it), but no fifagg use needs it: the chat is not a paged stack. No virtual scroll support.
Build on `signalElementIntersection` (`libs/core/src/lib/signals/element-intersection.ts`) and place it in
`libs/components` next to `select-options-from-query`. Before the fifagg migration, check that polling works on
a `createPagedQueryStack` (10 components need it).

```html
@for (item of posts.items(); track item.id) { … }
<div [etPagedQueryTrigger]="posts" [rootMargin]="'400px'"></div>
```

- Inputs: `etPagedQueryTrigger` (an `AnyPagedQueryStack`), `direction: 'next' | 'previous'` (default `next`),
  `root` (element or selector; default the nearest `et-scrollable`, else the viewport), `rootMargin` (default
  `'200px'`), `disabled`.
- Host bindings: `data-loading`, `data-exhausted`, `aria-hidden="true"`. exportAs `etPagedQueryTrigger`.

## 4. EntityStore (decided: no entity store)

fut declares 1 store that nothing reads (`libs/queries/platform/src/lib/fut-api/item/item.queries.ts:19`). Other
apps (from the gap): bvb 13, dyn 18, fifagg 8, with cross-store writes in fifagg `broadcast.queries.ts:24-62`.
The hub refetches instead: 27 hand-written `refresh()` calls, 0 `invalidateQueries`, 0 `subtle.setResponse`.

A normalized store fails on write-through: a PATCH that returns nothing or part of the object leaves the entity
wrong, and a side effect on another object is not in the response. v3 de-duplicates by cache key already. Build:

1. **`invalidates` on a mutation creator.** It runs `invalidateQueries` for its targets after success. The
   hub's 27 `refresh()` calls become one line on the creator.
2. **Tags**, for when the URL is not enough (`PATCH /people/1` changes `/opportunities/9`). A read declares tags
   from args/response; a write invalidates by tag. Tags are strings, so they cross the multi-tab
   `BroadcastChannel`.
3. **`withOptimisticUpdate`** (optional, per call site): a public, cache-wide form of `subtle.setResponse`. The
   updater gets the current response (and after success the mutation's, maybe `null` or partial) and returns the
   next value or `null` to skip. It applies before the request, rolls back on failure, and the `invalidates`
   refetch corrects a wrong guess.

```ts
export const getOpportunity = getQuery<GetOpportunityArgs>((p) => `/opportunities/${p.uuid}`, {
  tags: ({ args }) => [`opportunity:${args.pathParams.uuid}`],
});

export const patchOpportunityPerson = patchQuery<PatchPersonArgs>(
  (p) => `/opportunities/${p.uuid}/people/${p.peopleUuid}`,
  { invalidates: ({ args }) => [{ tag: `opportunity:${args.pathParams.uuid}` }, { url: '/people' }] },
);

patchOpportunityPerson(
  withOptimisticUpdate({
    target: ({ args }) => ({ tag: `opportunity:${args.pathParams.uuid}` }),
    update: ({ current, args }) => ({ ...current, people: toggle(current.people, args.pathParams.peopleUuid) }),
  }),
);
```

`invalidates` only re-runs reads that are in use, not entries waiting out `keepUnusedFor`, so it cannot cause a
request storm. Until it ships, document `invalidateQueries({ url })` after the write, not `subtle.setResponse`.

## Order and open questions

Status (2026-10-01): slice 1 shipped (`e4232a1b8`, `84def7337`). `QueryButtonSource` is a union: `QueryBatch` and
`QuerySequence` have `running` + `progress`, not `loading`. `QueryButtonDirective` is not in `BUTTON_IMPORTS`
(bundle golden). Slice 2 shipped (`5fa4b1fa5`): tags come from args only, `invalidates` on a read throws `ET2`, tag invalidations
cross tabs. Open: a retained unused entry is not marked stale. Slices 3 (`createQueryGroup`) and 4
(`etPagedQueryTrigger`) in progress, in parallel. Ship item by item.

Order: `etQueryButton` + `queryButtonSourceFromV2Query`, `invalidates` + tags, `createQueryGroup`,
`etPagedQueryTrigger`, `withOptimisticUpdate`.

1. Should `hub-lookup-state` and `selectOptionsFromQuery` move onto `createPagedQueryStack` in this project?
2. Ship as one "query v3 UI helpers" project, or item by item in the order above?
3. Verify the Dyn numbers (45 buttons, 27 collections, 18 stores) when the repo is available.
