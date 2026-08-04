---
'@ethlete/query': minor
'@ethlete/components': minor
---

Let the query devtools cause faults instead of only freezing UI state. `forceLoading` /
`forceError` write a query's signals directly, which exercises the template but bypasses
the pipeline behind it - no retry fires, no error handling feature runs, the cache never
sees a failure. A new **Faults** tab arms the request itself, per query client: N ms of
latency before every attempt, fail-the-next-N-attempts, fail-N%-of-attempts, and the
status an injected failure responds with.

The fault is resolved inside the request pipeline ahead of `retry`, per **attempt**
rather than per execution - which is what makes the retry policy re-roll it, so
`fail next 2` fails two attempts and lets the third through like a server coming back.
Latency delays the attempt rather than its response, so the query genuinely stays
`loading` that long and a retry waits it out too. A faulted attempt never reaches the
network, so this works offline and against an API you would rather not hammer. The
status picker says whether the default retry policy retries what you armed, because a
`500` is deliberately not retried and would otherwise look like a broken feature.

The instrumentation follows the existing devtools contract: `http-request.ts` reads a
module global installed by `provideQueryDevtools()`, so a bundle without the devtools
keeps the pipeline it always had. `setQueryDevtoolsFault()`, `clearQueryDevtoolsFaults()`
and the `queryDevtoolsFaults` signal are exported for the panel to drive.

An armed client is drawn with a red border and the tab carries a red badge, since every
misbehaving request in the app is coming from it, and nothing survives a page reload - a
persisted "fail everything" that outlived the session that armed it would be a trap.

Also fixes a doubled border under the query detail's Overview / History / Data sub-tabs,
where the first section drew its own separator directly beneath the nav's.
