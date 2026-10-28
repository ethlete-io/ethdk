---
'@ethlete/cli': patch
---

`et design` reports a forbidden local port (`listen EPERM`) as a permission failure instead of a drawing failure. `/__design/shot` answers 504 when a draw times out and 422 with the build message when the frame has a Vite build error, never a 200 with a broken image. A change to a flow file clears the cached shots, a change to `port` is used by the next draw, and a change to `render.packages` or `render.modules` restarts the render worker, all without restarting the server.
