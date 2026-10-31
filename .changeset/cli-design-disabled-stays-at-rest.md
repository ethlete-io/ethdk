---
'@ethlete/cli': patch
---

The design tool no longer forces hover, active or focus-visible on a disabled element: `interactionRows` draws a row with `disabled: true` only at rest, and `forceInteraction` and the frame leave a `disabled` or `aria-disabled="true"` root alone.
