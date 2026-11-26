---
'@ethlete/components': patch
---

A tab inserted anywhere but the end no longer desyncs `aria-selected`, the roving
tab stop and the visible panel - the tab bar now keys its triggers by DOM order.
