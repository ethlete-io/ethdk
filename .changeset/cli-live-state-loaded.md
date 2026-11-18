---
'@ethlete/cli': patch
---

The LIVE check reads a sketched part's state names from its loaded module in the render check, so a part that spreads its states is checked too instead of being skipped with a note.
