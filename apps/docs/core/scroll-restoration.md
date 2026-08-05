# Scroll restoration

App-wide navigation scroll management: scroll-to-top between routes, fragment scrolling, and
(opt-in) real scroll restoration on back/forward. Unlike the
[scrolling primitives](/core/scrolling), this is a stateful integration with the Angular router; you
set it up once and it runs for the app's lifetime.

Call `setupScrollRestoration()` once at app start, in an injection context (e.g. an
`APP_INITIALIZER`-style provider or the root component's constructor). It is a no-op on the server.

```ts
import { setupScrollRestoration } from '@ethlete/core';

setupScrollRestoration({
  // Pass a getter when the scroll container is the app shell or is created per route.
  scrollElement: () => document.querySelector<HTMLElement>('.app-shell'),
  queryParamTriggerList: ['page'],
  fragment: { enabled: true },
  restore: { enabled: true },
});
```

| Option                  | Default                    | Description                                                                           |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `scrollElement`         | `document.documentElement` | The scrolled element, or a getter resolved on every navigation.                       |
| `queryParamTriggerList` | `[]`                       | Query params that scroll to top when they change on the same route (e.g. `['page']`). |
| `fragment.enabled`      | `false`                    | Scroll to the element matching the URL fragment when the fragment changes.            |
| `fragment.smooth`       | `false`                    | Use `behavior: 'smooth'` for that scroll instead of jumping.                          |
| `restore`               | `{ enabled: false }`       | Restore the previous offset on back/forward instead of scrolling to top - see below.  |

## Opting a route out of scroll-to-top

By default every navigation to a different route scrolls the container to top. Opt out per route
through its `data`:

```ts
{
  path: 'details/:id',
  component: DetailsComponent,
  data: routerDisableScrollTop(),
}
```

| Option              | Default | Description                                                                   |
| ------------------- | ------- | ----------------------------------------------------------------------------- |
| `asReturnRoute`     | `false` | Only skip scroll-to-top when arriving here **from** an opted-out route.       |
| `onPathParamChange` | `false` | Also skip it when only a path param changed (e.g. `details/1` → `details/2`). |

`asReturnRoute` describes a **pair** of routes, and both halves have to be marked. A route with
`routerDisableScrollTop({ asReturnRoute: true })` keeps its offset only if the route being left was
marked with plain `routerDisableScrollTop()`. Marking just the return route is a silent no-op - the
navigation scrolls to top as usual.

## Restoring the offset on back/forward

Native browser restoration is wrong for data-driven pages: on back-navigation the queries re-execute
and the page renders skeletons or empty states first, so the document is far shorter than it was when
the user left - and the browser applies the saved offset against that short document.

With `restore.enabled`, the offset is captured per history entry and re-applied **only once the
content is tall enough to actually reach it**. Nothing has to opt in: the scroll container's own
height is the signal, so it works for lists, images, fonts and virtualized tables alike.

| `restore` option | Default | Description                                                                                   |
| ---------------- | ------- | --------------------------------------------------------------------------------------------- |
| `enabled`        | `false` | Turn restoration on. Also sets `history.scrollRestoration = 'manual'`.                        |
| `timeout`        | `1000`  | How long (ms) to wait for the content to grow tall enough. Suspended while a hold is pending. |
| `maxTimeout`     | `10000` | Absolute cap (ms) per attempt, regardless of holds.                                           |
| `clampOnTimeout` | `true`  | On timeout, apply the offset clamped to the reachable maximum instead of staying put.         |

`maxTimeout` is only ever an upper bound: the effective cap is `max(timeout, maxTimeout)`, so setting
it below `timeout` has no effect.

### Waiting for slow data

If a page's data can take longer than `timeout` to arrive, suspend the wait from the route component:

```ts
holdScrollRestoration(() => query.isLoading());
```

The registration lives for the lifetime of the injection context. Multiple holds are allowed -
restoration waits while any of them reads `true`, up to `maxTimeout`.

### Returning through a link instead of the back button

A "back to the overview" link is a forward navigation, so by default it lands at the top of the
overview - the offset the user left it at is still recorded, just not reached. Mark the link and it
restores that offset the same way the back button does:

```html
<a routerLink="/teams" etRestoreScroll>Teams</a>
```

```ts
// or, navigating programmatically
router.navigate(['/teams'], { state: routerRestoreScroll() });
```

The mark applies to that one navigation and is not written into the history entry it creates. The
offset used is the one from the **most recent** visit to that page in this session; a page the session
has no offset for - a first visit, or anything after a reload - scrolls to top as usual.

A link that names no query params matches whatever query state the page was last in, because a crumb
pointing at an overview does not know which filter or saved view the user left it under. State them
and the match becomes exact, so `/teams?season=2024` never restores the offset of
`/teams?season=2023`.

### What cancels a pending restoration

Restoration is abandoned if the user takes over scrolling before it commits. That is detected from
`wheel`, `touchmove` and `keydown` events - the interactions that cover mouse wheel, touch and
keyboard scrolling. Dragging the scrollbar itself is **not** among them, so a restoration may still
land while the user is dragging. Starting a new navigation also supersedes a pending restoration.

### Limits to know about

- **Offsets are held in memory only.** They are keyed by the router's per-navigation id and capped at
  200 entries; nothing is written to `sessionStorage`. Restoration therefore covers back/forward
  within a session, but not a full page reload or a restored tab - those scroll to top.
- Restoration applies to `popstate` navigations that have a stored offset, and to navigations marked
  with `etRestoreScroll` / `routerRestoreScroll()`. Any other link click scrolls to top.
- A stored offset wins over both `queryParamTriggerList` and fragment scrolling - the user may have
  scrolled away from the anchor before leaving.
- `routerDisableScrollTop({ asReturnRoute: true })` was a workaround for the absence of restoration.
  It still works, but with `restore.enabled` you generally don't need it.
