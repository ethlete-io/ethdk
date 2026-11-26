---
'@ethlete/components': patch
---

Tighten `appearance="underline"` form fields: they no longer reserve the box height the
`box`/`filled` skins need, so the rule sits directly under the value instead of at the
bottom of a taller frame. A `size="sm"` field previously left ~12px of dead space
between its value and the underline (most visible on a compact control like a table
footer's page-size select) - that is now the field's own
`--et-form-field-control-padding-block`, and the frame is content-height (27px instead of
42px at `sm`).

The floor is derived from the control's line box, so it scales with
`--et-form-field-control-font-size` / `-line-height` / `-padding-block`, and a floating
label still grows the frame past it. `box` and `filled` appearances are unchanged.

Note this makes underline fields shorter on touch as well - reach for `box`/`filled` or
a larger `size` where a full-size tap target matters more than density.
