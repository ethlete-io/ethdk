---
status: accepted
open: B480
decided: 2026-11-10
source: grill session 2026-11-10 (day shift)
---

# The Windows CEF spike waits for real hardware

Before Studio switches to CEF on Windows, a spike checks the build, the live frames, the bundle size and signing, as
the Mac spike did (ADR 0242, ADR 0249). No real Windows machine is available now. A Windows 11 VM on the Linux PC was
possible, but it runs the live frames on a virtual GPU. The spike therefore waits until the human's PC moves to
Windows, and then runs all of its checks on real hardware. Until then Windows keeps WebView2. The human chose this
over the VM with "q1b".
