---
'@ethlete/components': patch
---

Error codes: resolve a range collision where tabs, scrollable, and form field reused the icon domain's `ET18xx` codes. Each domain now owns a unique 100-code block:

- Tabs: `TAB_ERROR_CODES` moved from `1800–1803` to `2000–2003`.
- Scrollable: `ScrollableErrorCode.MISSING_SCROLL_CONTAINER` moved from `1800` to `2100`.
- Form field: `FORM_FIELD_ERROR_CODES.MISSING_CONTROL` moved from `1800` to `2200`.

Icon keeps `1800–1899`. If you match on these numeric values (or on `ET1800`-style codes in error messages), update to the new numbers.
