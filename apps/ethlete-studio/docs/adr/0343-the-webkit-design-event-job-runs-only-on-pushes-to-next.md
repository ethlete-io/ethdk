---
status: accepted
built: 8633c9be0
governs: ['.github/workflows/ci.yml']
decided: 2026-11-18
source: doc-agent session 2026-11-18 (day shift), the macOS cost of CI once the SDK repo is private (ADR 0342)
---

# The WebKit design event job runs only on pushes to next

The `webkit-design-events` CI job holds the design event stream open in WKWebView, which drops a response that sends no
bytes for 60 seconds. It runs on `macos-latest` when Studio or the CLI design code changed. In a private repo a macOS
minute counts ten times, so one run costs about 40 free minutes. From now on the job stays on GitHub-hosted macOS but
runs only on a push to `next`, never on a pull request, with the same change filter. Its minutes are measured together
with the Tauri bundles (ADR 0342, item 4). A draft pull request of a held push (ADR 0216) therefore does not run it.
Rejected: the team Mac as a self-hosted runner (it must then stay reachable), and dropping the job (the bug would show
only in the macOS app). The human: "q1ok" (option a, recommended).
