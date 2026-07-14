---
'@ethlete/components': minor
'@ethlete/core': patch
---

Rich text editor: list items can now be nested. **Tab** nests the current item under the previous one, **Shift+Tab** lifts it out one level, and **Enter**/**Backspace** on an empty item step out one level at a time (leaving the list entirely only at the top level). Marker styles cycle by depth (disc → circle → square, and decimal → lower-alpha → lower-roman).

`@ethlete/core`: `markdownToHtml`/`htmlToMarkdown` now round-trip **nested** lists (two-space indentation per level), instead of flattening them.
