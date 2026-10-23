---
'@ethlete/components': patch
---

`NotificationDirective` now starts the enter animation of an `AnimatedLifecycleDirective` on the same element, so a custom toast animates in and out by adding that host directive. Dismissed toasts no longer flash back in before they are removed.
