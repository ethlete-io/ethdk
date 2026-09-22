---
'@ethlete/components': patch
---

Rich text editor: toggling an inline format (bold, italic, underline, strike, code) with **no selection** now works as expected - it sets a pending "stored mark" so the next typed text picks up (or drops) that formatting, instead of doing nothing. The pending state shows in the toolbar and is cleared when you move the caret.
