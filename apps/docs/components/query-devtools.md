# Query devtools

An in-app inspector for the signals-first [`@ethlete/query`](/query/) system:
queries, [stacks & paged stacks](/query/stacks), [dependent-query sequences](/query/dependent-queries),
[GraphQL queries](/query/gql) (shown in the Queries tab with their document), [bearer auth providers](/query/auth),
[web socket clients](/query/ws), the repository cache and a rolling event log. It
renders as a floating, dockable panel — a development aid, not something you ship
enabled to end users.

Import `QUERY_DEVTOOLS_IMPORTS` for the component and enable instrumentation with
`provideQueryDevtools()` from `@ethlete/query`.

## Setup

Two steps: turn instrumentation on at bootstrap, and drop the panel into your app
shell.

```ts
// main.ts
import { provideQueryDevtools } from '@ethlete/query';

bootstrapApplication(AppComponent, {
  providers: [provideQueryDevtools()],
});
```

```ts
// app.component.ts
import { QUERY_DEVTOOLS_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-root',
  imports: [QUERY_DEVTOOLS_IMPORTS],
  template: `
    <!-- your app -->
    <et-query-devtools />
  `,
})
export class AppComponent {}
```

Without `provideQueryDevtools()` the registry stays empty and the panel shows
nothing. Instrumentation is a no-op until you call it — it retains no references
and adds no runtime overhead — so leaving `<et-query-devtools>` mounted while
omitting the provider in production builds is safe.

## Live demo

<StoryEmbed id="components-query-devtools--default" height="520px" />

Open the panel with the floating **Query** button (bottom-right) or the
<kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Alt</kbd> + <kbd>Q</kbd> shortcut, then use
the demo controls to drive real fixtures through every tab. Drag the panel's top
edge to resize it. (The floating button is rendered in its own Shadow DOM so
host-app CSS can't affect it.)

Both the floating button and the panel's **Close** button print the shortcut for
the current platform (`⌘⌥Q` on Apple, `Ctrl+Alt+Q` elsewhere), so it's
discoverable without reading this page. The shortcut is matched on the physical
key, which keeps it working on layouts where holding <kbd>Alt</kbd> rewrites the
character the keyboard reports.

## Tabs

| Tab           | Shows                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Queries**   | Every registered query, filterable by client. Method badge, route (path params rendered as `:param`), live status, feature chips and a stale marker; the detail view shows args, response/error, cache key (`id()`), last-executed time and `triggeredBy`, with `execute()` / `execute({ options: { allowCache: true } })` / `reset()` actions. |
| **Stacks**    | Query stacks and paged query stacks: combined loading/error, and for paged stacks the pages loaded, item count and direction. Inner queries are listed as rows and open in a split-view drawer (the stack context is kept).                                                                                                                     |
| **Sequences** | Each `querySequence` as a selectable step chain — click a step to open its query in a split-view drawer (like Stacks); expand a step to see its input args and output response/error inline.                                                                                                                                                    |
| **Auth**      | Each bearer auth provider: authenticated state, access/refresh token presence, the decoded access-token JWT payload, current `executionState` and the latest auth query snapshot.                                                                                                                                                               |
| **Sockets**   | Each `createWebSocketClient`: connection state, joined rooms and a rolling log of received messages.                                                                                                                                                                                                                                            |
| **Cache**     | Per-client repository entries: cache key, consumer count, secure flag, a live freshness countdown and per-entry **Refetch** / **Evict** actions.                                                                                                                                                                                                |
| **Events**    | A rolling log (last 100) of repository `request-success` / `request-error` events with timestamps.                                                                                                                                                                                                                                              |

## Beyond a read-only view

The panel doesn't just display state — it acts on the live query objects your
components are bound to, which the browser Network tab can't do:

- **Value explorer** — a collapsible, searchable tree of the _transformed_ value
  (args / response / error, post-`transformResponse`). Every row copies to the
  clipboard, including arrays and objects: a container copies its whole subtree as
  formatted JSON, a leaf copies the bare value (a string without the display
  quotes, so an id or url pastes straight into a search box). The button ticks
  green to confirm.
- **JIT editing** — edit a query's response and apply it via `setResponse()` (the
  UI re-renders instantly — great for optimistic / edge-case testing), or replay
  the query with edited args.
- **Force states** — force a query into loading / error / empty to exercise
  skeletons, spinners and error / empty UIs on demand (`Clear` restores it).
- **Cache actions** — refetch or evict individual cache entries and watch the
  freshness countdown.
- **Inspect** — toggle inspect mode, then hover the live UI to highlight the query
  a component created; click to jump straight to its detail. The Queries list then
  shows an **Inspected element** banner with the number of matches, and **Clear**
  restores the full list.

## Persistence

The view state — open/closed, panel height, active tab, selected client, selected
query, inspect filter, value-explorer search and expanded tree paths — is
persisted to `sessionStorage` under `ethlete:query:devtools:v4`, so it survives a
page reload within the tab session without leaking devtools state across sessions.
(Restoring the selected query relies on registry ids being stable across reloads,
which in turn assumes queries are created in the same order.)

## Accessibility

The devtools panel is a development tool, not part of your product UI. The tab
strip uses `role="tablist"` / `role="tab"` with `aria-selected`; controls are
native `<button>` and `<select>` elements. It is not intended to ship in
production builds.

## Theming

The panel styles its own chrome from the [surface & color theming](/core/theming)
tokens (`--et-surface-*-solid`, `--et-theme-color-primary-solid`) so it adapts to
the host app's current surface, and falls back to a self-contained dark palette
when no themes are registered. Override the panel's internal `--_et-qdt-*` custom
properties on `.et-query-devtools-host` if you need to retune it. Its CSS lives in
the `components` cascade layer like every other component, so utility classes can
override it without `!important`.
