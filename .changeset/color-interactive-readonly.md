---
'@ethlete/core': patch
---

`ColorInteractiveDirective`: a readonly control (`aria-readonly="true"`) now keeps its resting accent — hover/active/focus no longer retint it, matching the view-only intent (previously a readonly switch still showed a press color shift).
