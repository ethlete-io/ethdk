---
'@ethlete/cli': patch
---

Send a heartbeat on the design server's event stream every 20 seconds. WebKit dropped the quiet stream after 60 seconds. Studio then reloaded every list and frame after each reconnect, so Studio on macOS showed no frames.
