---
status: accepted
built: 75bf045c7
decided: 2026-11-20
source: grill session 2026-11-20 (day shift), B647
---

# A Ctrl+C lost during the CEF start is accepted

A Ctrl+C about 360 ms after the host starts falls into a window of about 5 ms in `tauri-runtime-cef`: Chromium's
handler takes the signal, then the runtime puts the host's handlers back, and the signal is lost. A second Ctrl+C ends
the process with 130. A Ctrl+C before that window kills the process before the design server runs. The host cannot fix
it, because its only hook runs before CEF initializes.

We do not patch or fork the runtime for it; the window is accepted and B647 closes. The host-signal e2e waits until
the handlers are installed before it sends a signal. The human answered "q1ok" to the recommendation to accept it, as
was done for the CEF debug-port defects (ADR 0251).
