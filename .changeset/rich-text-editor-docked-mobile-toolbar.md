---
'@ethlete/components': minor
---

Rich text editor: on touch devices the toolbar now docks above the on-screen keyboard while editing,
instead of sitting at the top where the platform's selection menu (Cut/Copy/Paste/…) covered it and
made buttons like Link unreachable. It isn't shown at all until the editor is active (so it never
sits at the top or shuffles position), then appears as a full-width, horizontally scrollable bar positioned
above the keyboard via `visualViewport`, and formatting applied from it re-targets the selection that
was active before the tap. With a mouse/trackpad the toolbar stays at the top as before. On touch, the
toolbar's menus (block style, alignment, language, table) also open without stealing focus, so the keyboard
stays up and the docked toolbar doesn't jump while a menu is open, and tapping a menu item keeps the
editor focused; the toolbar also stays in place while the link editor popover is open (it belongs to
the same editing flow). It fades/slides in and out instead of popping, and tracks the on-screen
keyboard as the page scrolls (following `visualViewport`) so it stays pinned above the keyboard.
