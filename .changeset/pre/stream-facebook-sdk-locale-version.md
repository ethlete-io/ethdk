---
'@ethlete/components': minor
---

The Facebook stream player loads its SDK in the app locale instead of `de_DE`, and `provideStreamConfig` takes a new `facebookSdkVersion` field (default `v26.0`, previously a hard-coded `v3.2`).
