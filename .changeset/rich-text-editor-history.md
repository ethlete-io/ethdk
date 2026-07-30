---
'@ethlete/components': minor
---

Rich text editor: undo/redo over the Markdown value, replacing the browser's native
`contenteditable` history (which could restore states the value never had). Ctrl/Cmd+Z, Ctrl+Y and
the platform's own undo all route into it, plus new `'undo'` / `'redo'` toolbar tools that lead the
default toolbar. Typing goes back word by word; a paste, autoformat or tool rewrite in one step.
