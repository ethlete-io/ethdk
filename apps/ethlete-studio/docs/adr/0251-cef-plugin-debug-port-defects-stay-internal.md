---
status: accepted
built: a6420ba39
decided: 2026-11-10
source: grill session 2026-11-10 (day shift), finding 700
---

# The CEF plugin's debug port defects stay internal

The Mac CEF spike found two defects in `tauri-runtime-cef` with the Chromium remote debug port: a run with the port
disabled keeps it disallowed for every later run, and the debug socket leaks into child processes such as the design
server. Neither matters until a build turns the port on, for example a future Studio e2e over CDP. No issue goes to
the plugin's repository. If the port is needed, a harness works around both in our own code (delete the stored key
before the start, keep the socket out of child processes). The human chose this over upstream issues with "q1b".
