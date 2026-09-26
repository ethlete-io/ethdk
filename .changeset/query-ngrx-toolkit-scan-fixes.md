---
'@ethlete/query': patch
---

The ngrx-toolkit interop no longer reuses a handle for `FormData`, `Blob`, `Map` or `Set` args it cannot tell apart, keys `Date` args by their time value, releases each such unshared handle once the next one starts and its own call has settled (it keeps emitting its last state), and every `toolkitCall` sends its own headers and args.
