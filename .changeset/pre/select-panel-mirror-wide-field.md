---
'@ethlete/components': patch
---

Select panel: a width-mirrored panel now matches its field at any width. The panel carried a `max-inline-size: 400px` cap, so on fields wider than 400px the dropdown stopped matching the trigger and rendered narrower than the field. The cap is now scoped to compact triggers (`mirrorPanelWidth={false}`), where the pane is content-sized and still needs an upper bound; when the panel mirrors the field the pane width alone sizes it, with no cap.
