---
'@ethlete/components': patch
---

Fix four bugs in carousel, tabs and notifications:

- A carousel no longer freezes its current slide when a wheel, trackpad or arrow-key scroll interrupts a button or dot navigation, or after a press on the dot of the slide already in view.
- Headless tabs show the matching panel when a tab is inserted before others or re-ordered, because the panels now follow DOM order like the triggers.
- A `NaN` tab `selectedIndex` selects the first tab and a fractional one is truncated, instead of selecting nothing and hiding every panel.
- `notificationManager.promise(query)` dismisses its loading toast when the query's execution is aborted, instead of spinning forever or reporting the previous response as success.
