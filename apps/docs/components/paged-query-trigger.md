# Paged query trigger

`etPagedQueryTrigger` turns a [paged query stack](/query/stacks#paged-queries) into an infinite list: put it
after the last item, and it fetches the next page when it scrolls into view. It works in a horizontal
[scrollable](/components/scrollable) rail, a vertical list and the page itself.

Import `PagedQueryTriggerDirective` from `@ethlete/components`.

```ts
protected matches = createPagedQueryStack({
  queryCreator: getMatches,
  responseNormalizer: ethletePaginationAdapter,
  args: (page) => ({ queryParams: { page, limit: 6 } }),
});
```

```html
<et-scrollable>
  @for (match of matches.items(); track match.id) {
  <app-match-card [match]="match" />
  }
  <div [etPagedQueryTrigger]="matches" [rootMargin]="'400px'"></div>
</et-scrollable>
```

## Live demo

<StoryEmbed id="components-data-display-paged-query-trigger--default" height="620px" />

## Inputs

| Input                 | Default                                            | Description                                                                                           |
| --------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `etPagedQueryTrigger` | - (required)                                       | The `AnyPagedQueryStack` to page. `null` turns the trigger off.                                       |
| `direction`           | `'next'`                                           | `'next'` calls `fetchNextPage()`; `'previous'` calls `fetchPreviousPage()`, for a trigger at the top. |
| `root`                | the nearest `et-scrollable`'s track, else viewport | The element whose bounds count as "in view" - an `HTMLElement` or an `ElementRef`.                    |
| `rootMargin`          | `'200px'`                                          | How far outside `root` the trigger already counts as in view. The `IntersectionObserver` syntax.      |
| `disabled`            | `false`                                            | Stops fetching. Enabling it again while the trigger is in view fetches at once.                       |

The directive is exported as `etPagedQueryTrigger`, with `loading()` and `exhausted()` signals for a status
line. The host carries the same state as `data-loading` and `data-exhausted`.

```html
<div #trigger="etPagedQueryTrigger" [etPagedQueryTrigger]="matches"></div>
@if (trigger.loading()) {
<et-spinner />
}
```

## When it fetches

It fetches only while `canFetchNextPage()` (or `canFetchPreviousPage()`) is `true`, which is `false` while any
page loads and once the last page is in. Leave the trigger in the template - there is no need to wrap it in
`@if (canLoadMore && !loading)`.

An `IntersectionObserver` only reports changes, so a sentinel that is still in view after a page loaded would
never fire again. The trigger observes again each time the stack can fetch, and the browser answers with a fresh
measurement taken after the new items rendered. So a short page fills the rail until the trigger is past
`rootMargin`, and stops there.

## Inside a scrollable

Inside an `et-scrollable` the trigger measures against the scrollable's track, not the viewport. That is what
makes `rootMargin` work in a horizontal rail: with the viewport as root, the margin extends the viewport, but
the track still clips the trigger, so it would only fetch once the rail end is actually visible. The trigger
also marks itself `etScrollableIgnoreChild`, so it is no item for the scrollable's buttons, dots or snap.

## Switching stacks

The stack is a signal input, so one rail can page through two lists in turn:

```html
<div [etPagedQueryTrigger]="upcoming.isLastPageLoaded() ? completed : upcoming"></div>
```

Switch on `isLastPageLoaded()`, not `canFetchNextPage()` - the latter is also `false` while a page loads. When
the bound stack changes while the trigger is in view, it fetches from the new one at once.

## Polling

A stack created with `features: [withPolling({ interval })]` polls every loaded page on its own timer, so a
list with five pages sends five requests per interval. Each refresh turns `loading()` on and
`canFetchNextPage()` off for its duration; the trigger waits for it and fetches afterwards if it is in view.

## A button instead

There is no button mode. A "load more" button is `(click)="matches.fetchNextPage()"` with
[`[etQueryButton]="matches"`](/components/button#query-button) for its loading state, and
`[disabled]="!matches.canFetchNextPage()"`.

## Accessibility

The trigger is `aria-hidden="true"` and takes no focus - it is a scroll position, not a control. Content that
only loads on scroll is hard to reach for a keyboard or switch user who never scrolls the container; for a
long list that matters, offer a "load more" button too.

## Coming from `@ethlete/cdk`

`etInfinityQueryTrigger` with `createInfinityQueryConfig` maps to `createPagedQueryStack` plus this directive.
See [migrating from v2](/query/migrating-from-v2#infinity-queries).
