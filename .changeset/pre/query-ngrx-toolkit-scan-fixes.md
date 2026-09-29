---
'@ethlete/query': patch
---

The ngrx-toolkit interop no longer shares a handle between `FormData`, `Blob`, `Map` or `Set` args it cannot tell apart, keys `Date` args by time value, and every `toolkitCall` sends its own headers and args.
