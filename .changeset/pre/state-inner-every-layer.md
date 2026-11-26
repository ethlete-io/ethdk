---
'@ethlete/cli': patch
---

`design check` renames PAGE-STATE-INNER to STATE-INNER and also checks own parts of every layer that embed a part, counting a control declared with `part` as that part, so a shell state that only hovers its search button is refused.
