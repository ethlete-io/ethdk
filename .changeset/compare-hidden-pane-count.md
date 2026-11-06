---
'@ethlete/cli': patch
---

`design compare` no longer counts an overlay mock inside a `hidden` element as a drawn pane, so a closed embedded menu costs no pane wait. A state whose app opens fewer panes than its design draws now fails.
