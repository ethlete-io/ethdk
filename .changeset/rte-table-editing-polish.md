---
'@ethlete/components': patch
---

Rich text editor: table editing polish — arrow keys now step the caret cleanly across table edges (into the nearest cell when entering, onto a real line when exiting, adding one only when the table is flush against the editor's top/bottom) instead of stranding it at the table border; an empty line directly above a table can be removed with Backspace; and applying an inline format across multiple selected cells now wraps each cell's content within its own cell instead of tearing the table apart.
