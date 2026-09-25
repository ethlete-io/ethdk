---
'@ethlete/agent-rules': patch
---

The `app-styling` rule and its migration now keep `ViewEncapsulation.None` on app components, as the `require-view-encapsulation-none` lint rule requires, and scope the remaining CSS under the component's host class.
