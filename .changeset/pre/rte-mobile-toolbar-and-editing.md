---
'@ethlete/components': minor
---

Rich text editor: mobile toolbar and editing fixes.

- On touch devices the static toolbar docks above the on-screen keyboard while editing (tracked via `visualViewport`, staying pinned as the page scrolls and inside a same-origin iframe) instead of sitting at the top under the platform's selection menu; it fades in only once the editor is active and its menus open without stealing keyboard focus. With a mouse/trackpad it stays at the top as before.
- The editable area's font size is floored at 16px on touch so iOS Safari no longer zooms the page on focus.
- Toggling a mark off at the end of a line is no longer undone by the next space.
- Escape (or the close button) in the link editor returns focus to the editor.
- Tab/Shift+Tab move between table cells and step the caret out past the first/last cell.
- `OverlayRef` gained `afterClosedEvent()`, which also reports how the overlay was closed (`escape`, `outside-pointer`, `api`, …).
