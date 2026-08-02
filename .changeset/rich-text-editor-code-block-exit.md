---
'@ethlete/components': patch
---

Rich text editor: fix escaping a code block that sits flush against the start or end of the content,
where there is no line to move to. ArrowUp off the first line and ArrowDown off the last now create
the paragraph they would move to, and a second Enter on the empty last line leaves the block.
