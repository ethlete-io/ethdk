---
'@ethlete/query': minor
'@ethlete/components': minor
---

Record what a query did per run instead of only as running totals: each query now
keeps its last 25 runs (`{ index, startedAt, endedAt, status, url, sentBytes,
receivedBytes }`) on its devtools stats handle, with the response body retained for
the newest 5. A run is `pending`, `success`, `error`, or `aborted` when the query
requested again before the response arrived; a response that arrives without a
request of the query's own - a poll, another consumer of the same cache entry,
another tab - is recorded as an instant. The buffer is only ever allocated behind
`provideQueryDevtools()`, so an app without the devtools pays nothing.

Two devtools features build on it. A new **Timeline** tab draws every request as a
bar on one shared axis, which is what makes a mount stampede, an N+1 chain or a
polling stampede visible as such - the event log's flat list of wall-clock times
cannot show overlap. Bars carry their own URL rather than the query's current one,
and clicking a bar opens its query. A query's new **History** section lists its runs
and can **diff** one response against the previous one as a flat list of changed
paths, answering "the list re-rendered, what changed?" and "did that poll return
anything new?". Arrays of records are matched by a unique `id`, so a list that
gained an item reports that item rather than every index after it.

The query detail is now split into **Overview** / **History** / **Data** sub-tabs
with the Run / Edit / Force actions pinned above them; a failing query marks the
Data sub-tab, so an error never hides behind a closed tab.
