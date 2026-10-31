---
'@ethlete/cli': patch
---

The design check warns with `CLASS-GLUED-INTERPOLATION` for a class written directly against a `${...}` interpolation in a part's class attribute, which Tailwind's scanner reads as one candidate and emits no CSS for.
