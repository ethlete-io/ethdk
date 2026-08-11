---
'@ethlete/query': patch
---

Auth multi-tab fixes: a follower no longer duplicates the leader's scheduled refresh, a joining tab
adopts the live session instead of auto-logging in, and a tab coming back to the foreground rechecks
a refresh its throttled timer missed.
