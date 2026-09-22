---
'@ethlete/core': major
---

Remove `DelayableDirective` since it's only used specifically inside the now legacy `InfinityQueryDirective`. If this functionality was needed, use the new `provideInfinityQueryResponseDelay()` provider instead.
