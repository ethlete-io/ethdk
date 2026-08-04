---
'@ethlete/query': minor
'@ethlete/components': minor
---

Make retries and transfer progress visible in the query devtools. A request now
tracks what its retry policy is doing: `request.subtle.attempts()` is how many HTTP
attempts the current execution has made, and `request.subtle.retryState()` describes
the retry it is waiting out (`{ attempt, delayMs, startsAt, status }`), present only
during the backoff itself. The devtools stats handle records the attempt count per
run (`QueryDevtoolsRun.attempts`) plus a `retries` total, fed from the request rather
than handed down into it - a retry belongs to the request, which is shared by every
query hitting the same cache key.

The panel spells all of it out. A query's detail head now reads
`⟳ attempt 3 in 2s · after 503 · backing off 3.00s` while a backoff runs, and keeps
stating `⟳ 4 attempts` once the request settles, so a request that only succeeded on
its fourth try no longer reads as a clean one. The Queries list marks a backing-off
row with a `⟳ N` chip, because that is the one state a loading dot actively
misrepresents: nothing is in flight at all. Runs carry the same marker in the History
table and on the Timeline bar, which is what says a 7-second bar is mostly backoff
rather than one slow round trip, and Activity gained a **Retries** tile.

A request that reports progress (`reportProgress: true` on the creator) now draws a
bar with `38% · 120.0 kB of 320.0 kB · 2.40s left` on the detail head - the panel
previously read `latestHttpEvent` only for its status and dropped every progress
event.
