---
'@ethlete/components': patch
---

Fix escaping a code block in the rich text editor that sits flush against the start or end of the
content, where there is no line to move to: ArrowDown off the last line and ArrowUp off the first one
now create the paragraph they would move to. A second Enter on the empty last line leaves the block
again too (it never fired, since the trailing newline that gives that line a line box sits after the
caret).
