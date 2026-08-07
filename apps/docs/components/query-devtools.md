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
the demo controls to drive real fixtures through every tab. Drag the panel's edge
to resize it, or [dock it to the right / pop it out](#where-the-panel-sits).
(The floating button is rendered in its own Shadow DOM so host-app CSS can't
affect it.)

Both the floating button and the panel's **Close** button print the shortcut for
the current platform (`⌘⌥Q` on Apple, `Ctrl+Alt+Q` elsewhere), so it's
discoverable without reading this page. The shortcut is matched on the physical
key, which keeps it working on layouts where holding <kbd>Alt</kbd> rewrites the
character the keyboard reports.

## Where the panel sits

A bottom dock is right for a waterfall and wrong for a wide screen, and on two
monitors neither is right. The header carries both alternatives:

- **◨ Right** docks the panel to the right edge, sized by dragging its inner edge
  instead of its top one. At that width the master/detail and split views stack
  vertically rather than sitting side by side, so neither pane is squeezed below
  what it needs. **⬓ Bottom** puts it back.
- **⧉ Pop out** moves the panel into a window of its own - the _same_ live panel,
  not a second one, so every signal in it keeps updating from the app you are
  inspecting, and **Inspect** still highlights components in the app window.
  **⧈ Dock back** (or closing the window) brings it home.

Inside the panel, **the divider between two panes is draggable** on every tab that
has two: the Queries list against its detail, and the split views (Stacks,
Sequences, Forms, Timeline) against the drawer a query opens in. Grab the gap
between them and drag; double-click it to hand the pane back to its default
proportion. A right dock stacks the panes, so there the same divider turns
horizontal and sizes them along the other axis - each axis keeps its own size, so
switching docks never carries a width over as a height.

Below `md` (768px) the panel stacks whichever edge it is docked to. Side by side,
the list alone asks for `22rem` and the drawer for `26rem`, which is wider than a
phone - so on a narrow viewport the panes go one above the other, and the tab
strip and the action row each scroll sideways instead of wrapping into a header
taller than the content it labels. Both dividers are draggable by touch.

Which edge you picked, the size of each and the pane sizes are
[persisted](#persistence). Being popped out is not: a reload cannot re-adopt the window the previous document
opened, so the panel always comes back docked.

::: tip
A pop-out is the app's own panel relocated, which is what makes it live - but it
also means it borrows the app's stylesheets and the surface theme the panel was
docked in, and it cannot outlive the tab that opened it. Reloading the app closes
it. Pop-up blockers apply: if the window is refused, the panel stays docked.
:::

## Tabs

| Tab           | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Queries**   | Every registered query, [filterable by client, endpoint and live state](#finding-a-query-in-a-long-list). Method badge, [resolved route](#routes-show-the-params-that-were-used), live status and a stale marker; the [detail view](#the-detail-view-overview-history-data) shows args, response/error, cache key (`id()`), last-executed time, `triggeredBy`, [the features it was created with](#features-show-what-they-were-configured-with), [how often it ran and what it transferred](#activity-how-often-a-query-ran-and-what-it-cost) and [every run it made](#run-history-and-response-diffs), with `execute()` / `execute({ options: { allowCache: true } })` / `reset()` actions.         |
| **Stacks**    | Query stacks and paged query stacks: combined loading/error, and for paged stacks the pages loaded, item count and direction, plus [the traffic every page caused](#activity-how-often-a-query-ran-and-what-it-cost). Inner queries are listed as rows and open in a split-view drawer (the stack context is kept).                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sequences** | Each `querySequence` as a selectable step chain - click a step to open its query in a split-view drawer (like Stacks); expand a step to see its input args and output response/error inline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Forms**     | Every [`defineQueryForm`](/query/query-forms) on screen: [its fields, what they put in the URL and the query it drives](#forms-what-a-filter-is-actually-sending). A driven query opens in a split-view drawer (like Stacks), so the form stays on screen next to it.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Auth**      | Each bearer auth provider: authenticated state, access/refresh token presence, the decoded access-token JWT payload, current `executionState`, the latest auth query snapshot and [its features with their configuration](#features-show-what-they-were-configured-with).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Sockets**   | Each `createWebSocketClient`: connection state, joined rooms and a rolling log of [everything sent and received](#sockets-both-directions-and-an-emit-box), with a filter box and an emit box for test messages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Cache**     | Per-client repository entries: cache key, consumer count, [measured size](#cache-what-is-actually-in-it), secure flag, a live freshness countdown, the [multi-tab sync](/query/multi-tab#debugging-it) state (`polling` / `standby`, and when the entry last took a response from another tab), whether the entry took its data from the [persisted store](/query/persistence#debugging-it) and per-entry **Value** / **Refetch** / **Evict** actions. The card header adds the cache's total size, how many entries are collectible, how many responses the client has on disk (with **Clear disk**), **Evict all**, and [the client's own features](#features-show-what-they-were-configured-with). |
| **Timeline**  | [Every request as a bar on one shared axis](#timeline-what-overlapped-with-what) - what fires on mount, whether a chain is an N+1, whether a poll is stampeding. Clicking a bar opens its query in a split-view drawer (like Stacks), so the waterfall stays on screen next to it.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Events**    | A rolling log (last 100) of repository `request-success` / `request-error` events with [timestamps, duration and response size](#events-what-each-request-cost), narrowable by client and to failures only, plus one row per [invalidation and its fan-out](#why-did-this-refetch). Clicking a row's request opens the query it belonged to.                                                                                                                                                                                                                                                                                                                                                          |
| **Faults**    | [Latency and failures you can arm per client](#faults-making-requests-actually-misbehave), injected into the request pipeline so retries, error handling and the cache see them as real.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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
  executed), **Gone** ([destroyed](#a-destroyed-query-leaves-a-tombstone)) - each
  carry the number of queries they would leave. Picking several _widens_ the result
  (failing **or** stale), the way a network panel's type chips do, and a chip with no
  matches is disabled. The counts are computed before the chips are applied, so a
  chip always states what picking it yields.

  **Gone** is the odd one out: it does not narrow an unfiltered list, it _adds_ to
  it. Destroyed queries are left out of the list by default - they are history, and a
  page that mounts and unmounts a lot would otherwise bury the queries that still
  exist - so the chip's count is how many are waiting behind it.

  A query whose request is in flight counts as **Loading** and not as **Stale**:
  it is already refreshing, so the freshness of what it is replacing is not the
  useful fact about it. That is the same precedence the Cache tab's freshness
  column uses when it reads `refreshing…`.

The count next to the picker reads `12 of 87` while anything is narrowing the
list - the `87` being what the list holds unnarrowed, so tombstones are part of it
only while **Gone** is on - and **Clear filters** drops the term and the chips while
keeping the client scope. The [Insomnia download](#export-to-insomnia) exports
whatever is listed, so these filters pick what ends up in the collection.

### Pinning the query you are working on

Narrowing is not prioritising. The list is in registration order end to end, so the
one query you are debugging sits wherever it happened to be registered and drifts
further down as the app registers more - and typing its route into the filter box
keeps it in view only by throwing every other query away at the same time.

The **★** button at the end of a row sorts **that row** to the top of the list
instead. It appears on hover (and on keyboard focus) and stays lit on a pinned row,
which is also how you unpin it. Two components holding the same creator are two rows
and pin independently, so pinning the one you are debugging does not lift its
siblings with it.

A pin is keyed on the registry id, which is a stable descriptor plus a
per-descriptor sequence number - so a pin survives a reload as long as queries are
created in the same order, the same assumption the restored selection makes.

Pinning **sorts**, it does not filter, so it composes with the client picker, the
filter box and the chips instead of competing with them, and the relative order
within each group is untouched. That is also why there is no **Pinned** chip: the
status chips _widen_ (failing **or** stale), so a Pinned chip could only ever mean
"pinned or failing" and never "pinned **and** failing". The flip side is that a
pinned query still drops out of the list under a filter term it does not match, and
a pinned query that has only a
[tombstone](#a-destroyed-query-leaves-a-tombstone) left stays hidden until **Gone**
is on.

### Tabs say what they hold

Each tab carries the number of entries behind it, and a second red badge with how
many of them are failing - queries in an error state, stacks with an error, failed
sequence steps, `request-error` rows in the event log. A query that fails in a tab
you are not looking at is visible from the tab strip, which is what turns the
panel from something you check into something that tells you.

### Empty tabs fold into "More"

Ten tabs is a lot of strip for an app that uses neither sockets nor sequences, and
stacked it scrolls sideways. A tab with nothing behind it - no
entries and nothing failing - is offered under **More** instead, and moves back
into the strip the moment it holds something, badge and all. **Queries** and
**Faults** always stay: one is where the panel opens, the other has entries to arm
rather than to count. So does whichever tab is open, so the tab you are reading
never folds away under you.

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

**Execute replays those same args.** `execute()` on its own would fall back to
`args()`, which only `withArgs` ever writes - so on an imperatively executed query
the panel's **Execute** button would replay with no args at all, and a function
route would fail outright. It passes what the panel is showing instead, so a
replay repeats the request you are looking at.

A function route that has **never** run has no args anywhere, and there is nothing
to send. **Execute** opens the args editor seeded with the param names the route
declares:

```json
{ "pathParams": { "postId": "" } }
```

Fill them in and run it from there. Nothing a panel button does escapes into the
application's `ErrorHandler`: a failure is reported in the editor, and it names
the real reason - `Invalid JSON` only ever means the draft did not parse.

### Args that are not plain JSON

An arg is often not a plain object. `headers` is an `HttpHeaders` (or a function
returning one), a file upload's `body` is `FormData`, and either can hold a `File`,
a `Map`, a `Set` or a `Date`. `Object.entries` reads none of those - it returns the
private fields of a class instance, and `[]` for a `Map` - so both the tree and the
editor have their own reader for them.

**The value explorer names the type and shows its contents.** `headers` renders as
`HttpHeaders(2)` holding the headers that were actually set, a repeated header
joined on `, ` the way the wire format writes it; `FormData`, `Map`, `Set`, `File`
and `Blob` expand the same way, and a `Date` renders its ISO value instead of an
empty object. A header **provider** shows as `fn(name)` rather than its source text.
Only the args the call passed are shown - client-level headers are merged in later,
and headers an interceptor adds are added after the SDK hands the request over, so
neither is visible here.

**The args editor carries what JSON can carry, and preserves what it cannot.**
Headers become a plain `name: value` record you can edit, and are rebuilt into
`HttpHeaders` when you execute. A `Date` stays editable as its ISO string. Anything
JSON would flatten to `{}` - `FormData`, `File`, `Blob`, `Map`, `Set`, and a header
provider - is left out of the draft and put back **verbatim** on execute, at any
depth, so replaying an unedited draft repeats the request exactly. Deleting a key
from the draft still removes it; only what the draft never carried comes back.

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

| Sub-tab      | Holds                                                                                                                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview** | Base URL, route, request URL, status, cache key, last-executed time, `triggeredBy`, [what refetched it and which form feeds its args](#why-did-this-refetch), features, and the [Activity tiles](#activity-how-often-a-query-ran-and-what-it-cost). |
| **History**  | [Every run the query made, and the response diff](#run-history-and-response-diffs). Carries the run count as a badge.                                                                                                                               |
| **Data**     | The [value explorer](#beyond-a-read-only-view) (args, response or error) and the GraphQL document, if any.                                                                                                                                          |

The **Run** / **Edit** / **Force** actions stay above the sub-tabs, so nothing you
act on is ever behind a tab. A failing query marks the **Data** sub-tab with a red
badge, because that is where the error body lives - a failure never hides behind a
tab that isn't open. Which sub-tab is open is [persisted](#persistence) and shared
by the Queries tab and every split-view drawer.

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
`38% · 120.0 kB of 320.0 kB · 50.0 kB/s · 2.40s left`. Angular only emits progress events for a
request that asked for them, so this needs `reportProgress: true` on the query
creator:

```ts
export const getExport = getQuery<GetExportArgs>('/export', { reportProgress: true });
```

Without it there is no progress to show, and the readout stays absent. The speed and the
remaining time only appear once the transfer has run long enough to be estimated.

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
While anything is armed the panel carries a red bar under the tab strip, naming the clients and
offering **Review** and **Disarm all** - on every tab, not just Faults. A badge on a tab you are
not reading cannot be seen, and the nine other tabs are exactly where an injected 503 gets read as
a real one. The armed client's own card is drawn with a red border, and **Disarm** on it clears
that one client.

Faults are the one part of the panel that is **not** [persisted](#persistence): they live in
memory, so a page reload disarms every client. A persisted "fail everything" that outlived the
session that armed it would be a trap.
:::

A query whose last completed run actually came back faulted also carries the same
[**tampered** badge](#the-tampered-badge) that response overrides do.

Faults are keyed by client **name**, the same identity the client picker uses - so two clients
sharing a name are armed together.

## Response overrides: editing a value that survives a refetch

The value explorer's copy button (`⧉`) has a neighbour: a pencil (`✎`) that opens a menu of
edits for that exact value. Unlike [JIT editing](#beyond-a-read-only-view), which freezes
one raw-JSON snapshot until the next fetch overwrites it, an override is a rule - it is
replayed against whatever the query's response actually is on every future execution, so it
survives a refetch, an invalidation, or a poll tick. Arm it once on a `title` field and every
subsequent response still shows the override, even though the server keeps sending something
else.

What the menu offers depends on the kind of value under the cursor:

| Value                                                                                               | Actions                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| String                                                                                              | Short text, long text, a long word, a Unicode/RTL sample - or, if the key/value look date-shaped, now / +1 day / -1 day / far future / far past / an invalid date string. |
| Number                                                                                              | Zero, negative, huge.                                                                                                                                                     |
| Boolean                                                                                             | Flip.                                                                                                                                                                     |
| `null` / `undefined`                                                                                | Set to text, a number, `true`, an empty object or an empty array - after which that row offers the actions of whatever kind it now holds.                                 |
| Array                                                                                               | Duplicate the whole array (ids/unique fields on the copies are regenerated - see below).                                                                                  |
| An object that is itself an array element                                                           | Duplicate this item.                                                                                                                                                      |
| An object shaped like a paginated response (an `items` array plus recognized total/page/limit keys) | Shrink the page by one item, extend it by one.                                                                                                                            |
| Any leaf except a boolean                                                                           | Custom… - a small input in the menu; the typed value is armed as a rule, so it survives refetches the way every preset does.                                              |
| Any value                                                                                           | Paste value - reads the clipboard and arms it at that path. Onto an object or array the pasted JSON must be the same kind; onto a string leaf plain text pastes as-is.    |
| Any object or array                                                                                 | Fill every string with a chosen preset, fill every number with zero/negative/huge, or flip every boolean under that subtree in one action.                                |
| A value with something armed on it                                                                  | Reset - clears whatever is armed at that path or below it, so resetting a container also undoes a recursive fill.                                                         |

**Presets generate varied samples.** "Short text" on twenty fields yields twenty different short
strings, not twenty copies of the same one - identical fills would hide exactly the bugs a fill is
meant to surface (a key collision, a wrong field rendered, a layout that only breaks on varied
widths). The sample is generated once when the rule is armed and stored in it, so a refetch replays
the same response instead of reshuffling. "Long word" is the overflow counterpart to "long text": a
single unbreakable token (a compound word, a URL, a hex blob) that blows out flex tracks and
ellipsis truncation where whitespace-rich lorem only ever tests wrapping.

**Paste pairs with copy.** The `⧉` button copies a subtree as JSON; "Paste value" on another query's
row arms it there as a replayed rule - which the whole-body response editor can't do, since that one
is one-shot and dies on the next fetch. Clipboard reads need browser permission; a blocked or
unparseable read shows its error inside the menu instead of arming anything.

**Duplicating never clones an id.** Whether from "duplicate this item", "duplicate array",
or a pagination extend, the copy gets a fresh value for any field that looks like an
identity - a key named `id`, `uuid`, `key`, or ending in `Id`, or any key whose value is
already unique across the array's siblings. A numeric id is bumped past the array's current
maximum; a string id gets a `-copy-N` suffix. Without this, a duplicated row would share its
id with the original and break `track` bindings and any detail lookup by id - the exact
failure "duplicate" exists to avoid.

A query's **Data** tab shows a **Reset all overrides (N)** button next to the Response
heading once anything is armed, for clearing every rule on that query at once.

### The tampered badge

An overridden response and a faulted one both mean the same thing: what is rendering is not
what the server actually sent. A **tampered** badge says so wherever that query shows up - the
Queries list row, the query's detail header, and a small red dot on the floating toggle
button, which is what makes it visible with the panel closed. The dot lights up for _any_
query across the whole panel, not just the one you have open.

The badge is deliberately narrower than "a fault is armed on this client": an armed
`fail rate` under 100 lets most attempts through untouched, so badging every query on that
client would over-claim. It lights up only once a query's _own_ last completed run actually
came back faulted, or it has at least one override armed.

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
readable. Clicking a bar opens that query in a split-view drawer, so the waterfall it came
from stays next to it - and every bar belonging to the same query stays marked while it
is open.

Bars are coloured by outcome: green for a response, red for a failure, yellow while
in flight (the bar grows with the clock), and a hollow grey outline for an **aborted**
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

To the right of the bars, duration, received size and the markers each get a column of
their own rather than sharing one line, so the durations down the list stay comparable
by eye - which is the point of a waterfall, and something a run of text that shifts
sideways per row cannot do.

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

The newest **5** runs also keep their response body ([configurable](#picking-both-ends-of-a-diff)),
which is what makes the **Diff** button work. The diff is a flat list of paths, which is
the shape that answers the two questions worth asking:

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

### Picking both ends of a diff

One click on **Diff** compares that run against the newest older run that still holds a
body - not necessarily the run right before it, since a failed run has none to compare.
That derived pairing is labelled **nearest older** next to the header, so a
`#4 → #5` heading never claims to be a choice you made.

It is only a default. Click **Diff** on a second run and that becomes the other end:
the two armed rows read **Base** (older) and **Compare** (newer), and the header names
the pair. Clicking either end clears both. The pair is normalised by run number, so it
does not matter which end you pick first - a comparison always reads older → newer, and
you can start from the older run and work forwards.

This matters most where the adjacent pairing is useless. In a stampede of five
near-identical polls, `#4 → #5` reports **identical** while the comparison worth seeing
is `#1 → #5`. The same goes for the response before a mutation against the one two
refetches later, or pre-login against post-login.

Both ends have to be holding a body, so retention is the real limit on reach: with the
default of five, five rows can be an end of a diff. An older run reads
`body no longer held` and says why on its tooltip, and a run holding the only body left
reads `the only body held`. If a body is trimmed away while it is armed, the diff closes
rather than quietly re-deriving the other end under the same header.

Raise the window when five is not enough reach - it is a memory decision, since bodies
dominate what the run buffer holds:

```ts
bootstrapApplication(AppComponent, {
  providers: [provideQueryDevtools({ responseHistory: 15 })],
});
```

| Option            | Type     | Default | What it does                                                              |
| ----------------- | -------- | ------- | ------------------------------------------------------------------------- |
| `responseHistory` | `number` | `5`     | How many of each query's newest runs keep their response (or error) body. |

Neither end of a pair is persisted: it is per-inspection state, and the runs it names do
not survive a reload anyway.

### A failure stays readable after the query has moved on

A run that failed carries its **status code** as a chip, with every message the error
came with on its tooltip, and an **Error** button that opens the body the failure
arrived with - retained for the newest runs under the same budget as a response body,
so the code and the messages outlive the body itself.

This is deliberately a copy rather than a read of the query's live `error()`, which is
the only other place a failure shows (the **Data** sub-tab). That signal is blanked
whenever the query resets - and `logout()` resets every secure query - so the `401` that
sent the app to the login screen is already gone from there by the time anyone looks for
it. The run history is what survives.

### A destroyed query leaves a tombstone

The failure that is hardest to read is the one that takes its own page down: a `PUT`
that comes back `401` and sends the app to the login screen destroys the component
holding it, and with it the query. The panel keeps that query anyway, as a **tombstone** -
a frozen snapshot of the state it last held, under the same row it always had.

- The row is **not listed by default** - picking the **Gone** chip is what brings
  tombstones in, muted, with a **gone** chip and no status dot, and the drawer says when
  the query was destroyed. A tombstone never counts towards the live chips (**Failing**,
  **Loading**, …), since its state is frozen rather than current. The one exception to
  the hiding is the row the drawer is currently showing: a query destroyed while you are
  reading it keeps its row, so the list does not jump out from under the drawer.
- **Everything it holds is still readable** - Overview, the run history, and the args,
  response and error body under **Data**. That is the whole point: the `401`'s body is
  right there instead of only its status code in the event log.
- **Nothing can be run on it.** Execute / Cached / Reset, the JIT editors and the forced
  states are gone from the drawer, since its handle answers with constants. Copy report,
  cURL and Insomnia still work - they only read.
- **Forget n** appears only while the **Gone** chip is lit, and drops exactly the `n`
  tombstones the list is showing - so a search term narrows what it deletes to what you
  can see. It unlights the chip on the way out, since there is nothing left for it to
  hold. The panel keeps the 50 most recent on its own, oldest dropped first; a tombstone
  holds the last response body it captured, so the list is capped for the same reason the
  cache caps unused entries. The host DOM element is dropped, so a tombstone never keeps a
  destroyed component's node alive.

Only queries tombstone. A stack, sequence, form or auth provider is a container whose
interesting state is the queries it owns, and each of those leaves its own.

## Forms: what a filter is actually sending

A [query form](/query/query-forms) sits between the controls on screen and the args a
query sends, and when a list comes back empty the question is which of those two ends
is wrong. The **Forms** tab answers it: every `defineQueryForm()` on screen is listed
with the query it drives, and expanding one shows every field.

| Column        | Holds                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Field**     | The field name, as declared in `fields`.                                                                                                                     |
| **Value**     | The committed value - what the query args are built from. While a debounce is pending it is followed by `typing …` with the live value of the bound control. |
| **Default**   | What the field falls back to, and what `⟲` resets it to.                                                                                                     |
| **URL param** | `<paramKey>=<value>` with the form's `queryParamPrefix` applied, or `—` for a field that writes nothing (at its default, or `appendToUrl: false`).           |
| **Rules**     | The debounce, the `isResetBy` siblings, and whether the field counts towards `activeFilterCount`.                                                            |

The card header carries the active filter count (or **at defaults**), a **debouncing**
chip while a commit is pending, and a **not observing** chip for a form whose
`observe()` was never called - a form that silently does not sync with the URL looks
exactly like one that does until the tab says so. `⟲` per row and **Reset all** write
to the real form, so you can clear a filter from the panel without hunting for the
control.

### Which query a form drives

**Drives** lists the queries the form feeds. It is not matched by name: a form's
`value()` records the read, so a query is listed once its
[`withArgs`](/query/features#withargs) has read it. Clicking one opens its
[detail](#the-detail-view-overview-history-data) in a split-view drawer rather than
switching tabs - the point of the pairing is to read the form's committed value and the
args the query actually sent side by side.

```ts
qf = defineQueryForm({ name: 'posts', fields: { search: searchQueryField() } }).observe();

// This read is what puts `getPosts` under the form's "Drives", and the form under
// the query's "Args from".
posts = getPosts(withArgs(() => ({ queryParams: { query: this.qf.value().search } })));
```

The query's own detail names the form back, under **Args from** on the Overview
sub-tab. The link is discovered from `withArgs`, so a form read somewhere else - a
[query stack's](/query/stacks#query-stacks) `args`, or a `branch()` - is not picked up, and a form a
conditional branch stops reading keeps its link until the query is recreated.

::: tip Name your forms
`name` is what the tab calls the form. Without it the form falls back to its
`queryParamPrefix`, or to `form` when it has neither - which is fine for one form and
unreadable for four.
:::

The legacy reactive-forms `QueryForm` is **not** instrumented; only
[`defineQueryForm`](/query/query-forms) registers itself.

## Why did this refetch?

`triggeredBy()` tells you a query re-ran, not what re-ran it. An
[invalidation](/query/caching#invalidating-after-a-change) fans out to every
matching entry in use, and from inside any one of those queries that fan-out is
invisible - it just refetches.

The **Events** tab logs the invalidation itself, as one row rather than N request rows:

```
15:04:22   https://api.example.com   refetch ×3   invalidated /players
                                                  GET /players?page=1 ×4
                                                  GET /players/12
                                                  GET /players?page=2 ×2
```

- The **Type** cell counts the requests that were re-executed. `refetch ×0` with
  `matched no query in use` is an answer too - the invalidation ran and hit nothing,
  usually a URL scope that does not line up with the routes.
- Each chip is one cache entry, clickable to open its query. `×4` means four registered
  queries share that cache key, so all four refetched off the one request.
- The cause reads `invalidated <url>` for `invalidateQueries()`, `refreshed everything
in use` for `refreshQueriesInUse()`, and `mutation on <url>` for the
  [multi-tab](/query/multi-tab) refresh another tab's mutation caused. Anything another
  tab asked for is marked `· another tab`.

From the other end, a query's Overview sub-tab gains a **Refetched by** row listing the
refreshes that hit it, newest first. It reads off the event log, so it goes back exactly
as far as the log does (100 events, and **Clear** empties it).

## Events: what each request cost

Every request row carries its **Duration** and the **Size** of the response it
received, so the log answers "which of these was slow, and which was big?" without
opening a query:

```
17:04:22   https://api.example.com   success   GET /posts?page=2      601ms   ≈228 B
17:04:22   https://api.example.com   success   GET /posts?limit=1200  602ms   ≈37.5 kB
17:04:23   https://api.example.com   error 503 GET /flaky            4.21s    —
```

The duration is measured from the `execute()` that started the request, so a row that
took four attempts reads the wall clock of all of them, backoff included - the same
figure the [Activity tiles](#activity-how-often-a-query-ran-and-what-it-cost) report.
A failure has no payload worth a column and reads `—`; sizes prefixed with `≈` were
measured from the decoded body rather than a `content-length` header.

A `dropped` row says a cache entry was torn down, and names what did it: `last consumer
gone`, `unused window over` (its `keepUnusedFor` ran out), `unused entry cap`, `logout`,
or `evicted` by hand. Without it an entry simply vanishes from the Cache tab with nothing
to say which of the five happened.

```
17:04:25   https://api.example.com   dropped · logout             GET /me        —   —
```

Clicking a request row opens the query it belonged to. That still resolves once the query
is gone: the row falls back to matching on the request URL, so a failure fired while its
component was being destroyed opens [its tombstone](#a-destroyed-query-leaves-a-tombstone)
instead of doing nothing.

Two controls narrow the log, which is what makes a hundred rows readable:

- **The client picker** scopes it to one base URL. It only appears once more than one
  client has logged something - a picker with a single option is noise.
- **Errors only** keeps the `request-error` rows, carrying the same count as the tab's
  red badge. It is the fastest way to answer "did anything fail while I did that?".

The count reads `3 of 87 events` while either is active. Both narrow the _view_ only:
a query's **Refetched by** row and the [session export](#attaching-a-whole-session-to-a-bug-report)
keep reading the whole log.

## Cache: what is actually in it

The Cache tab could refetch and evict an entry without ever saying what was in it,
which made an entry no live query holds unreadable. Four additions close that:

- **Value** expands the response held under a key, in the same
  [value explorer](#beyond-a-read-only-view) the detail view uses. This is the only
  way to read an entry whose query is gone - the component that created it unmounted,
  but the cache is keeping the response for its `keepUnusedFor` window.
- **Size** per entry, and the total in the card header. Both are measured from the
  decoded bodies (so `≈`, and compression is ignored), which is enough to spot the one
  endpoint holding 4 MB of list data.
- **collectible** marks an entry with no consumer left. It is not a leak: it is waiting
  out its `keepUnusedFor` window to be reused by a consumer that comes back, and the
  header counts how many are in that state.
- **Evict all** drops every entry of one client, consumers included - the cold-start
  check without a reload. Queries still bound to an evicted entry request again on
  their next execution.

A **Dropped** list under the table names the last 20 entries this client has lost, with
the same cause the Events tab spells out and the time it happened. It is deliberately not
a table row: a destroyed entry has no consumers, no size, no freshness and nothing to act
on, so a full row would be seven columns of dashes. What is left worth showing is what it
was and why it went.

## Sockets: both directions, and an emit box

`WebSocketDevtoolsHandle` used to record received messages only, which made "the room
was never joined" look exactly like "the room is quiet". The log now covers **both
directions**: every room join and leave the client sends, marked `↑ sent` with an accent
edge, next to the `↓ received` messages.

The **Emit** box sends a message the way the app would - an event name and an optional
JSON payload - so a server that only answers a client that asked can be provoked from
the panel. The payload must be valid JSON (`{"id":7}`, `"ping"`, `42`); an empty one
sends a plain event.

The filter box matches an event, a room or a direction across every socket, and terms
are whitespace-separated and all have to match - so `out join` lists exactly the room
joins this client sent.

::: tip
Outgoing capture costs nothing without `provideQueryDevtools()`: the socket client
checks once whether devtools are installed and every recording call is a no-op.
:::

## Copy the route

The three copy actions below all produce a whole document. When all you want is the
endpoint - to paste into a browser, a ticket or a search box - the **⧉** button beside
the route in the detail header copies it on its own.

It copies the **absolute URL the query last requested**, which is what a browser or
Postman wants. A query that has not run yet has no such URL, so it falls back to the
**rendered route** as shown - params resolved to their values, the query string
appended. The button's tooltip names which of the two it is offering and shows the
exact string, so there is no guessing before the click.

The button ticks `✓` on success and resets after a moment, like every other copy
action in the panel. It stays available on a [gone](#a-destroyed-query-leaves-a-tombstone)
entry, where **Run**, **Edit** and **Force** are gated out but the exports still work.

::: tip
This is the detail header only. The same route also renders in the Queries, Stacks,
Sequences and Forms lists, where the rows are click-to-select and a copy control on
every line would crowd them - use the detail for now.
:::

## Copy as cURL

**cURL** in the selected query's action row copies the request as a shell command -
what goes into a terminal, a ticket or a chat message, where an Insomnia collection is
too heavy to be read at all:

```bash
curl 'https://api.example.com/posts?page=2' \
  -X POST \
  -H 'Authorization: Bearer …' \
  -H 'Content-Type: application/json' \
  --data-raw '{"title":"hi"}'
```

It describes the same request the [Insomnia export](#export-to-insomnia) does: the URL
the query actually requested, the headers as the request resolved them (the client's
merged with the per-request ones) and the JSON body. `GET` is left implicit because it
is curl's default, and a GraphQL query is sent as `{ query, variables }` the way the
transport does.

The command is quoted for a POSIX shell, so a body containing quotes stays one argument,
and `--data-raw` is used rather than `-d` - the latter strips newlines, which would
mangle a GraphQL document. Headers the panel could not resolve are left out rather than
guessed: a secure query whose provider has no access token exports without its
`Authorization`, and the token is the one thing worth pasting by hand.

## Attaching a whole session to a bug report

**Copy report** describes one query. A bug report is usually about a screen, and the
question a day later is which of its twenty queries misbehaved. **⤓ Session** in the
header downloads the whole panel as one JSON file:

| Key       | Holds                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clients` | Each query client: base URL, cache entry count, how many are collectible, the total cached size, how many responses are on disk, and its features with their configuration.                                                                                                          |
| `entries` | Every registered entry by kind - a query with its status, activity, run history, args, response, error and any [overrides](#response-overrides-editing-a-value-that-survives-a-refetch) armed on it; a stack's traffic; a sequence's steps; a form's fields; a socket's message log. |
| `events`  | The whole event log (never the filtered view), each row with its duration, size, and the invalidation fan-out it caused.                                                                                                                                                             |
| `faults`  | Anything [armed](#faults-making-requests-actually-misbehave) at the time. A capture taken while the panel was lying to the app has to say so, or the report sends someone chasing a fake 503.                                                                                        |

Bodies are slimmed the way **Copy report** slims them - long strings truncated, long
arrays sampled down to `… (N more)` - so the file stays small enough to attach and a
4 MB response does not become the report. It also records the URL the session was
captured on, so a report says which environment it came from.

::: warning
Access and refresh tokens are **never** exported. An auth provider is described by
whether it holds each token and how long the access token has left, because a file that
travels to a ticket must not carry a bearer token. The Insomnia export is the deliberate
exception - it carries a refresh token because that is what makes its chain work, and
[it says so](#secure-queries-get-a-self-refreshing-token).

The rest is your app's data: args and responses go into the file as they are, slimmed
but not redacted. Read it before you attach it.
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
- **JIT editing** - a quick one-off: paste raw JSON over a query's response and
  apply it via `setResponse()` (the UI re-renders instantly), or replay the query
  with edited args. It does not survive the next fetch - for an edit that should
  keep applying every time the query reruns, arm a
  [response override](#response-overrides-editing-a-value-that-survives-a-refetch)
  instead.
- **Response overrides** - a per-value menu in the value explorer that edits a
  path inside a response and keeps reapplying that edit on every future fetch -
  [see below](#response-overrides-editing-a-value-that-survives-a-refetch).
- **Force states** - force a query into loading / error / empty to exercise
  skeletons, spinners and error / empty UIs on demand (`Clear` restores it). This
  writes the query's signals directly; to exercise the pipeline behind them -
  retries, error handling features, the cache - arm a
  [fault](#faults-making-requests-actually-misbehave) instead.
- **Cache actions** - [read, refetch or evict](#cache-what-is-actually-in-it) a
  cache entry, evict a whole client, and watch the freshness countdown.
- **Emit a socket message** - [send a test message](#sockets-both-directions-and-an-emit-box)
  as the app would, and see it in the log next to what came back.
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

The view state - open/closed, [dock edge, the size of each and the pane sizes](#where-the-panel-sits),
active tab, the query detail's
[sub-tab](#the-detail-view-overview-history-data), selected client, selected
query, inspect filter, the query filter term and status chips, the
[event log's](#events-what-each-request-cost) client scope and errors-only toggle,
the [socket message filter](#sockets-both-directions-and-an-emit-box), value-explorer
search and expanded tree paths - is
persisted to `sessionStorage` under `ethlete:query:devtools:v4`, so it survives a
page reload within the tab session without leaking devtools state across sessions.
(Restoring the selected query relies on registry ids being stable across reloads,
which in turn assumes queries are created in the same order.)

[Pinned queries](#pinning-the-query-you-are-working-on) are the one thing kept
elsewhere: `localStorage`, under `ethlete:query:devtools:pins:v2`. Everything above is
view state that should die with the tab, while a pin says which query you are working
on and is meant to outlive one - and since a pin holds a registry id, it depends on
creation order exactly the way the restored selection does.

[Armed faults](#faults-making-requests-actually-misbehave) and
[response overrides](#response-overrides-editing-a-value-that-survives-a-refetch) are
deliberately **not** part of that: they change how the app behaves, not how the panel
looks, and a reload clears both. Neither is [being popped out](#where-the-panel-sits),
which a reload cannot restore.

## Accessibility

The devtools panel is a development tool, not part of your product UI. The tab
strip uses `role="tablist"` / `role="tab"` with `aria-selected`, and its
[**More** control](#empty-tabs-fold-into-more) is an `aria-haspopup` button whose
items are plain buttons; the rest of the controls are native `<button>` and
`<select>` elements. It is not intended to ship in
production builds.

## Theming

The panel styles its own chrome from the [surface & color theming](/core/theming)
tokens (`--et-surface-*-solid`, `--et-theme-color-primary-solid`) so it adapts to
the host app's current surface, and falls back to a self-contained dark palette
when no themes are registered. Override the panel's internal `--_et-qdt-*` custom
properties on `.et-query-devtools-host` if you need to retune it. Its CSS lives in
the `components` cascade layer like every other component, so utility classes can
override it without `!important`.
