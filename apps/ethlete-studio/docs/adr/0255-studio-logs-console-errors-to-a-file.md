---
status: accepted
open: B482
decided: 2026-11-10
source: grill session 2026-11-10 (evening), B482 release smoke
---

# Studio logs console errors to a file

The release smoke reads console errors over the Chromium debug port, which only a patched build has, so it does not
check the bundle that ships. Studio gets an `on_console_message` hook that writes each console error of the webview to a
log file. The smoke reads that file and checks the real shipped bundle with no debug port; the same file helps with a
user's bug report. The human chose this over keeping the patched debug-port build with "q1ok".
