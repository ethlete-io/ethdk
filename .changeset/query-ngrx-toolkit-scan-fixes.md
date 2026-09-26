---
'@ethlete/query': patch
---

The ngrx-toolkit interop no longer reuses a handle for `FormData`, `Blob`, `Map`, `Set` or `Date` args it cannot tell apart, and every `toolkitCall` sends its own headers and args.
