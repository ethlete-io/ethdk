# Gap 14: v3 replacements for the query button, collections, infinite scroll and EntityStore

Research for gap 14 of `plans/query-v3-migration-gaps.md`, 2026-09-27. Consumer evidence comes from fut
(`~/dev/ea-frontend`, read-only); the counts for the other apps are the ones the gap already names. The hub
(`apps/hub`, `libs/domain/hub`) is fut's v3-native code, so it shows what people write when the v2 helpers are
missing. Paths below are relative to `~/dev/ea-frontend/libs/domain/` unless they start with `libs/`.

| Item              | fut uses                                        | Recommendation                                                |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| Query button      | 38 (all legacy, through a uikit wrapper); hub 0 | New `etQueryButton` directive on the existing buttons         |
| Query collections | 4 files, 4 collections, all mutations           | Separate v3 queries + `computed`; optional `createQueryGroup` |
| Infinite scroll   | 0 (hub has 3 hand-rolled "load more" selects)   | Small `etPagedQueryTrigger` directive, low priority           |
| EntityStore       | 1 store, never read or written                  | No normalized store; declarative invalidation instead         |

## 1. Query button

### Usage

38 template uses in 30 components: platform 16, voting 12, voting-public 8, toty 2. None in the hub. Other apps:
dyn 45.

- None of them uses cdk `et-query-button` directly. They all go through the uikit wrapper
  `libs/uikit/src/lib/core/components/query-button/query-button.component.ts` (`fut-query-button` 33,
  `fut-outlined-query-button` 5), which hosts cdk `QueryButtonDirective`. All sit on a native `<button>`.
- All 38 bind a legacy query, and the directive only watches `state$`. 26 run the query from a `(click)` handler
  (`platform/.../save-changes-bottom-bar.component.html:7`), 12 are `type="submit"` and the form runs it
  (`platform/.../transfer-player-dialog.component.html:50`).
- About 25 also bind `[disabled]`, usually `form.invalid`. `skipSuccess` / `skipFailure` / `skipLoading` are
  never used, and no template reads the state through `#x="etQueryButton"`.
- 6 pick one member of a query collection: `[query]="scope === 'x' ? query : null"`, e.g.
  `platform/.../selection-list/selection-list.component.html:29`. This is the collection pattern (item 2).
- Only 1 confirms first, in the handler: `voting/campaigns/.../emails-table.component.ts:133`.
- What the button shows: loading dots, then a check or an exclamation icon for 1000 ms
  (`fut-query-button` template, `libs/theme/src/lib/shared/buttons/buttons.scss:297`). The button stays disabled
  while loading and while the icon shows. It sets `aria-live="assertive"` on the button itself.
- The hub has 84 `[loading]="…"` bindings on `et-button` instead, fed by `query.loading()`,
  `form().submitting()` or a hand-kept signal (`deletingUuid`, `mailingUuid` in
  `hub/.../permission-menu/permission-menu.component.ts:179-182`). It never flashes success or failure; it shows a
  notification.

### Recommendation

Add a directive, not a new button. `ButtonDirective` already has `loading`, `progress`, `aria-busy`,
`aria-disabled` and the capture-phase click block, so a query only needs a way to feed those: `ButtonDirective`
gets an internal hook (self-registration, as the architecture skill asks) so a sibling directive can add a loading
source without overwriting the `loading` input. New over v2: `loading().progress` drives the determinate spinner.
The directive only observes, like cdk's. The handler (or the form) keeps building the args, so there is no
`execute` input, and confirmation stays in the handler.

### API sketch

```ts
// libs/components/src/lib/button/headless/query-button.directive.ts
export type QueryButtonSource = {
  loading: Signal<{ progress?: { percentage?: number } | null } | null | boolean>;
  error?: Signal<unknown>;
};

@Directive({ selector: '[etQueryButton]', exportAs: 'etQueryButton' })
export class QueryButtonDirective {
  /** A `Query`, `QueryBatch`, `QuerySequence`, `createQuerySubmission(...).query` or paged stack. `null` = idle. */
  public query = input.required<QueryButtonSource | null>({ alias: 'etQueryButton' });
  /** Flash a success or failure state after the query settles. @default 'none' */
  public feedback = input<'none' | 'flash'>('none');
  /** Whether to show the upload/download percentage on the spinner. @default true */
  public showProgress = input(true, { transform: booleanAttribute });

  public status: Signal<'idle' | 'loading' | 'success' | 'error'>; // read-only, for templates
}
```

```html
<button [etQueryButton]="deletePost" (click)="delete()" et-button>Delete</button>
<button [etQueryButton]="createPost.query" [disabled]="form().invalid()" et-button type="submit">Save</button>
```

