---
'@ethlete/query': patch
---

An aborted execution no longer counts as a success: `createQuerySubmission` skips `onSuccess` and `submit()` resolves `false`, `querySequence` stops with `error: null`, and `executeUntilSettled` on a destroyed query resolves a cancelled snapshot instead of throwing NG0205.
