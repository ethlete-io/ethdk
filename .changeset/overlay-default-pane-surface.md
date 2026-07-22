---
'@ethlete/components': minor
---

Overlay: give the boxed overlay kinds (`dialog`, `anchoredDialog`, the four sheets and the full-screen dialog) a default themed pane surface — `--et-surface-background-solid` background, a `0.1rem` `--et-surface-border-solid` border (all around for dialogs; every edge but the docked one for bottom/top sheets; only the exposed inner edge for side sheets, whose block edges sit flush against the viewport), and a radius on the exposed corners (`1.6rem` dialogs/sheets, `1.2rem` anchored dialog; full-screen stays square). Plain overlay content no longer needs to paint its own surface. Overridable per instance via the new `--et-overlay-surface-background`, `--et-overlay-surface-color`, `--et-overlay-surface-border-color`, `--et-overlay-surface-border-width` and `--et-overlay-radius` tokens. Anchored/centered panes (menu, tooltip, select, date-picker) are unaffected — they still paint their own surface.