Bindings: it merges into `ButtonDirective.loading` / `progress`, so `data-loading`, `aria-busy` and the spinner
come for free. With `feedback="flash"` it also sets `data-status="success|error"` for 1000 ms, stays inactive
while the state shows, and announces the result in a visually hidden `role="status"` region (components has no
`@angular/cdk`), not `aria-live` on the button, which re-reads the label. Tier 3 `et-button` renders the icon for
`data-status`. The structural `QueryButtonSource` follows `QueryErrorRetryTarget`, so a legacy query fits through
an adapter like `legacyQueryErrorSource`.

## 2. Query collections

### Usage

fut has 4 collections, all of them "one of N mutations, the latest wins". Other apps: dyn/dfb 27, fifagg 54.

- `platform/src/lib/users/user-list-view/user-view/user-view.component.ts:91`: create/edit/delete. One error
  banner, and on success of any of them it navigates (`:205-213`).
- `platform/.../collection-detail-view/graphics-actions.ts:47`: 7 actions (accept, download, report, …). The
  preview overlay refreshes on any success (`graphic-preview-overlay.component.ts:80-86`), and 6 query buttons
  pick "their" action by `scope`.
- `platform/.../public-link-overlay/public-link-overlay.component.ts:85`: create/refresh, and the template reads
  the latest response as the active link.
- `platform/.../creator-suite.service.ts:90`: 3 PUT creators. This is the Subject-based `createQueryCollection`
  (it breaks the signals rule), and it notifies and clears the form on success (`:204-215`, `:366-375`).

What they need: (1) one `loading` / `error` for the group, for a banner or to disable the form; (2) "any member
succeeded", with its response; (3) the latest member's response; (4) which member runs, for per-button loading.

### Recommendation

v3 removes the reason collections existed. In v2 every call made a new query object, so something had to hold
"the current one". A v3 query is created once and re-executed with new args, so the collection turns into a fixed
set of fields. Needs 1-3 are then a few lines of `computed`. The hub already does this for reads
(`hub/.../partner-opportunity.provider.ts:48-50`: `loading`/`error` over three queries). Need 4 is simply each
button binding its own query (item 1).

The other v3 tools do not fit: `createQueryStack` and `createQueryBatch` run one creator, `querySequence` is for
dependent chains, and `withSuccessHandling` per member covers need 2 but repeats the handler.

What is left is small. Offer `createQueryGroup` only if the ~80 dyn/fifagg uses would otherwise all repeat the
same `computed` block. Otherwise document the pattern in `migrating-from-v2.md`.

### API sketch (optional)

```ts
const actions = createQueryGroup({
  create: putUser(withArgs(() => null)),
  edit: patchUser(withArgs(() => null)),
  delete: deleteUser(withArgs(() => null)),
});

actions.members.edit.execute({ args });
actions.loading(); // any member loading
actions.error(); // error of the latest member to settle
actions.latest(); // { key: 'edit', response } | null - the member executed last
actions.succeeded$; // Observable<{ key; response }> - for navigate/notify/refresh
```

This is plain signals over fixed members, with no `set()`, so it does not rebuild v2's swapping container.

## 3. Infinite scroll

### Usage

fut has 0 infinite-scroll triggers and 0 `createPagedQueryStack` uses. Other apps: bvb 5, fifagg 16.

The hub's only paging UI is "load more" inside selects, with page accumulation written by hand twice:
`hub/src/lib/shared/hub-lookup-state.ts:83-120` (used 3 times, `partner-bulk-edit-options-state.ts:40-42`) and the
SDK's own `libs/components/src/lib/forms/select/select-options-from-query.ts`. Neither uses the paged stack; that
is a separate follow-up.

### Recommendation

Yes, as a small directive, and not urgent for fut. The value is not the `IntersectionObserver` call. It is three
details that a template-plus-effect version gets wrong:

1. An observer only fires on change. When a page loads and the sentinel is still visible (a short page, a tall
   screen), nothing fetches again. The legacy `infinity-query-trigger.directive.ts` re-checked on every response;
   this one re-checks when `canFetchNextPage()` turns `true`.
2. It gates on `canFetchNextPage()`, which is already `false` while loading and on the last page.
3. The root must be the scroll container, not the viewport, inside an overlay or `et-scrollable`.

A button needs no directive: `(click)="stack.fetchNextPage()"` with `[disabled]="!stack.canFetchNextPage()"`. Build
on `signalElementIntersection` (`libs/core/src/lib/signals/element-intersection.ts`), which takes an `enabled`
signal and a `root` binding, as `ScrollObserverDirective` does. Place it in `libs/components` next to
`select-options-from-query`: query-aware UI glue.

### API sketch

