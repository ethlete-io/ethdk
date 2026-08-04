# Query devtools

An in-app inspector for the signals-first [`@ethlete/query`](/query/) system:
queries, [stacks & paged stacks](/query/stacks), [dependent-query sequences](/query/dependent-queries),
[GraphQL queries](/query/gql) (shown in the Queries tab with their document), [bearer auth providers](/query/auth),
[web socket clients](/query/ws), the repository cache and a rolling event log. It
renders as a floating, dockable panel - a development aid, not something you ship
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
nothing. Instrumentation is a no-op until you call it - it retains no references
and adds no runtime overhead - so leaving `<et-query-devtools>` mounted while
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

| Tab           | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Queries**   | Every registered query, [filterable by client, endpoint and live state](#finding-a-query-in-a-long-list). Method badge, [resolved route](#routes-show-the-params-that-were-used), live status and a stale marker; the [detail view](#the-detail-view-overview-history-data) shows args, response/error, cache key (`id()`), last-executed time, `triggeredBy`, [the features it was created with](#features-show-what-they-were-configured-with), [how often it ran and what it transferred](#activity-how-often-a-query-ran-and-what-it-cost) and [every run it made](#run-history-and-response-diffs), with `execute()` / `execute({ options: { allowCache: true } })` / `reset()` actions. |
| **Stacks**    | Query stacks and paged query stacks: combined loading/error, and for paged stacks the pages loaded, item count and direction, plus [the traffic every page caused](#activity-how-often-a-query-ran-and-what-it-cost). Inner queries are listed as rows and open in a split-view drawer (the stack context is kept).                                                                                                                                                                                                                                                                                                                                                                           |
| **Sequences** | Each `querySequence` as a selectable step chain - click a step to open its query in a split-view drawer (like Stacks); expand a step to see its input args and output response/error inline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Auth**      | Each bearer auth provider: authenticated state, access/refresh token presence, the decoded access-token JWT payload, current `executionState`, the latest auth query snapshot and [its features with their configuration](#features-show-what-they-were-configured-with).                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Sockets**   | Each `createWebSocketClient`: connection state, joined rooms and a rolling log of received messages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Cache**     | Per-client repository entries: cache key, consumer count, secure flag, a live freshness countdown, the [multi-tab sync](/query/multi-tab#debugging-it) state (`polling` / `standby`, and when the entry last took a response from another tab), whether the entry took its data from the [persisted store](/query/persistence#debugging-it) and per-entry **Refetch** / **Evict** actions. The card header also shows how many responses the client has on disk, with a **Clear disk** button, and [the client's own features with their configuration](#features-show-what-they-were-configured-with).                                                                                       |
| **Timeline**  | [Every request as a bar on one shared axis](#timeline-what-overlapped-with-what) - what fires on mount, whether a chain is an N+1, whether a poll is stampeding. Clicking a bar opens its query.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Events**    | A rolling log (last 100) of repository `request-success` / `request-error` events with timestamps. Clicking a row's request opens the query it belonged to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Faults**    | [Latency and failures you can arm per client](#faults-making-requests-actually-misbehave), injected into the request pipeline so retries, error handling and the cache see them as real.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Finding a query in a long list

A real app registers a lot of queries, so the Queries tab narrows on three axes
that stack:

- **The client picker** scopes the list to one query client (or, after using
  **Inspect**, to exactly the queries the picked element created).
- **The filter box** matches a query's method, [resolved route](#routes-show-the-params-that-were-used)
  and the path of the request it made. Terms are whitespace-separated and **all** have
  to match, so `get post` finds `GET /post/12` without the `POST` mutations that
  `post` alone also matches. The origin and the client name are deliberately not
  matched - they repeat across nearly every entry, so a one-letter term would hit
  everything through the host name. Scoping to a client is the picker's job.
- **The status chips** - **Failing**, **Loading**, **Stale**, **Idle** (never
  executed) - each carry the number of queries they would leave. Picking several
  _widens_ the result (failing **or** stale), the way a network panel's type chips
  do, and a chip with no matches is disabled. The counts are computed before the
  chips are applied, so a chip always states what picking it yields.

  A query whose request is in flight counts as **Loading** and not as **Stale**:
  it is already refreshing, so the freshness of what it is replacing is not the
  useful fact about it. That is the same precedence the Cache tab's freshness
  column uses when it reads `refreshing…`.

The count next to the picker reads `12 of 87` while anything is narrowing the
list, and **Clear filters** drops the term and the chips while keeping the client
scope. The [Insomnia download](#export-to-insomnia) exports whatever is listed, so
these filters pick what ends up in the collection.

### Tabs say what they hold

Each tab carries the number of entries behind it, and a second red badge with how
many of them are failing - queries in an error state, stacks with an error, failed
sequence steps, `request-error` rows in the event log. A query that fails in a tab
you are not looking at is visible from the tab strip, which is what turns the
panel from something you check into something that tells you.

## Routes show the params that were used

A route built from a function:

```ts
const getPost = getQuery<GetPostArgs>((p) => `/post/${p.postId}`);
```

is listed with its path params **filled in from the args the query used**, each one
picked out in the accent colour, with the query string dimmed behind the path:

```
GET /post/12
GET /posts?page=2&limit=5
```

So several rows hitting the same endpoint stay tellable apart. Hovering a
highlighted segment names the param it fills in (`postId`). A query that has no
args yet shows `:postId` instead - and the param names are real: they are recorded
from the route function itself, not a generic `:param` placeholder.

The selected query's meta table keeps both forms: **Route** is the template
(`/post/:postId`, what you grep the codebase for) and **Request URL** is the full
URL of the request it last made, query string included.

Args follow the same rule. A query that receives its args through
[`withArgs`](/query/features#withargs) holds them on `args()`, but one executed imperatively
(`execute({ args })`, a [sequence](/query/dependent-queries) step, an auth query)
does not - for those the args of its current request are shown, so the panel no
longer reads `null` for a query that plainly sent something.

## Features show what they were configured with

Every feature is listed by name **and by the options it was created with**, so a
polling interval or a cookie name is readable without going back to the source:

```
polling             interval 10s   execute initially no
error handling      handler reportPostError
```

Defaults are resolved rather than left blank - an omitted
`withPolling({ executeInitially })` reads `no`, and a
[`withQueryPersistence()`](/query/persistence) with no config spells out the
`version 1` / `max age 24h` / `max entries 50` it actually runs with. The lists
appear wherever features do: the selected query's meta table, stack cards, the auth
provider cards and the Cache tab's per-client header (for client features like
[multi-tab sync](/query/multi-tab) and [persistence](/query/persistence)).
**Copy report** includes the same line, so a shared report says the query polls.

Handlers are named where naming them costs nothing: a feature that takes a
function shows it only when it was passed as a declared function
(`withErrorHandling({ handler: reportPostError })`). An inline lambda has no name
worth printing and is left out.

A custom feature can describe itself the same way - `devtools` is only ever called
while the panel is building an entry, so it costs nothing when
`provideQueryDevtools()` is absent:

```ts
const withRetryBanner = <TArgs extends QueryArgs>(options: { after: number }) =>
  createQueryFeature<TArgs>({
    type: 'WITH_RETRY_BANNER',
    devtools: () => [{ label: 'after', value: `${options.after} attempts` }],
    fn: (context) => {
      /* … */
    },
  });
```

## Activity: how often a query ran and what it cost

Every query keeps a running count of what it has done since it was created, shown as
the **Activity** tiles in its detail view:

| Tile              | Reads                                                                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Refreshes**     | Every `execute()` - manual, [polling](/query/features#withpolling), args change, `refreshQueriesInUse()`. The sub-line says how many of those were answered **without a request** (a fresh cache entry, or an identical request already in flight). |
| **Requests**      | The executions that did start a request, and how they ended (`N ok`, `N failed`).                                                                                                                                                                   |
| **Received**      | The total response payload, plus the average per response.                                                                                                                                                                                          |
| **Sent**          | The total request body sent. Only shown for a query that sends one.                                                                                                                                                                                 |
| **Retries**       | Attempts the [retry policy](/query/errors#retries) added on top of the first one. Only shown once something has been retried; which run they belong to is under **History**.                                                                        |
| **Duration**      | The last response's wall-clock time (from the execution that triggered it, so retries and queueing count), plus the average.                                                                                                                        |
| **Last response** | When the last response arrived, and when the query first ran.                                                                                                                                                                                       |

The query list itself stays free of figures - it is for finding a query, not for
reading its numbers. Stack, paged-stack and sequence cards do get a **Traffic** row
that adds up the queries they own, which is the quickest way to see what a paged
stack cost over its pages, and each inner-query row shows its own size.
**Copy report** includes the same summary on one line.

**Reset** clears an entry's counters, so a single interaction can be measured on its
own: reset, click through the flow, read the numbers.

Sizes prefixed with `≈` were measured by serializing the decoded body, because the
response carried no `content-length` header - the real transfer was probably smaller,
since it ignores compression. Sizes without the marker come from the header.

::: tip
Counting happens per query, so two queries sharing one in-flight request each count
the response they received. That makes each row honest about what it got, but means
the totals can exceed what the network tab reports for a shared request.
:::

## The detail view: Overview, History, Data

A query's detail holds more than fits one column, so it is split into three
sub-tabs under the pinned head and action rows:

| Sub-tab      | Holds                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview** | Base URL, route, request URL, status, cache key, last-executed time, `triggeredBy`, features, and the [Activity tiles](#activity-how-often-a-query-ran-and-what-it-cost). |
| **History**  | [Every run the query made, and the response diff](#run-history-and-response-diffs). Carries the run count as a badge.                                                     |
| **Data**     | The [value explorer](#beyond-a-read-only-view) (args, response or error) and the GraphQL document, if any.                                                                |

The **Run** / **Edit** / **Force** actions stay above the sub-tabs, so nothing you
act on is ever behind a tab. A failing query marks the **Data** sub-tab with a red
badge, because that is where the error body lives - a failure never hides behind a
tab that isn't open. Which sub-tab is open is [persisted](#persistence) and shared
by the Queries tab and the Stacks / Sequences drawers.

## Retries and progress: what a loading query is actually doing

A query that has been `loading` for eight seconds because it is on its third attempt
behind a four-second backoff looks exactly like a slow request: one yellow dot. The
detail head fills that in, right above the action rows, whenever there is something to
say - and stays out of the way when there isn't.

**While a retry is being waited out** it reads
`⟳ attempt 3 in 2s · after 503 · backing off 3.00s`: which attempt the delay leads up
to, how long is left on it, the status that caused it (`after a connection failure`
when the request never reached the server) and the backoff the
[policy](/query/errors#retries) asked for. Nothing is in flight during
that window, which is the thing a loading dot actively misrepresents - so the Queries
list marks the row with a `⟳ 3` chip too, and you can spot it without opening
anything.

**Once the request settles**, the head keeps stating `⟳ 4 attempts` for as long as
that execution is the current one - so a request that only succeeded on its fourth try
does not read as a clean one. The next execution starts over at one.

**A request that reports transfer progress** gets a bar plus
`38% · 120.0 kB of 320.0 kB · 2.40s left`. Angular only emits progress events for a
request that asked for them, so this needs `reportProgress: true` on the query
creator:

```ts
export const getExport = getQuery<GetExportArgs>('/export', { reportProgress: true });
```

Without it there is no progress to show, and the readout stays absent. The remaining
time only appears once the transfer has run long enough to be estimated.

Attempt counts are recorded per run, so they also show up where runs are listed: a
`⟳ N` marker in the **History** table and on the **Timeline** bar. That is what says a
7-second bar is mostly retry backoff rather than one slow round trip.

::: tip
The retry count comes off the request, which is shared by every query hitting the same
cache key - so two queries joined onto one retried request both report its attempts.
:::

## Faults: making requests actually misbehave

Reading a retry is one half; causing one is the other. [Force states](#beyond-a-read-only-view)
write a query's signals directly, which exercises the template but bypasses the pipeline -
no retry fires, no error handling feature runs, the cache never sees a failure. The
**Faults** tab arms the request itself instead, so everything downstream reacts the way it
would to a real fault.

Faults are armed **per query client** and every control is independent:

| Control       | What it does                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Latency**   | Waits N ms before every attempt starts, so the query genuinely stays `loading` that long. This is what a missing skeleton shows up under.      |
| **Fail next** | Fails the next N attempts, counting down as they are spent - `2` fails two attempts and lets the third through, like a server recovering.      |
| **Fail rate** | Fails a percentage of attempts, rolled per attempt. `100` fails everything; anything between soak-tests a screen against intermittent failure. |
| **Status**    | The status an injected failure responds with, and whether the [default retry policy](/query/errors#retries) retries it.                        |

The status matters more than it looks. The default policy retries `0`, `408`, `425`, `429`
and `≥ 501` - but **not** `500`, which is treated as unrecoverable. Arm a `500` and you are
testing the error path; arm a `503` and you are testing the retry path. The picker says
which of the two you picked.

A faulted attempt never reaches the network, so this works offline and against a
production API you would rather not hammer. Latency and failure compose: 600 ms of
latency plus `fail next 2` reproduces a slow, flaky endpoint without touching the server.

Because the fault is resolved per **attempt** rather than per execution, a retry re-rolls
it - which is what makes `fail next 2` behave like a server that comes back. Watching the
`⟳ N` markers from [Retries](#retries-and-progress-what-a-loading-query-is-actually-doing)
climb is the read-out that the injection is real and not a frozen state.

::: warning
An armed client is drawn with a red border and the **Faults** tab carries a red badge, because
every misbehaving request in the app is coming from it. Nothing survives a page reload - a
persisted "fail everything" that outlived the session that armed it would be a trap. Use
**Disarm** on one client or **Disarm all** to clear it sooner.
:::

Faults are keyed by client **name**, the same identity the client picker uses - so two clients
sharing a name are armed together.

## Timeline: what overlapped with what

The Activity tiles say a query ran 40 times. They cannot say it ran 40 times in two
seconds. The **Timeline** tab draws every request as a bar on one shared axis, so
concurrency is visible as concurrency:

- **A mount stampede** - a screen's worth of bars all starting at 0.
- **An N+1 chain** - a staircase, each bar starting where the previous one ended.
- **A polling stampede** - the same endpoint restarting before the last one landed.

The client picker and the **Inspect** filter scope the timeline exactly as they scope
the Queries list, and every row is labelled with the URL **that run** went to - not
the URL the query holds now - so a query whose args changed between runs stays
readable. Clicking a bar opens that query in the Queries tab.

Bars are coloured by outcome: green for a response, red for a failure, yellow while
in flight (the bar grows with the clock), and a dashed grey outline for an **aborted**
run - one whose query started another request before the response arrived, so the
response it was waiting for can no longer reach it. Three markers are worth knowing:

- A **`⟳ N`** run took N attempts, so most of its bar is
  [retry backoff](#retries-and-progress-what-a-loading-query-is-actually-doing) rather
  than one slow round trip.

- A **`shared`** run is an instant, because the query received a response without
  making a request of its own: a [poll](/query/features#withpolling), another consumer
  of the same cache entry, or [another tab](/query/multi-tab). Only the arrival time
  is knowable, so there is no duration to draw.
- An execution answered from a **fresh cache entry** produces no bar at all. The
  timeline is about requests; cache hits are counted by the Activity tiles' _without
  a request_ sub-line instead.

The axis is labelled with offsets from the first run, and the toolbar states the
window (`13 runs · over 3.98s from 13:37:03`). **Reset** clears the run history and
the counters of every listed query, which is how you scope a measurement to one
interaction. Each query keeps its **last 25 runs**; when the tab shows more rows
than it draws, the toolbar says how many older runs it left out.

## Run history and response diffs

The **History** sub-tab of a query's detail lists its runs newest first - run number,
start time, duration, received size and outcome. It answers "did this actually
re-request, or was that a cache hit?" without reading a rolling event log. A run that
took more than one attempt carries a
[`⟳ N` marker](#retries-and-progress-what-a-loading-query-is-actually-doing), because
its duration covers every attempt and the backoff between them.

The newest **5** runs also keep their response body, which is what makes the
**Diff** button work: it compares a run's response against the newest older run that
still holds one (not necessarily the run right before it - a failed run has no body to
compare). The diff is a flat list of paths, which is the shape that answers the two
questions worth asking:

- _The list re-rendered - what changed?_
- _Did that poll return anything new?_ → **identical**, in as many words.

Each row reads `path`, `before`, `after`, coloured by kind: green for an added path,
red for a removed one, accent for a changed value. Arrays of records are matched by a
unique `id` rather than by index (`$.items[id=7].score`), so a list that gained or lost
an item reports that one item instead of every index after it shifting. Anything else
is compared by index (`$.items[2]`). Very large diffs are capped at 200 paths and say
so.

::: tip
Bodies are only retained while the devtools are installed, and only for the newest few
runs of each query - a polling query would otherwise hold on to every response it ever
received. `provideQueryDevtools()` is what allocates any of it; an app without it pays
nothing.
:::

## Export to Insomnia

Two buttons hand a request to [Insomnia](https://insomnia.rest) so it can be
replayed, tweaked and shared outside the app:

- **Insomnia** in the selected query's action row copies a one-request collection
  to the clipboard - import it with `Import > From Clipboard`.
- **⤓ Insomnia** in the Queries toolbar downloads everything currently listed
  ([every filter applies](#finding-a-query-in-a-long-list)) as one collection, with
  a folder per query client.

Both export what the query actually sent: the resolved URL, the JSON body, and the
headers as the request resolved them - the query client's headers with the
per-request ones merged on top. A GraphQL query is exported as an Insomnia GraphQL
request holding its document and variables.

Queries that have not run yet still export, from their current args and the route
template - Insomnia reads a leftover `:postId` as one of its own path params.

### Secure queries get a self-refreshing token

A [secure query](/query/auth) is not exported with the access token the app happened
to hold - that token is stale within the hour, and the collection with it. Instead
the export carries the auth provider's **token refresh** as a request of its own,
and every secure request reads its bearer token out of that request's response:

```
Authorization: Bearer {% response 'body', 'req_refresh_0', '$.accessToken', 'when-expired', 3600 %}
```

That is Insomnia's own response-chaining tag, and `when-expired` is what makes it
self-maintaining: once the stored refresh response is older than the max age,
sending any secure request re-sends the refresh first, then uses the fresh token.
The max age comes from the access token's own lifetime (90% of it, capped at an
hour), so the collection refreshes about as often as the app does.

The JSON path is found by locating the live access token in the last auth response,
so a provider with a custom `extractTokens` (`$.data.token`, …) chains correctly
too. Multiple auth providers each get their own refresh request, and a request is
chained to the one it authenticates with.

What the export still holds literally is the **refresh token** in that request's
body - the one the app had at export time. It is what makes the chain start, so the
file is as sensitive as that token, and an API that rotates refresh tokens will
eventually invalidate it: re-export when the refresh starts failing. A provider that
is not logged in exports no refresh request at all.

## Beyond a read-only view

The panel doesn't just display state - it acts on the live query objects your
components are bound to, which the browser Network tab can't do:

- **Value explorer** - a collapsible, searchable tree of the _transformed_ value
  (args / response / error, post-`transformResponse`). Every row copies to the
  clipboard, including arrays and objects: a container copies its whole subtree as
  formatted JSON, a leaf copies the bare value (a string without the display
  quotes, so an id or url pastes straight into a search box). The button ticks
  green to confirm. A container with more than 100 entries is folded into
  collapsed slices of 100 (`0 … 99`, `100 … 199`, …) instead of being rendered in
  full, so a 5000-item list opens instantly; each slice expands on click and
  copies just the entries it covers. While the filter is active, only slices that
  actually contain a match unfold.
- **JIT editing** - edit a query's response and apply it via `setResponse()` (the
  UI re-renders instantly - great for optimistic / edge-case testing), or replay
  the query with edited args.
- **Force states** - force a query into loading / error / empty to exercise
  skeletons, spinners and error / empty UIs on demand (`Clear` restores it). This
  writes the query's signals directly; to exercise the pipeline behind them -
  retries, error handling features, the cache - arm a
  [fault](#faults-making-requests-actually-misbehave) instead.
- **Cache actions** - refetch or evict individual cache entries and watch the
  freshness countdown.
- **Inspect** - toggle inspect mode, then hover the live UI to highlight the query
  a component created; click to jump straight to its detail. The Queries list then
  shows an **Inspected element** banner with the number of matches, and **Clear**
  restores the full list. While the mode is armed the button stays lit and pulsing
  (the pointer is out in the app, not on the panel) and shows the **Esc** key that
  cancels it.
- **Copy the GraphQL document** - a GraphQL query's detail renders its document
  dedented, with a **⧉ Copy** button next to the heading, so it pastes straight
  into a GraphQL playground.

## Persistence

The view state - open/closed, panel height, active tab, the query detail's
[sub-tab](#the-detail-view-overview-history-data), selected client, selected
query, inspect filter, the query filter term and status chips, value-explorer
search and expanded tree paths - is
persisted to `sessionStorage` under `ethlete:query:devtools:v4`, so it survives a
page reload within the tab session without leaking devtools state across sessions.
(Restoring the selected query relies on registry ids being stable across reloads,
which in turn assumes queries are created in the same order.)

[Armed faults](#faults-making-requests-actually-misbehave) are deliberately **not**
part of that: they change how the app behaves, not how the panel looks, and a reload
disarms them.

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
