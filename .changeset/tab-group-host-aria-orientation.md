---
'@ethlete/components': patch
---

`et-tab-group` no longer puts `aria-orientation` on its `role="none"` host; the orientation stays on the inner tablist that owns the tabs.
