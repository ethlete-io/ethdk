---
'@ethlete/query': major
---

**Breaking:** `queryField<T>()` with a default is typed `T`, not `T | null`, and reads the URL into the default's type instead of guessing; without a default, a non-string `T` needs a `queryParamToValue`.
