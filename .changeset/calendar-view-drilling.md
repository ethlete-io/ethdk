---
'@ethlete/components': minor
---

Calendar: the header label is a button that zooms the day grid out to months and then years, and
picking one drills back in; `startView` decides where it opens, forwarded by the three date inputs. A
coarse pick only navigates, reported as `monthSelect` / `yearSelect`. `min`/`max`/`dateFilter` and the
keyboard model reach every view, and the new `dateClass` puts classes of your own on any cell.
