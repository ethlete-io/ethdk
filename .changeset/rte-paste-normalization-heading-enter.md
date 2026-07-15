---
'@ethlete/components': minor
---

Rich text editor: pasted HTML is now normalized into the editor's own schema (foreign tags, inline styles, classes and scripts never enter the editable DOM; token chips keep their identity), and pressing Enter at the edge of a heading starts a plain paragraph instead of continuing the heading. Shift+Enter always stays a soft line break.
