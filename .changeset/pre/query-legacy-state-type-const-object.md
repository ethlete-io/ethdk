---
'@ethlete/query': minor
---

The legacy `QueryStateType` and `AuthBearerRefreshStrategy` are const objects instead of
`const enum`s, so a transpile-only build can consume them.