```html
@for (item of posts.items(); track item.id) { … }
<div [etPagedQueryTrigger]="posts" [rootMargin]="'400px'" direction="next"></div>
```

- Inputs: `etPagedQueryTrigger` (an `AnyPagedQueryStack`), `direction: 'next' | 'previous'` (default `next`),
  `root` (element or selector; defaults to the nearest `et-scrollable`, else the viewport), `rootMargin`
  (default `'200px'`), `disabled`.
- Host bindings: `data-loading`, `data-exhausted` (last page loaded), `aria-hidden="true"`. The sentinel is not
  content.
- exportAs `etPagedQueryTrigger`, with `loading` and `exhausted` for a "you reached the end" line.

## 4. EntityStore

### Usage

- fut declares 1 store, `libs/queries/platform/src/lib/fut-api/item/item.queries.ts:19`, that nothing reads or
  writes: dead code. Other apps: bvb 13, dyn 18, fifagg 8 stores, cross-store writes in fifagg
  `broadcast.queries.ts:24-62`.
- The hub refetches instead: 27 hand-written `refresh()` calls re-run named queries with `allowCache: false`
  (`permission-menu.component.ts:210,229,252` → `partner-opportunity.provider.ts:55-59`). It makes 0
  `invalidateQueries` and 0 `subtle.setResponse` calls.

### Recommendation

Do not build a normalized entity store into v3. Both pitfalls come from write-through: a PATCH that returns
nothing or part of the object leaves the entity wrong or half-merged, and a side effect on another object (a
status) is not in the response at all. A store cannot know either without per-endpoint merge code, which is the
cumbersome part. Most duplication is between view types of the same row (`ItemOverviewView` vs the detail view),
so normalizing would merge shapes that do not match.

v3 already de-duplicates by cache key. The dynamic feel comes from other screens updating after a write. Offer
that by making the server the source of truth and making invalidation declarative:

1. **`invalidates` on a mutation creator** (new). It runs `invalidateQueries` for its targets after success, so
   the hub's 27 `refresh()` calls become one line on the creator. This handles both pitfalls: the other object
   is refetched, and nothing is merged.
2. **Tags** (new), for when the URL is not enough (`PATCH /people/1` changes `/opportunities/9`). A read
   declares tags from args/response; a write invalidates by tag. Tags are strings, so unlike `filter` they can
   cross the multi-tab `BroadcastChannel`.
3. **`withOptimisticUpdate`** (new, optional): a public, cache-wide form of `subtle.setResponse` for instant
   feedback. The updater gets the current response (and, after success, the mutation's, maybe `null` or partial)
   and returns the next value or `null` to skip, so merging is always explicit. It applies before the request,
   rolls back on failure, and the `invalidates` refetch corrects a wrong guess either way.

To document now: `invalidateQueries({ url })` after the write. Not `subtle.setResponse`, which is unsupported.

### API sketch

```ts
export const getOpportunity = getQuery<GetOpportunityArgs>((p) => `/opportunities/${p.uuid}`, {
  tags: ({ args }) => [`opportunity:${args.pathParams.uuid}`],
});

export const patchOpportunityPerson = patchQuery<PatchPersonArgs>(
  (p) => `/opportunities/${p.uuid}/people/${p.peopleUuid}`,
  {
    invalidates: ({ args }) => [{ tag: `opportunity:${args.pathParams.uuid}` }, { url: '/people' }],
  },
);

// optional, per call site: instant UI, then the invalidation above corrects it
patchOpportunityPerson(
  withOptimisticUpdate({
    target: ({ args }) => ({ tag: `opportunity:${args.pathParams.uuid}` }),
    update: ({ current, args }) => ({ ...current, people: toggle(current.people, args.pathParams.peopleUuid) }),
  }),
);
```

`invalidates` follows the existing rule that `invalidateQueries` only re-runs reads that are in use, and not
entries waiting out `keepUnusedFor`, so it cannot cause a request storm.

## Open questions for the user

1. Query button feedback: keep fut's 1 s success/failure flash (`feedback="flash"`) as an opt-in, make it the
   default, or drop it, as the hub does, in favor of notifications?
2. Should `etQueryButton` also accept a legacy query (through an adapter), so the 38 fut uses can move to
   `et-button` before their queries move to v3?
3. Collections: is the `computed` pattern plus docs enough, or do the dyn/fifagg numbers (~80) justify
   `createQueryGroup`?
4. Entity state: is declarative `invalidates` plus tags the right direction, and is `withOptimisticUpdate` worth
   building now or only on demand?
5. Should `hub-lookup-state` and `selectOptionsFromQuery` move onto `createPagedQueryStack` as part of this
   project, or stay separate?
6. Scope: ship this as one "query v3 UI helpers" project, or item by item (button first, since it has the most
   uses)?
