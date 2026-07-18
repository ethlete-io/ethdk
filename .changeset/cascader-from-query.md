---
'@ethlete/components': minor
---

Cascader: `cascaderFromQuery` builds a `CascaderDataSource` from `@ethlete/query` creators — per-level loads (concurrent, deduped/cached by the client), optional flat-search wiring with debounce and `minQueryLength`, and a `resolvePath` passthrough. The cascader's default `toErrorMessage` now shows an `Error`'s `message` verbatim (falling back to the generic text), so query failure messages surface without extra wiring.
