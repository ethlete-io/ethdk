---
'@ethlete/components': minor
---

Calendar: `mode="multiple"` for a set of unrelated dates.

A third selection model beside `single` and `range`, writing its own `multipleValue` model (`Date[]`)
so switching modes never has to reinterpret another mode's value. Each pick adds a date and picking
it again removes it — the only way to unpick one, so it is the same gesture either way — and the array
is kept ascending, which means a consumer never sorts it and the calendar opens on the earliest date.

Nothing bands or previews in this mode, since the dates have no relationship to one another, and the
grid carries `aria-multiselectable="true"`. It composes with `precision`: at `'month'` each pick
toggles a whole month. The date inputs deliberately have no equivalent — their value is one wire
string.
