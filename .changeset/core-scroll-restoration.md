---
'@ethlete/core': minor
---

`setupScrollRestoration` can now restore the previous scroll offset on browser back/forward navigation instead of scrolling to top, via `restore: { enabled: true }`.

- The offset is applied only once the content is tall enough to reach it, so query-driven pages no longer land at the wrong place while their skeleton/loading state is on screen. Options: `timeout`, `maxTimeout`, `clampOnTimeout`.
- `holdScrollRestoration(() => query.isLoading())` suspends the wait from inside a route component when the data takes longer than `timeout` to arrive.
- `scrollElement` now also accepts a getter (`() => HTMLElement | null`), for scroll containers that only exist after the app shell rendered or are created per route.
