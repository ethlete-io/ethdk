---
'@ethlete/cli': patch
---

The design check reports `CLASS-GLUED-INTERPOLATION` for a class written directly against a `${...}` interpolation in a part's class attribute, which Tailwind's scanner reads as one candidate and emits no CSS for.
