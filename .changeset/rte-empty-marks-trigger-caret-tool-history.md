---
'@ethlete/components': patch
---

Fix the rich text editor leaking an emptied `<u>`/`<code>` tag into the Markdown value,
opening the trigger popup for a character the caret sits in front of, and merging a
table or alignment edit into the next keystroke's undo entry.
