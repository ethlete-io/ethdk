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

`provideQueryDevtools()` also takes `about` (build info for the
[About tab](#about-which-build-is-running)), `responseHistory` (how many bodies each query keeps) and
`schema` (your API description, for
[seeding a designed mock](#seeding-from-your-api-description)).

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
monitors neither is right. The header's **layout menu** - the button naming where
the panel currently is - lists every alternative:

| Layout        | What it does                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **⬓ Bottom**  | The default. Sized by dragging its top edge.                                                                                                    |
| **⬒ Top**     | The same, hanging from the top edge - useful when what you are debugging is at the bottom of a long page.                                       |
| **◧ Left**    | Docked to the left edge, sized by dragging its inner edge.                                                                                      |
| **◨ Right**   | The same on the right.                                                                                                                          |
| **❐ Float**   | A window inside the page: moved by the dotted grip on its title bar, resized from any of its eight edges and corners, and parkable off an edge. |
| **⧉ Pop out** | Moves the panel into a window of its own.                                                                                                       |

Either side dock stacks the master/detail and split views vertically rather than
side by side, so neither pane is squeezed below what it needs.

A **pop-out** is the _same_ live panel, not a second one, so every signal in it
keeps updating from the app you are inspecting, and **Inspect** still highlights
components in the app window. **⧈ Dock back** (or closing the window) brings it
home, to whichever layout it left from.

**Float or pop out?** They are not interchangeable. A real window survives being
covered by the app and can go to a second monitor, but needs pop-up permission and
dies with the tab that opened it. A float needs no permission and no window
management, and it is the only one of the two a reload can restore - but it is an
element in your page, so it stacks by `z-index` like any other overlay in this
library. (The native top layer is deliberately not used anywhere in the SDK: it
would break apps that rely on `z-index` layering.)

A float is moved and resized on the same `@ethlete/core` primitives the stream
[picture-in-picture window](/components/stream) uses - `[etDragHandle]` and
`<et-resize-handles>` - so the two behave the same way under the hand, including
parking:

**Shove it off an edge to park it.** Drag the panel more than halfway past the
left, right or bottom edge and it stays there with a grab strip of about 44px
still on screen - out of the way of whatever you are looking at, without being
closed and without losing the tab, the selection or the filter you had set up.
Click that strip to bring it back. A drag that stops short of halfway is pulled
fully back in instead, so a clumsy drag never parks it, and a parked panel drops
its resize handles so the whole peek is grabbable.

The **top edge is deliberately not a parking edge**: the title bar is the only
thing that drags the panel back, so it is never the part allowed to leave. Parking
survives a reload along with the rect, and a window that shrinks under a parked
panel keeps its strip reachable rather than pulling it back in.

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

On a coarse pointer the chrome's controls grow from 24px to 34px and its rows from
36px to 44px, so a filter chip is a target you can hit with a thumb; the keyboard
shortcut caps in the header are dropped, since there is no keyboard to press them on
and they are what pushed **Close** past the panel's edge. Nothing moves or is hidden
beyond that - it is the same panel at a size a finger can use.

Which position you picked, the size of each, the floating panel's rect and the pane
sizes are all [persisted](#persistence). A restored float is **checked against the
current viewport before it is shown**, so a rect stored on a large monitor - or one
dragged to an edge of a window that has since been shrunk - is pulled back into
view rather than opening off screen. The same clamp runs while you drag and
whenever the window resizes, so the panel can never end up somewhere you cannot
reach it. A float narrower than 620px stacks its two panes, the same way a right
dock does.

Being popped out is not persisted: a reload cannot re-adopt the window the previous
document opened, so the panel always comes back where it was docked or floating.
The pop-up is closed as the host page unloads, rather than left behind holding a
panel of a document that no longer exists.

::: tip
A pop-out is the app's own panel relocated, which is what makes it live - but it
also means it borrows the app's stylesheets and the surface theme the panel was
docked in, and it cannot outlive the tab that opened it. Reloading the app closes
it. Pop-up blockers apply - and if the window is refused the panel says so, with a
one-click **Float instead**, rather than the button appearing to do nothing.
:::

## Tabs

| Tab           | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Queries**   | Every registered query, [filterable by client, endpoint and live state](#finding-a-query-in-a-long-list). Method badge, [resolved route](#routes-show-the-params-that-were-used), live status and a stale marker; the [detail view](#the-detail-view-overview-history-data) shows args, response/error, cache key (`id()`), last-executed time, `triggeredBy`, [the features it was created with](#features-show-what-they-were-configured-with), [how often it ran and what it transferred](#activity-how-often-a-query-ran-and-what-it-cost) and [every run it made](#run-history-and-response-diffs), with `execute()` / `execute({ options: { allowCache: true } })` / `reset()` actions.         |
| **Stacks**    | Query stacks and paged query stacks: combined loading/error, and for paged stacks the pages loaded, item count and direction, plus [the traffic every page caused](#activity-how-often-a-query-ran-and-what-it-cost). Inner queries are listed as rows and open in a split-view drawer (the stack context is kept).                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sequences** | Each `querySequence` as a selectable step chain - click a step to open its query in a split-view drawer (like Stacks); expand a step to see its input args and output response/error inline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Forms**     | Every [`defineQueryForm`](/query/query-forms) on screen: [its fields, what they put in the URL and the query it drives](#forms-what-a-filter-is-actually-sending). A driven query opens in a split-view drawer (like Stacks), so the form stays on screen next to it.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Auth**      | Each bearer auth provider: authenticated state, [which tab refreshes its tokens](#which-tab-refreshes-the-tokens), access/refresh token presence, the decoded access-token JWT payload, current `executionState`, the latest auth query snapshot and [its features with their configuration](#features-show-what-they-were-configured-with).                                                                                                                                                                                                                                                                                                                                                          |
| **Sockets**   | Each `createWebSocketClient`: connection state, joined rooms and a rolling log of [everything sent and received](#sockets-both-directions-and-an-emit-box), with a filter box and an emit box for test messages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Cache**     | Per-client repository entries: cache key, consumer count, [measured size](#cache-what-is-actually-in-it), secure flag, a live freshness countdown, the [multi-tab sync](/query/multi-tab#debugging-it) state (`polling` / `standby`, and when the entry last took a response from another tab), whether the entry took its data from the [persisted store](/query/persistence#debugging-it) and per-entry **Value** / **Refetch** / **Evict** actions. The card header adds the cache's total size, how many entries are collectible, how many responses the client has on disk (with **Clear disk**), **Evict all**, and [the client's own features](#features-show-what-they-were-configured-with). |
| **Timeline**  | [Every request as a bar on one shared axis](#timeline-what-overlapped-with-what) - what fires on mount, whether a chain is an N+1, whether a poll is stampeding. Clicking a bar opens its query in a split-view drawer (like Stacks), so the waterfall stays on screen next to it.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Events**    | A rolling log (last 100) of repository `request-success` / `request-error` events with [timestamps, duration and response size](#events-what-each-request-cost), narrowable by client and to failures only, plus one row per [invalidation and its fan-out](#why-did-this-refetch). Clicking a row's request opens the query it belonged to.                                                                                                                                                                                                                                                                                                                                                          |
| **Faults**    | [Latency and failures you can arm per client](#faults-making-requests-actually-misbehave), injected into the request pipeline so retries, error handling and the cache see them as real.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Mocks**     | [Responses served instead of the request](#mocks-answering-a-route-the-panel-not-the-api) - designed by hand for a route nothing has called yet, or captured from one that has, and [exportable as OpenAPI](#handing-the-designed-routes-to-the-api-team).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **About**     | [Which SDK and application build is actually running](#about-which-build-is-running) - the loaded `@ethlete/*` versions, the Angular version, and whatever the app handed to `provideQueryDevtools({ about })`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

[Settings](#settings-what-the-panel-keeps-and-where) is not one of them: it holds nothing
to count, so the [badge and overflow logic](#empty-tabs-fold-into-more) would push the one
tab that explains a panel behaving oddly behind **More**. It opens from the **⚙** button in
the header instead, and the same click closes it again over the tab you were on.

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
  (failing **or** stale), the way a network panel's type chips do. The counts are
  computed before the chips are applied, so a chip always states what picking it
  yields.

  Only the chips that would actually narrow the list are rendered: a status nothing
  is in is left out rather than shown at zero, so the row reads as what the list
  holds instead of as five controls, four of which cannot be pressed. A chip you
  have picked stays visible even when its count falls to zero - it is the only thing
  on screen that explains why the list is empty.

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

### Grouping the list by route path

The list is flat by default, which is the right shape for "what ran just now".
The **⑂ tree** toggle beside the sort arrow rearranges it by route path instead,
for the other question: _what does this screen actually hit?_

Two rules keep the tree from being worse than the list it replaced:

- **A segment nothing branches off gets no heading.** A `/flaky` folder above one
  `GET /flaky` row costs a line and a level of indentation to repeat what is on
  the line below it. Only a segment that actually splits the list becomes a
  folder, so a list of unrelated routes looks almost exactly like the flat one.
- **Single-child chains are folded into one row.** `/api` → `/v1` → `/teams`
  becomes one `api/v1/teams` heading, not three.

**Rows under a folder leave off what the folder already says.** Below a `/post`
heading the rows read `…/1` and `…/:postId`, not `/post/1` and `/post/:postId` -
the `…` is the marker, and hovering it gives the whole route back.

A folder counts everything at or below it and can be collapsed; which folders you
closed is [persisted](#persistence), and the tree opens **open** rather than
closed - a tree showing only the first segment of every route answers nothing.
The tree is built from the route each row _shows_, the same string
[the fold](#rows-that-would-repeat-are-folded) uses - so `/post/1` and `/post/2`
are two rows under one `/post`, which is what makes it answer "which ids did this
screen fetch". Pinning and the sort still decide the order within a folder.

### When each query last ran

Every row ends with the time of its **last run**, absolute and 24-hour (`14:22:07`), and the
list is sorted by it - **newest first** by default, so the query that just ran is at the top.
A query that has never executed reads `-`.

The control beside the search box shows the direction rather than implying it, and clicking
it reverses:

```
recent ↓     newest run first
recent ↑     oldest run first
```

Only the direction is switchable. The field is not, because "which one just ran" is the
question the column exists to answer - and `createdAt` ascending is what the list already did
before it had a column at all.

Queries that have **never run** sink to the bottom in _both_ directions. They have no place on
a time axis, and flipping the arrow must not turn the list into the queries that have not run
yet. A [tombstone](#a-destroyed-query-leaves-a-tombstone) keeps the time it was frozen at, and
falls back to when it was destroyed, so gone entries stay ordered among themselves rather than
piling up with the never-run ones.

[Pins](#pinning-the-query-you-are-working-on) still sit above the sort - the sort orders within
the pinned and unpinned groups, it does not replace them. The direction is
[persisted](#persistence).

::: tip
The column is absolute, not `12s ago`. A relative column needs a ticking signal re-rendering
every row once a second; the two `Ns ago` strings elsewhere in the panel avoid that by only
being computed when they are read.
:::

### Rows that would repeat are folded

One query used by several components is **one registry entry per component** - that is
what makes the detail pane, pinning and tombstones work per instance - so a list in
registration order shows the same line once per consumer. Three cards reading the same
endpoint is three identical rows, and none of them says which is which.

Rows that would be indistinguishable fold into one, with the instance count at the end:

```
▸ POST /posts                            ×3
```

Click it to expand; the members appear indented underneath and each behaves exactly as a
row always did - select it, pin it, read its own detail. The **group is folded on what the
row shows**, not on the query creator, so `/post/1` and `/post/2` stay two lines: folding
can never hide a distinction the list was already making. A tombstone never folds into a
live query either.

The collapsed line reports the **worst** state in the group - if one of three instances is
failing, the folded row is the failing dot - and carries **stale** or **tampered** if any
member does. A group holding the selected query stays open regardless, so the detail pane
can never show a query with no row to match it. Which groups you opened is
[persisted](#persistence).

A folded row carries [the time](#when-each-query-last-ran) of the member that placed it -
the newest of the group under `recent ↓`, the oldest under `recent ↑` - followed by the count.

The count beside the client picker still counts **queries**, not lines, so `19` with
fourteen rows on screen is the list telling you it folded five.

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

## Which tab refreshes the tokens

The **Auth** tab's Features row describes how
[`withBearerAuthMultiTabSync`](/query/auth#multi-tab-sync) was _configured_ -
`leader election one tab refreshes` is the setting, not the outcome. A chip next to
`authenticated` says what actually happened in **this** tab:

| Chip                  | Means                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| `leader · ~3 tabs`    | This tab performs the automatic token refresh, and three tabs are in the election. |
| `follower · ~3 tabs`  | Another tab does. Reload it or close the leader to watch the handover.             |
| `every tab refreshes` | There is no election - the tooltip says whether it was turned off or is missing.   |

The `~` is not decoration. The tab count is recounted when a tab announces itself,
says goodbye or takes over, never on a timer, so a tab that _crashed_ as a follower
stays in the count until one of those happens. The tooltip spells that out too.

`every tab refreshes` covers the two cases where `isLeader` is `true` in every tab at
once, which would otherwise read as a bug: `leaderElection: false`, and a browser
without the Web Locks API. The provider reports which through its `leadership`
field - the panel only renders it.

The chip is absent for a provider without the feature, where one tab refreshing its
own token is simply correct.

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

The action row stays above the sub-tabs, so nothing you act on is ever behind a tab.
It holds one primary action and three groups:

| Control                        | What it is                                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **▶ Execute / Cached / Reset** | Run the query ignoring the cache, run it the way the app would, or drop its state back to idle.                                                                                                          |
| **⌖ Locate**                   | [Scroll to and outline the element the query was created in](#beyond-a-read-only-view).                                                                                                                  |
| **⧉ Copy**                     | Copy report, [copy as cURL](#copy-as-curl), [copy for Insomnia](#export-to-insomnia). The trigger ticks over when one lands.                                                                             |
| **✎ Override**                 | [Edit the response](#response-overrides-editing-a-value-that-survives-a-refetch), replay with edited args, or [force a state](#beyond-a-read-only-view). Turns red while anything is armed on the query. |

Copy and Override are menus rather than seven more buttons: the row is read most
often to press **Execute**, and a flat row of everything made that the hardest thing
on it to find. A failing query marks the **Data** sub-tab with a red
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

## Mocks: answering a route the panel, not the API

A fault decides _whether_ a request fails; a
[response override](#response-overrides-editing-a-value-that-survives-a-refetch) edits what came back.
Neither can answer a route that returns nothing yet. A **mock** replaces the request itself: the panel
serves the body, and the cache, the retry policy and every error feature see it exactly as they see a real
response.

That is what makes it usable before the endpoint exists. **New mock** takes a client, a method, a path
pattern, the query parameters that must be present, a status, a latency and a JSON body - none of it
checked against the registry, because a route no query has ever called is the point.

| Field       | Matched                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Client**  | by name, the same identity faults use                                                                                                     |
| **Method**  | exactly                                                                                                                                   |
| **Path**    | segment by segment; `:name` matches any one segment, so `/posts/:id/comments` answers the route rather than one URL                       |
| **Query**   | every parameter you name has to be on the request; anything else it asks for is ignored. Empty answers whatever the query string is       |
| **Status**  | `400` and above arrive as a real `HttpErrorResponse`, body and all - so error handling sees a designed failure the way it sees a real one |
| **Latency** | ms before the mocked response settles, so a mocked route still has a loading state to render                                              |

When two armed mocks could both answer, **the one naming more query parameters wins** - so a special case
armed on top of a general mock is what answers, rather than whichever was designed first.

### Capturing what actually happened

The other way in is the **Capture** list: every live query holding a response, one row per route. It seeds
a mock from the body the API really sent, which is the fast path to "the same response, but with this one
field empty". A route several queries share is listed once, saying how many - a mock answers the route, so
it answers all of them.

**Status** and **Latency** are editable in place; **Body** opens the designer.

### Designing the body

**Body** on a designed row opens the same value explorer the panel uses for a real response, with the same
per-node menu - [string, number and date presets](#response-overrides-editing-a-value-that-survives-a-refetch),
fill-every-string, duplicate item, duplicate array, pagination shrink/extend, paste, delete. Pointed at a
draft instead of a live response, that vocabulary is an authoring tool: a fifty-row page comes from
duplicating one row six times, and a page with an unbreakable 200-character title is two clicks.

Edits accumulate as override ops and are **flattened into a plain body on Apply**, so what is stored is a
value rather than a recipe. Until then, **Undo all** drops every edit and returns the body the session
started from. **JSON** switches to the raw body; leaving it carries whatever you typed there into the tree,
so the two are two views of one draft.

### Seeding from your API description

Hand `provideQueryDevtools()` your OpenAPI document and a designed body can start from the real shape of a
route rather than a guess:

```ts
provideQueryDevtools({
  // Called at most once, and only when the Mocks tab is first opened - so a dynamic import keeps the
  // document out of your application bundle.
  schema: () => import('../openapi.json'),
});
```

Anything with named schemas works: OpenAPI 3.x (`components.schemas`), Swagger 2 (`definitions`) or a bare
JSON Schema document (`$defs`). A remote URL is a one-liner too:
`schema: () => fetch('/openapi.json').then((res) => res.json())`.

TypeScript types are erased at runtime, so "start from the route's declared response type" is not something
the panel can do from your code - the document those types were generated _from_ is what it reads.

With one loaded, the **New mock** form gains a **Seed** row:

| Control            | What it does                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **a route…**       | every route the document declares - _including the ones your app has never called_ - and picking one fills the method, path and body |
| **From this path** | generates a body from the success response the document declares for the path already in the form                                    |
| **a named type…**  | generates a body from one named schema (`MatchView`), for a route the document does not declare                                      |

Generation is deliberately dull and deterministic: `$ref`s are followed, `allOf` is merged, an `example`
or `default` the document ships is used as-is, an `enum` takes its first value, a `format` becomes a
shaped placeholder (`uuid`, `date-time`), a number takes its `minimum`, and a string with nothing to go on
takes its own field name - so a seeded body reads as obviously unreal while still saying which field you
are looking at. Everything it had to guess is listed under the body: which branch of a `oneOf` it took,
where it cut a schema that contains itself, which base path it ignored when matching the route. **A seed is
a starting point, never a claim about what the API returns.**

Fields the document describes are then labelled in the designer with the type they are declared as -
`MatchId` rather than `string`, with `?` on the ones the schema does not require. One label covers every
element of an array, however many you go on to add. The mock remembers the schema it was seeded from, so
the labels come back after a reload.

### Copying the route back out as TypeScript

**⧉ TS** copies the route as a `@ethlete/query` definition - the response type inferred from the designed
body, the args contract and the creator call:

```ts
// Inferred from one example: every field reads as required and non-nullable.
// `getQuery` is `createGetQuery(client)`.
type GetPostsCommentsResponse = {
  items: {
    id: number;
    text: string;
  }[];
};

type GetPostsCommentsQueryArgs = {
  response: GetPostsCommentsResponse;
  pathParams: { id: string };
  queryParams: { page: number };
};

export const getPostsComments = getQuery<GetPostsCommentsQueryArgs>((p) => `/posts/${p.id}/comments`);
```

One example cannot say what is optional or nullable, so everything in it reads as required - the comment
says so rather than the type pretending otherwise.

### Handing the designed routes to the API team

The TypeScript snippet is what the frontend wants back. The other direction - _"here is the response we
need, please build it"_ - is an **OpenAPI 3.1** export, and it is the reason designing a route in the panel
is worth more than a screenshot.

| Where                                       | What comes out                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **⧉ OAS** on a row                          | that one route as a keyed `paths` entry, on the clipboard - ready to paste under the `paths` of a description you already have                        |
| **Export OpenAPI** in the **Designed** head | the whole library as one complete document, downloaded as `openapi-designed-mocks-<date>.yaml` - armed or not, because the library is the design work |

The **YAML/JSON** picker next to it applies to both. YAML is the default because it is what a specification
repository takes; the JSON is the same tree.

```yaml
'/authors/{authorId}':
  get:
    tags:
      - main
    summary: 'Designed response for GET /authors/{authorId}'
    description: "The response is this description's own AuthorView, which the mock was seeded from."
    operationId: getAuthors
    parameters:
      - name: authorId
        in: path
        required: true
        schema:
          type: string
    responses:
      '200':
        description: The designed response served for main.
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AuthorView'
            example:
              id: 00000000-0000-4000-8000-000000000000
              name: name
              posts: []
```

**A route [seeded from your description](#seeding-from-your-api-description) references the schema it was
seeded from** rather than an anonymous shape inferred from one body - and the whole-library export copies
that schema, plus everything it transitively `$ref`s, into its own `components.schemas`, so the document
resolves on its own. The single-route fragment keeps the `$ref` without the copy, because it is merged back
into the description that already declares it; the panel says which schemas that is.

Everything else is **inferred from one example, and the document says so in its own `info.description`**:

- every property the example carried is listed in `required`, because that is what the example proves;
- nothing is marked nullable, and a property whose example was `null` carries **no type at all** rather than
  a guess;
- `format` is only ever `date-time` or `uuid` - the two a value cannot hold by accident;
- an array whose members disagree becomes a `oneOf`; an empty array constrains nothing;
- a designed `POST`/`PUT`/`PATCH` declares no `requestBody`, and says why.

Two mocks that differ only by query string are two examples of one response, so they export as named
`examples` (`page=1`, `page=2`) under the first one's schema. Anything the export had to resolve that way -
a merged status, a schema it could not find, a `$ref` pointing outside your description - is listed under
the library after the export, the same way a seed lists what it guessed.

### What a mock is not

- **It is not [MSW](https://mswjs.io).** MSW intercepts at the network layer and belongs in tests. This
  mocks at the query-client layer, knows every registered route, and exists to be armed for a minute while
  you look at something.
- **It bypasses the interceptor chain**, because nothing is sent. A mocked secure route never exercises the
  token flow, and the row says `no auth` when a live query on it authenticates.
- **GraphQL queries are not offered.** They all POST one route, so matching them needs the document rather
  than the path.

### Arming it is loud, and never survives a reload

The library you design is [persisted](#settings-what-the-panel-keeps-and-where); **whether a mock is armed
is not, at any scope**. Losing an hour of authoring to a closed tab is unacceptable; an app that silently
serves designed data tomorrow morning is worse.

While anything is armed, a red bar above every tab names the routes it answers, with **Review** and
**Disarm all**, and every query on a mocked route carries the [**tampered** badge](#the-tampered-badge). An
armed mock is also part of the [session export](#attaching-a-whole-session-to-a-bug-report), because a
capture taken while the panel was answering requests has to say which ones.

## Copying a key or a path

`⧉` copies the **value**, which is what you want for an id or a URL - and no help at all when
the question is _which field holds this_. A caret (`▾`) beside it opens the rest:

| Action         | Copies                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| Value          | Exactly what `⧉` does, unchanged - one click, no menu.                                      |
| Key            | The bare key, ready to paste into the explorer's own `filter keys / values…` box or a grep. |
| Path           | The JSONPath from the explorer's root, e.g. `$.data.items[0].title`.                        |
| `"key": value` | Both, as a pasteable JSON entry for a fixture or a mock.                                    |

The path is the **same format the History tab's diff uses** in its Path column, so a path read
off a diff and a path copied off the explorer are the same string. `$` is the value that explorer
was handed - the response, the args, the error - not the query.

Two rows deliberately offer less. An **array element** is keyed by its index, so "Key" and the
`"key": value` fragment would produce `0` and `"0": …`; only the value and the path are offered
there. A **folded slice** (`0 … 99`) and the explorer's own root have no key and no single path,
so they keep the plain `⧉` and get no caret at all.

Because one button now writes four different things, the green tick says which: the button's
tooltip reads _Copied the path_ / _Copied the key_ while it is up.

The caret is on **every** value explorer - args, response, error, run error, auth payloads,
sequence step args, socket messages, cache entries, form values - unlike the override pencil,
which only the Response explorer carries.

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
| Anything not already empty                                                                          | Set to `null`.                                                                                                                                                            |
| Array                                                                                               | Duplicate the whole array (ids/unique fields on the copies are regenerated - see below), or empty it.                                                                     |
| An object that is itself an array element                                                           | Duplicate this item.                                                                                                                                                      |
| An object shaped like a paginated response (an `items` array plus recognized total/page/limit keys) | Shrink the page by one item, extend it by one.                                                                                                                            |
| Any leaf except a boolean                                                                           | Custom… - a small input in the menu; the typed value is armed as a rule, so it survives refetches the way every preset does.                                              |
| Any value                                                                                           | Paste value - reads the clipboard and arms it at that path.                                                                                                               |
| Array                                                                                               | Paste as new item - the clipboard lands as one more element on the end.                                                                                                   |
| Anything but the response root                                                                      | Delete this key, or Delete this item inside an array - the field becomes **absent**, not empty, and a deleted element is spliced out rather than left as a hole.          |
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
is one-shot and dies on the next fetch. Pasting a kind the row does not already hold (an array over a
string, an object over a `null`) asks first, then goes through - "this field became an array" is a
change worth rehearsing, and the confirmation is there to catch a copied _path_ pasted over a body by
mistake.

**A blocked clipboard is not a dead end.** Reading the clipboard needs browser permission and some
browsers refuse outright. Where the one-click read fails, the menu turns into a small box that takes a
real `⌘V` / `Ctrl+V` - a paste event needs no permission anywhere - and arms whatever lands in it.

**Deleting is not the same as emptying.** "Set to `null`", "Empty this array" and "Delete this key" are
three different lies to tell: a field that is `null`, a field that is `[]`, and a field that is not
there at all take different paths through the code reading them, and only the third one exercises
optional-property handling.

**Duplicating never clones an id.** Whether from "duplicate this item", "duplicate array",
or a pagination extend, the copy gets a fresh value for any field that looks like an
identity - a key named `id`, `uuid`, `key`, or ending in `Id`, or any key whose value is
already unique across the array's siblings. A numeric id is bumped past the array's current
maximum; a string id gets a `-copy-N` suffix. Without this, a duplicated row would share its
id with the original and break `track` bindings and any detail lookup by id - the exact
failure "duplicate" exists to avoid.

A query's **Data** tab shows a **Reset all overrides (N)** button next to the Response
heading once anything is armed, for clearing every rule on that query at once.

### Moving a whole set of overrides somewhere else

Building up a dozen rules to reproduce a bug and then needing them on a second query - or in a
ticket, so someone else can reproduce it - is what **Override ▾ → Override set** is for. It copies
every rule armed on the selected query as one JSON payload, and pastes one back:

```json
{
  "kind": "ethlete-query-overrides",
  "version": 1,
  "source": { "id": "query|api|GET|/post/:postId#0", "url": "https://api.example.com/post/1" },
  "ops": [
    { "type": "stringPreset", "path": ["title"], "preset": "custom", "custom": "A long title…" },
    { "type": "deleteAt", "path": ["publishedAt"] }
  ]
}
```

Paths are relative to the response root, so a set pasted onto a differently-shaped query lands on
whatever still matches and **says how much did not**: the menu reports how many rules it armed, how
many of them resolve against nothing in the current response, and how many the running build has no
`type` for. Nothing is silently dropped.

A paste **adds** to whatever is already armed rather than replacing it - use **Reset all overrides**
first if you want only the pasted set. `source` is a bearing for whoever reads the payload next;
nothing resolves against it, so hand-editing the ops or trimming the envelope down to a bare `[…]`
array of them still pastes.

### Keeping overrides across a reload

Overrides die with the page by default. Next to **Reset all overrides** sits a
**Keep across reloads** toggle that changes that: with it on, every armed override in
the panel is written under `ethlete:query:devtools:overrides:v1` and replayed as each query
registers on the next load. The store is `sessionStorage`, so they die with the tab -
[Settings ⚙ → Storage](#settings-what-the-panel-keeps-and-where) can move them to
`localStorage` if you have a reason, and says what that costs.

The toggle is **panel-wide**, not per query, and it captures what is armed at the moment
you switch it on - so the sequence is "arm the edits you want, then keep them", not "turn
it on first". Turning it off empties the store and leaves everything armed for the rest of
the current page.

Because an override is a rule rather than a frozen body, this costs almost nothing to
store: what is written is the op list, and it re-arms against whatever the API sends next.
Overrides key on the same registry entry ids the restored selection and pinned queries use,
so they depend on queries being created in the same order across the reload.

**A reload that re-arms says so.** The panel opens with a red bar naming how many edits came
back and on how many queries, with **Review** (jumps to the first of them) and **Drop all**
(disarms everything it brought back and empties the store). If they came back from
`localStorage` the bar says that too, because "survives a reload" and "survives closing the
tab" are different things to have been told. If the store held ops for a query
that never registered - a route that no longer runs, a creation order that shifted - the same
bar lists them as _matched no query_ rather than letting them land somewhere else silently.
The [tampered badge](#the-tampered-badge) and its dot on the closed toggle light up from a
re-armed override exactly as they do from one you just armed, so a page whose responses are
edited never reads as a page that is merely broken.

**Armed faults do not come along**, deliberately - see
[Faults](#faults-making-requests-actually-misbehave). A fault is a client-wide switch with no
path to point at, and a persisted one would make every request on that client fail from the
first load with nothing on screen to attribute it to until the panel is opened.

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

This is the default rather than the last word: **Settings ⚙ → Limits** raises it for the rest
of the page, which is what you want when you are already chasing something and do not want to
restart the app to get more reach. It applies to runs from that point on - a body already
trimmed is gone.

Neither end of a pair is persisted: it is per-inspection state, and the runs it names do
not survive a reload anyway.

### Reaching the diff without scrolling

The run log keeps **25** runs but only the newest few keep a body, so a busy query left the
diff sitting under twenty rows that could never be an end of it. Two things keep the pair and
its result together:

- **The bodiless tail is folded.** Only the runs that can still be diffed are listed; the rest
  are behind **Show N older runs with no body** under the table. Nothing is dropped and nothing
  is reordered - a dead row _between_ two live ones stays where it is, so the log keeps its
  order and every run number is still reachable.
- **The pair steps from the diff header.** **◂ Older** and **Newer ▸** next to
  `Response diff · run #10 → #11` move the whole comparison one run at a time, keeping whatever
  gap it has, so re-picking never means going back up to the table. Both disable at the ends of
  what is retained - the stepper cannot walk off into runs whose bodies are gone.

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
- **Nothing can be run on it.** The Execute group and the whole **Override** menu are
  gone from the drawer, since its handle answers with constants. **Copy** stays - report,
  cURL and Insomnia only read.
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
entry, where the Execute group and **Override** are gated out but the exports still work.

::: tip
This is the detail header only. The same route also renders in the Queries, Stacks,
Sequences and Forms lists, where the rows are click-to-select and a copy control on
every line would crowd them - use the detail for now.
:::

## Copy as cURL

**Copy as cURL**, in the selected query's **⧉ Copy** menu, copies the request as a
shell command -
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
| `mocks`   | The [mocks](#mocks-answering-a-route-the-panel-not-the-api) armed at the time, with the body each was serving.                                                                                                                                                                       |
| `about`   | [Which build produced the session](#about-which-build-is-running) - the loaded `@ethlete/*` versions, the Angular version and the app's own build info.                                                                                                                              |

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

## About: which build is running

A bug report that does not say which SDK it came from costs a round trip. The **About**
tab answers it, and so does the `about` block of the [session export](#attaching-a-whole-session-to-a-bug-report):

| Group           | Holds                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ethlete**     | Every loaded `@ethlete/*` package and its real version. A package the app never imports is not listed - this is what is running, not what a peer-dependency range allows. |
| **Runtime**     | The Angular version.                                                                                                                                                      |
| **Application** | Whatever was handed to `provideQueryDevtools({ about })`. Absent when nothing was.                                                                                        |

**⧉ Copy** puts the whole block on the clipboard as text, for pasting into a ticket
without downloading a file.

The same object is on **`window.ethlete`** - the same idea as Angular's `window.ng`, so
the versions can be read from the console without opening the panel:

```js
> ethlete;
{ ethlete: { core: '5.0.0-next.44', query: '6.0.0-next.32', components: '1.0.0-next.41' },
  angular: '22.0.7',
  app: { version: '1.4.2', sha: 'a3f9c1e' } }
```

It is installed by `provideQueryDevtools()`, so an app without the devtools has no such
global.

### The app's own build info

The SDK can read its own versions; it cannot know your app's. Hand them in:

```ts
provideQueryDevtools({ about: { version: '1.4.2', sha: 'a3f9c1e' } });
```

Rather than typing that - and letting it go stale - generate it:

```bash
yarn nx g @ethlete/core:devtools-about my-app
```

That adds a `build-info` target to the app, makes `build` and `serve` depend on it, and
points `provideQueryDevtools()` at the constant it writes. The file carries the app's
`package.json` version, the short commit SHA, the branch and the build time, and it is
regenerated on every build - so it is gitignored rather than committed, since its SHA
would otherwise change in every commit. An app that already passes options to
`provideQueryDevtools()` is left alone and told to add `about` itself.

## Export to Insomnia

Two buttons hand a request to [Insomnia](https://insomnia.rest) so it can be
replayed, tweaked and shared outside the app:

- **Copy for Insomnia**, in the selected query's **⧉ Copy** menu, copies a one-request
  collection to the clipboard - import it with `Import > From Clipboard`.
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
  green to confirm, and says which of its payloads landed - see
  [Copying a key or a path](#copying-a-key-or-a-path). A container with more than 100 entries is folded into
  collapsed slices of 100 (`0 … 99`, `100 … 199`, …) instead of being rendered in
  full, so a 5000-item list opens instantly; each slice expands on click and
  copies just the entries it covers. While the filter is active, only slices that
  actually contain a match unfold.
- **JIT editing** - a quick one-off, also in the **✎ Override** menu: paste raw JSON over a query's response and
  apply it via `setResponse()` (the UI re-renders instantly), or replay the query
  with edited args. It does not survive the next fetch - for an edit that should
  keep applying every time the query reruns, arm a
  [response override](#response-overrides-editing-a-value-that-survives-a-refetch)
  instead.
- **Response overrides** - a per-value menu in the value explorer that edits a
  path inside a response and keeps reapplying that edit on every future fetch -
  [see below](#response-overrides-editing-a-value-that-survives-a-refetch).
- **Force states** - in the **✎ Override** menu, force a query into loading / error / empty to exercise
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
- **⌖ Locate** - inspect run backwards. In the selected query's action row, it scrolls
  the element the query was created in into view and outlines it for a moment, tagged
  **created here**. That wording is the caveat: it is where the query was _created_,
  which is not necessarily where its data is rendered.

  The element comes from the creating injector, not from a debug API, so this works in
  a production build. A query created outside a component or directive - a root
  service, a resolver, a guard - has no element, and the button is **disabled** with
  that reason in its tooltip rather than doing nothing. An element that is detached,
  `display: none` or inside a collapsed panel reports **Not on screen** instead of
  drawing a box over an unrelated strip of the page. A host element that renders no box
  of its own - `display: contents`, which is common on Angular hosts - is located
  through its content: the box goes around the first descendant that does render one.

- **Copy the GraphQL document** - a GraphQL query's detail renders its document
  dedented, with a **⧉ Copy** button next to the heading, so it pastes straight
  into a GraphQL playground.

## Settings: what the panel keeps, and where

The **⚙** button in the header opens Settings over whatever tab is showing. It holds three
things: where each kind of panel state is kept, the limits the panel would otherwise carry as
constants, and a copy of every panel-wide switch that lives in a tab of its own.

Settings itself is always kept in `localStorage`, under
`ethlete:query:devtools:settings:v1`, **whatever the scopes below say** - a scope of `none`
that erased the choice which set it would be a setting you could never keep.

### Storage: what survives a reload, and how long

Each kind of state picks its own scope, because `none` costs something different for each:

| State                                                                | Default   | `none` means                                                        |
| -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| **Panel view state** - dock, sizes, open tab, filters, selections    | `session` | the panel forgets where it was on every reload                      |
| **Pinned queries**                                                   | `local`   | a pin dies with the tab                                             |
| [**Response overrides**](#keeping-overrides-across-a-reload)         | `none`    | the default - a reload is how the app stops being lied to           |
| [**Designed mocks**](#mocks-answering-a-route-the-panel-not-the-api) | `local`   | the library dies with the tab; arming never survives one either way |

Changing a scope **moves** what is already stored and clears the copy the old scope left
behind, so the next load cannot read a stale one.

::: warning `local` for overrides is allowed, loudly
`session` for overrides exists because "survives a reload" and "survives until I notice" are
different promises, and an app that stays tampered with across days is hours of debugging the
wrong thing. `local` is on offer anyway - a dev asking for it usually has a reason - and the
[restored-overrides bar](#keeping-overrides-across-a-reload) names the scope it brought them
back from.
:::

**IndexedDB is listed and disabled**, with the reason on its tooltip rather than left to be
discovered: all three of these are read synchronously - view state in a field initializer
before the first render, overrides inside query registration before the first request - and an
async store cannot answer either in time. `@ethlete/query` ships an
[IndexedDB persistence engine](/query/persistence) for query data, where arriving late is
survivable; devtools state is not that.

**Reset devtools** clears all three keys from both stores, whatever the scopes say, and puts
the panel back where it ships: dock, sizes, filters, selections and pins. It resets the live
panel and not just the keys, since the panel would otherwise write its current state straight
back. What it leaves alone is Settings itself - a panel behaving oddly is a reason to reset its
state, not to lose the scopes and limits you chose.

### Limits: how much the panel keeps in memory

| Limit                     | Default | Range       | Applies                                                                                                       |
| ------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| **Events log**            | `100`   | `10`-`1000` | at once - lowering it trims the log now, not at the next request                                              |
| **Dropped cache entries** | `20`    | `0`-`200`   | per client, as entries are dropped                                                                            |
| **Response history**      | `5`     | `1`-`50`    | to runs from now on; overrides [`provideQueryDevtools({ responseHistory })`](#run-history-and-response-diffs) |

Response history is the one that costs real memory - bodies dominate what the run buffer
retains - so it shows the application's own value until you change it, and offers a way back to
it rather than making you remember what it was.

### Mirrored: the switches their tabs also carry

The [Queries list's sort and tree view](#grouping-the-list-by-route-path), whether
[destroyed queries are listed](#a-destroyed-query-leaves-a-tombstone), the
[event log's failures-only and client scope](#events-what-each-request-cost) and
[Keep across reloads](#keeping-overrides-across-a-reload) are all here as well as where they
already were. Nothing moved - each control stays in the tab it belongs to, and Settings is the
one place that lists them, for the switch you know exists but not which tab it is on. Search
boxes are not mirrored: a filter term is not a setting.

## Persistence

The view state - open/closed, [dock edge or float rect, the size of each and the pane sizes](#where-the-panel-sits),
active tab, the query detail's
[sub-tab](#the-detail-view-overview-history-data), selected client, selected
query, inspect filter, the query filter term and status chips, the
[event log's](#events-what-each-request-cost) client scope and errors-only toggle,
the [socket message filter](#sockets-both-directions-and-an-emit-box), value-explorer
search and expanded tree paths, the
[Queries list's sort direction](#when-each-query-last-ran) and which
[folded query groups](#rows-that-would-repeat-are-folded) are open - is
persisted to `sessionStorage` under `ethlete:query:devtools:v4`, so it survives a
page reload within the tab session without leaking devtools state across sessions.
(Restoring the selected query relies on registry ids being stable across reloads,
which in turn assumes queries are created in the same order.)

[Pinned queries](#pinning-the-query-you-are-working-on) are the one thing kept
elsewhere: `localStorage`, under `ethlete:query:devtools:pins:v2`. Everything above is
view state that should die with the tab, while a pin says which query you are working
on and is meant to outlive one - and since a pin holds a registry id, it depends on
creation order exactly the way the restored selection does.

Both of those are defaults rather than rules:
[Settings ⚙ → Storage](#storage-what-survives-a-reload-and-how-long) picks the scope per
key, and the same tab has a **Reset devtools** that clears every one of them.

[Armed faults](#faults-making-requests-actually-misbehave) are deliberately **not** part of
that: they change how the app behaves, not how the panel looks, and a reload disarms every
client. [Response overrides](#response-overrides-editing-a-value-that-survives-a-refetch)
default to the same, but can opt in per session - see
[Keeping overrides across a reload](#keeping-overrides-across-a-reload), which stores them
under their own key and announces on load what it brought back. Neither is
[being popped out](#where-the-panel-sits), which a reload cannot restore.

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
