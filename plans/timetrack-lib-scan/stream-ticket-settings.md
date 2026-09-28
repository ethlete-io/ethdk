# timetrack stream, ticket, settings scan - open findings

Scan of `libs/timetrack/src/lib/{stream,ticket,settings}` and `libs/timetrack/src/index.ts` from 2026-09-28. 0 High, 1 Medium, 0 Low, 0 Spec. Skipped: spec and story files. `jira/`, `gitlab/`, `reason/` and `model/` were read only where a finding depends on them. The scope holds no RxJS subscriptions, timers or DOM listeners, so it has no leak findings. The observables are cold one-shot pipes.

## stream

- Medium: `stillFocused` pushes the tail sample onto `observed` after the sort (`stream/stream-day.ts:985`). If a git, editor or agent sample is later than `windowsSeenThroughMs`, `samples` goes out of order. The `next` stretch then runs backwards, and the tail's focus is added to the wrong context. Insert the tail at its sorted position. S Verified.
