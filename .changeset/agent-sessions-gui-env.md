---
'@ethlete/agent-rules': patch
---

`agent-sessions run` and `restart` now start the agent with `WAYLAND_DISPLAY`, `DISPLAY`, `NIRI_SOCKET`, `XDG_SESSION_TYPE` and `XDG_RUNTIME_DIR` from the tmux global environment, so a restarted session can read the clipboard and accept pasted images.
