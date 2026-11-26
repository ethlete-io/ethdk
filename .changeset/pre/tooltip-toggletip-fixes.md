---
'@ethlete/components': patch
---

`[etTooltip]` appends to an existing `aria-describedby` instead of replacing it,
`etToggletipTrigger` no longer overwrites a consumer-bound `etToggletipDisabled`,
and both render content that changes while they are open.
