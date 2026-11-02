---
'@ethlete/core': patch
---

`AnimatedLifecycleDirective` no longer throws `Cannot read properties of undefined (reading 'directive')` when a bundle evaluates `AnimatableDirective` first, for example in a lazy chunk that uses `NotificationComponent`.
