---
'@ethlete/components': minor
---

Rich text editor: pasted text that spells a token out — `#First name`, the trigger char plus an
item's label or id — comes back as a real chip, for HTML and plain-text clipboards alike (opt out with
`parsePastedTokens="false"`). A trigger with a static `items` list no longer needs `resolveItem` to
render chip labels.
