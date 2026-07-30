---
'@ethlete/components': patch
---

Fix leaving a code block in the rich text editor when nothing follows it: ArrowDown off the last line
now creates the paragraph it would move to, and a second Enter on the empty last line leaves the
block again (it never fired, since the trailing newline that gives that line a line box sits after
the caret).
