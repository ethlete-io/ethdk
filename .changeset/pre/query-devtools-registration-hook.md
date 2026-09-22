---
'@ethlete/query': patch
---

Devtools instrumentation is now registered through a hook that `provideQueryDevtools()` installs, so
an app without it drops the entry registry, the route stringifier and the client-name derivation
entirely - ~0.5 kB gz off every entry. No API change; `queryDevtoolsEntries` and the
`<et-query-devtools>` contract are unchanged.
