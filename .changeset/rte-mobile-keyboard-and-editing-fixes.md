---
'@ethlete/components': minor
---

Rich text editor: mobile-keyboard and editing fixes, plus table Tab navigation.

- The docked toolbar now stays above the on-screen keyboard on iOS Safari (previously it was covered), including when the editor runs inside a same-origin iframe.
- Toggling a mark off at the end of a line no longer gets undone by typing a space next.
- Escape (or the close button) in the link editor returns focus to the editor instead of dropping it to the page.
- Tab/Shift+Tab move between table cells; past the first/last cell the caret steps out of the table.
- `OverlayRef` gained `afterClosedEvent()`, which also reports how the overlay was closed (`escape`, `outside-pointer`, `api`, …).
