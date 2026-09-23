---
'@ethlete/timetrack': minor
---

Add `parseCodexSessionLog()`: the Codex CLI's rollout logs read for their sessions and each turn's
token spend. A cursor now carries the session state a log states once rather than per record.
