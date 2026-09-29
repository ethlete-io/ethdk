---
'@ethlete/components': minor
---

Cancel a rich text image upload when its editor is destroyed, also for a tool provided on a route. The upload function receives `{ signal }` as a second argument, and tool definitions gain an `editorDestroyed(editor)` hook.
