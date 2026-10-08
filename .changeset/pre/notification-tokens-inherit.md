---
'@ethlete/components': patch
---

Fix the notification's header, icon, title, message and progress bar tokens having no effect when set on `.et-notification` or an ancestor, by registering every notification token as inheriting.
