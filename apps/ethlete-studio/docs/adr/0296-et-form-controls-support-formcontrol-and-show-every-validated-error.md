---
status: accepted
open: B507
decided: 2026-11-14
source: doc-agent session 2026-11-14 (morning round), from the fifagg 7.8 forms spike
---

# et-* form controls support [formControl] and show every validated error

A fifagg spike found that `[formControl]` works directly on the et-* controls in Angular 22.2 (spec 85/85), with two
gaps that come from Angular itself: a template `required` beside `[formControl]` switches itself off, and
`Validators.requiredTrue` sets no required flag. The human accepted the recommendation to support it officially.

- `[formControl]` on et-* controls is officially supported. The SDK gets a contract spec for it, and the forms guide
  (`apps/docs`) documents it. The two Angular gaps are documented with their workaround (`Validators.required` in the
  control instead of the template attribute) and pinned as known gaps; no upstream issue.
- There is no per-field opt-out for the error text. The human: "Gleiches beim Fehlertext wobei ja eig kein Fehler
  kommt wenn kein validator drauf ist. Wieso also sollte man ein Feld validieren wenn der Fehler nicht gerendert wird
  das wäre ja Bad ux? Ich kann verstehen dass der error in machen uis blöd aussieht."
- No class input for select options. The human: "bei der Select Supporten wir doch schon Custom Options oder?" Option
  templates already cover it.
- The select search input gets `autocomplete` like `et-input`. The human: "autocomplete ist dann denke ich eher etwas
  was alle unsere Inputs was angeht und nicht nur select." Every et-* text input that renders a native input passes
  `autocomplete` through.

The human answered "Q2ok" to the summary.
