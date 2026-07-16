---
'@ethlete/components': minor
---

Select & phone input: UX polish and new capabilities.

- Select: `allowAddNew` renders an "Add new" action row in the panel that emits `addNewRequested` with the current query (label via `addNewLabel`).
- Select: clicking anywhere on the form field's control frame now opens the panel, not just the trigger.
- Select: option hovers are animated, and a pointer-set highlight clears when the pointer leaves the list (matching the menu); options render with `content-visibility: auto`, keeping panels with thousands of options responsive.
- Select: the load-more control is a distinct start-aligned action row, loading shows a spinner in the field, and the panel's state rows mirror the menu's styling.
- Select & tag input: `readonly` chips keep their normal look and drop the remove button instead of appearing disabled; disabled form fields no longer show hover feedback.
- Phone input: national trunk `0` is stripped (`0171…` → `+49171…`) and the `00` international prefix works like `+`; the country picker searches dial codes, shows an empty state, keeps a fixed panel width, mirrors the menu's search styling, and supports custom flag art via `ng-template[etPhoneInputFlag]`.
