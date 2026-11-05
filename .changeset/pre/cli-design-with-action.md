---
'@ethlete/cli': patch
---

Add the `withAction(markup, action)` design helper: it declares a `data-et-action` on the first `<button>` (or the element `{ action, on }` names) and throws when nothing matches, instead of a string replace that silently adds nothing.
