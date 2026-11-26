---
'@ethlete/components': minor
---

Switch now supports an `indeterminate` state (two-way `[(indeterminate)]`), mirroring checkbox - the first toggle resolves it to on. Since `role="switch"` cannot carry `aria-checked="mixed"`, it's presentational only (thumb parks mid-track behind `data-indeterminate`; `aria-checked` stays boolean). The mixed/indeterminate state on the graphical controls (rating, slider, range-slider, checkbox-group, radio-group, switch) now uses a consistent dashed "provisional" treatment so it reads as "values differ" rather than empty.
