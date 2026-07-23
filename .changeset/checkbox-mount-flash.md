---
'@ethlete/components': patch
---

Checkbox: don't flash the focus ring on first render. The host's `opacity` /
`outline-color` transitions were declared unconditionally as well as under
`[data-can-animate]`, so on mount the outline colour animated from its resolved
value and the ring briefly appeared. Transitions now live only under
`[data-can-animate]` (added after the first render), so nothing animates on mount.
