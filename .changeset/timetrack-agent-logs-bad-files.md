---
'timetrack-app': patch
---

The agent log reader no longer fails on a dangling symlink or a line that is not valid UTF-8. It skips the broken link and reads the bad line with replacement characters, so the other logs still arrive.
